import "server-only";
import { db } from "./database-client";
import {
  cardRows,
  copyTitle,
  decksToArchive,
  isShareToken,
  newShareToken,
  pickDeck,
  type Card,
  type Deck,
  type DeckKind,
  type DeckWithCards,
} from "@/lib/flashcard-decks";

type DeckRow = {
  id: string;
  topic_id: string;
  subtopic_id: string | null;
  kind: DeckKind;
  owner_id: string | null;
  title: string | null;
  source_deck_id: string | null;
  share_token: string | null;
  archived_at: string | null;
  created_at: string;
};

const DECK_COLUMNS = "id, topic_id, subtopic_id, kind, owner_id, title, source_deck_id, share_token, archived_at, created_at";

const toDeck = (r: DeckRow): Deck => ({
  id: r.id,
  topicId: r.topic_id,
  subtopicId: r.subtopic_id,
  kind: r.kind,
  ownerId: r.owner_id,
  title: r.title,
  sourceDeckId: r.source_deck_id,
  shareToken: r.share_token,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
});

type Lesson = { topicId: string; subtopicId?: string | null };

// Narrows a query to one lesson: the topic lesson (no subtopic) or a subtopic lesson.
// Typed loosely on purpose: the query builder's own types nest too deeply to pass through a generic.
type Filterable = { eq: (c: string, v: unknown) => Filterable; is: (c: string, v: null) => Filterable };
function forLesson<Q>(query: Q, l: Lesson): Q {
  const byTopic = (query as unknown as Filterable).eq("topic_id", l.topicId);
  return (l.subtopicId ? byTopic.eq("subtopic_id", l.subtopicId) : byTopic.is("subtopic_id", null)) as unknown as Q;
}

async function cardsOf(deckId: string): Promise<Card[]> {
  const { data, error } = await db.from("flashcards").select("front, back").eq("deck_id", deckId).order("position");
  if (error) throw error;
  return (data ?? []) as Card[];
}

async function withCards(row: DeckRow | null): Promise<DeckWithCards | null> {
  if (!row) return null;
  return { ...toDeck(row), cards: await cardsOf(row.id) };
}

export async function getDeckById(deckId: string): Promise<DeckWithCards | null> {
  const { data, error } = await db.from("flashcard_decks").select(DECK_COLUMNS).eq("id", deckId).maybeSingle();
  if (error) throw error;
  return withCards(data as DeckRow | null);
}

export async function getStandardDeck(lesson: Lesson): Promise<DeckWithCards | null> {
  const q = forLesson(
    db.from("flashcard_decks").select(DECK_COLUMNS).eq("kind", "standard").is("archived_at", null),
    lesson
  );
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return withCards(data as DeckRow | null);
}

// The deck a student uses for a lesson: their own choice if they have one,
// otherwise the lesson's standard deck.
export async function getDeckForStudent(input: Lesson & { studentId: string }): Promise<DeckWithCards | null> {
  const standard = await getStandardDeck(input);
  const { data, error } = await forLesson(
    db.from("student_deck_choice").select("deck_id").eq("student_id", input.studentId),
    input
  ).maybeSingle();
  if (error) throw error;
  const chosenId = (data as { deck_id: string } | null)?.deck_id;
  const chosen = chosenId ? await getDeckById(chosenId) : null;
  return pickDeck({ studentId: input.studentId, chosen, standard });
}

// A student's own personal and extra decks for a lesson, newest first.
export async function listStudentDecks(input: Lesson & { studentId: string }): Promise<Deck[]> {
  const { data, error } = await forLesson(
    db.from("flashcard_decks").select(DECK_COLUMNS).eq("owner_id", input.studentId).is("archived_at", null),
    input
  ).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DeckRow[]).map(toDeck);
}

