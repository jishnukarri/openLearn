import { randomBytes } from "node:crypto";
import { filterCards } from "./flashcard-quality";

// Rules for flashcard decks that need no database, so they can be tested.
// See supabase/migrations/20261108_flashcard_decks.sql for the model.

export type DeckKind = "standard" | "personal" | "remedial";

export type Card = { front: string; back: string };

export type Deck = {
  id: string;
  topicId: string;
  subtopicId: string | null;
  kind: DeckKind;
  ownerId: string | null;
  title: string | null;
  sourceDeckId: string | null;
  shareToken: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type DeckWithCards = Deck & { cards: Card[] };

// A student keeps a few personal decks per lesson, one in use; a new one
// quietly retires the oldest. This bounds the AI cost of regenerating.
export const MAX_PERSONAL_DECKS = 3;

// An extra set is offered once a student has this many unresolved misses in a lesson.
export const REMEDIAL_MISS_THRESHOLD = 2;

export const remedialEligible = (unresolvedMisses: number): boolean => unresolvedMisses >= REMEDIAL_MISS_THRESHOLD;

// Which of a student's active decks must be archived so that, after adding one
// more, they are still within the limit. Oldest first.
export function decksToArchive(active: { id: string; createdAt: string }[], max = MAX_PERSONAL_DECKS): string[] {
  const room = Math.max(0, max - 1);
  const oldestFirst = [...active].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return oldestFirst.slice(0, Math.max(0, oldestFirst.length - room)).map((d) => d.id);
}

// Cards ready to insert: only well-formed ones survive, positions are 0..n-1.
export function cardRows(deckId: string, cards: Card[]): { deck_id: string; position: number; front: string; back: string }[] {
  return filterCards(cards).map((c, position) => ({ deck_id: deckId, position, front: c.front.trim(), back: c.back.trim() }));
}

// An unguessable link token: 16 random bytes, URL-safe.
export const newShareToken = (): string => randomBytes(16).toString("base64url");

export const isShareToken = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{22}$/.test(v);

// Which deck a student sees for a lesson: the one they chose, if it is still
// live and visible to them, otherwise the lesson's standard deck.
export function pickDeck<T extends { id: string; archivedAt: string | null; ownerId: string | null }>(input: {
  studentId: string;
  chosen: T | null;
  standard: T | null;
}): T | null {
  const { chosen, standard, studentId } = input;
  if (chosen && !chosen.archivedAt && chosen.ownerId === studentId) return chosen;
  return standard && !standard.archivedAt ? standard : null;
}

// What a copy of a shared deck is called for the person who adds it.
export const copyTitle = (title: string | null): string => (title?.trim() ? `${title.trim()} (shared)` : "Shared deck");

// A fresh deck should not repeat the cards of the one it stands in for.
export const avoidFronts = (existing: Card[], max = 30): string[] => existing.slice(0, max).map((c) => c.front);