export async function createDeck(input: {
  kind: DeckKind;
  ownerId?: string | null;
  topicId: string;
  subtopicId?: string | null;
  cards: Card[];
  title?: string | null;
  sourceDeckId?: string | null;
}): Promise<string> {
  const { data, error } = await db
    .from("flashcard_decks")
    .insert({
      kind: input.kind,
      owner_id: input.kind === "standard" ? null : input.ownerId,
      topic_id: input.topicId,
      subtopic_id: input.subtopicId ?? null,
      title: input.title ?? null,
      source_deck_id: input.sourceDeckId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const deckId = (data as { id: string }).id;
  const rows = cardRows(deckId, input.cards);
  if (rows.length === 0) {
    await db.from("flashcard_decks").delete().eq("id", deckId);
    throw new Error("A deck needs at least one good card.");
  }
  const { error: cardsError } = await db.from("flashcards").insert(rows);
  if (cardsError) {
    await db.from("flashcard_decks").delete().eq("id", deckId);
    throw cardsError;
  }
  return deckId;
}

export async function linkLessonsToDeck(lesson: Lesson, deckId: string): Promise<void> {
  const { error } = await forLesson(db.from("lessons").update({ deck_id: deckId }).is("class_id", null), lesson);
  if (error) throw error;
}

// The lesson's one standard deck: any current one is retired (kept, not deleted)
// and the lesson is pointed at the new one.
export async function replaceStandardDeck(lesson: Lesson, cards: Card[]): Promise<string> {
  const { error: archiveError } = await forLesson(
    db.from("flashcard_decks").update({ archived_at: new Date().toISOString() }).eq("kind", "standard").is("archived_at", null),
    lesson
  );
  if (archiveError) throw archiveError;
  const deckId = await createDeck({ kind: "standard", ...lesson, cards });
  await linkLessonsToDeck(lesson, deckId);
  return deckId;
}

export async function setStudentDeckChoice(input: Lesson & { studentId: string; deckId: string }): Promise<void> {
  await clearStudentDeckChoice(input);
  const { error } = await db.from("student_deck_choice").insert({
    student_id: input.studentId,
    topic_id: input.topicId,
    subtopic_id: input.subtopicId ?? null,
    deck_id: input.deckId,
  });
  if (error) throw error;
}

export async function clearStudentDeckChoice(input: Lesson & { studentId: string }): Promise<void> {
  const { error } = await forLesson(db.from("student_deck_choice").delete().eq("student_id", input.studentId), input);
  if (error) throw error;
}

export async function archiveDeck(deckId: string, ownerId: string): Promise<void> {
  const { error } = await db
    .from("flashcard_decks")
    .update({ archived_at: new Date().toISOString(), share_token: null })
    .eq("id", deckId)
    .eq("owner_id", ownerId);
  if (error) throw error;
}

// Adds a personal or extra deck for a student and, by default, makes it the one
// they use for the lesson. A student keeps a few of each kind; the oldest is
// retired to stay within the limit.
export async function addStudentDeck(input: Lesson & {
  kind: Exclude<DeckKind, "standard">;
  studentId: string;
  cards: Card[];
  title?: string | null;
  sourceDeckId?: string | null;
  makeActive?: boolean;
}): Promise<string> {
  const active = (await listStudentDecks(input)).filter((d) => d.kind === input.kind);
  // An extra (remedial) deck is a single live set: a new one replaces the last.
  const limit = input.kind === "remedial" ? 1 : undefined;
  for (const id of decksToArchive(active.map((d) => ({ id: d.id, createdAt: d.createdAt })), limit)) {
    await archiveDeck(id, input.studentId);
  }
  const deckId = await createDeck({ ...input, ownerId: input.studentId });
  if (input.makeActive !== false) await setStudentDeckChoice({ ...input, deckId });
  return deckId;
}

// Sharing: the owner gets an unguessable link token; they can take it back at any time.
export async function shareDeck(deckId: string, ownerId: string): Promise<string> {
  const deck = await getDeckById(deckId);
  if (!deck || deck.ownerId !== ownerId || deck.kind === "standard" || deck.archivedAt) {
    throw new Error("Deck not found.");
  }
  if (deck.shareToken) return deck.shareToken;
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = newShareToken();
    const { error } = await db.from("flashcard_decks").update({ share_token: token }).eq("id", deckId).eq("owner_id", ownerId);
    if (!error) return token;
  }
  throw new Error("Could not create a share link. Try again.");
}

export async function unshareDeck(deckId: string, ownerId: string): Promise<void> {
  const { error } = await db.from("flashcard_decks").update({ share_token: null }).eq("id", deckId).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function getDeckByShareToken(token: string): Promise<DeckWithCards | null> {
  if (!isShareToken(token)) return null;
  const { data, error } = await db
    .from("flashcard_decks")
    .select(DECK_COLUMNS)
    .eq("share_token", token)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return withCards(data as DeckRow | null);
}

// Someone opens a share link and adds the deck: they get their own copy (the
// owner's later edits or deletion never touch it).
export async function addSharedDeck(input: { token: string; studentId: string; makeActive?: boolean }): Promise<string | null> {
  const shared = await getDeckByShareToken(input.token);
  if (!shared) return null;
  if (shared.ownerId === input.studentId) return shared.id;
  return addStudentDeck({
    kind: "personal",
    studentId: input.studentId,
    topicId: shared.topicId,
    subtopicId: shared.subtopicId,
    cards: shared.cards,
    title: copyTitle(shared.title),
    sourceDeckId: shared.id,
    makeActive: input.makeActive ?? false,
  });
}

// For copying a whole subject: its standard decks, mapped onto the new topics and subtopics.
export async function copyStandardDecks(input: {
  sourceTopicIds: string[];
  topicIdMap: Map<string, string>;
  subtopicIdMap: Map<string, string>;
}): Promise<void> {
  const { data, error } = await db
    .from("flashcard_decks")
    .select("id, topic_id, subtopic_id")
    .eq("kind", "standard")
    .is("archived_at", null)
    .in("topic_id", input.sourceTopicIds);
  if (error) throw error;
  for (const d of (data ?? []) as { id: string; topic_id: string; subtopic_id: string | null }[]) {
    const topicId = input.topicIdMap.get(d.topic_id);
    const subtopicId = d.subtopic_id ? input.subtopicIdMap.get(d.subtopic_id) ?? null : null;
    if (!topicId || (d.subtopic_id && !subtopicId)) continue;
    const cards = await cardsOf(d.id);
    if (cards.length) await replaceStandardDeck({ topicId, subtopicId }, cards);
  }
}
