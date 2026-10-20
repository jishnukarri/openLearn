import { normaliseWord, stem } from "./spelling";

export type CardLike = { front: string; back: string };

export type CardVerdict = { ok: true } | { ok: false; reason: string };

export const MAX_BACK_WORDS = 25;
export const MAX_FRONT_WORDS_STATEMENT = 12;
/** Below this many surviving cards a deck is treated as too poor to show. */
export const MIN_DECK_CARDS = 3;

const FILLER = new Set([
  "a", "an", "the", "of", "to", "in", "on", "and", "or", "is", "are", "it", "its", "that", "this",
  "for", "as", "by", "with", "be", "was", "were", "from", "at", "what", "which", "who", "how", "why",
  "when", "where", "do", "does", "did", "define", "state", "describe", "explain", "give", "name",
]);

const LESSON_REF =
  /\b(the (lesson|text|passage|section|example|diagram|figure) (above|below)|as (shown|seen|described|mentioned|discussed)( (above|below|earlier|previously))?|(see|shown|described|mentioned|discussed) (above|below)|in this (lesson|section|topic|chapter)|(above|below) (lesson|text|diagram|example)|the lesson|earlier in the lesson)\b/i;
const DEFINITION_PATTERN =
  /\b(is|are|was|means|mean|refers? to|called|known as|occurs?|happens?|when|where|which|that|used|measures?|describes?|stands? for|equals?|of|per|between|across|process|measure|amount|number|type|study|ability|rate|force|change|movement|unit|substance|=)\b|[:=]/i;

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function contentTokens(s: string): string[] {
  return normaliseWord(s)
    .split(" ")
    .filter((w) => w.length > 1 && !FILLER.has(w))
    .map(stem);
}

/** Levenshtein-ish tolerance via stem equality or shared 5-char prefix (spelling-insensitive). */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true;
  return false;
}

export function normaliseForDedupe(s: string): string {
  return contentTokens(s).join(" ") || normaliseWord(s);
}

export function validateCard(card: CardLike): CardVerdict {
  const front = (card?.front ?? "").trim();
  const back = (card?.back ?? "").trim();
  if (!front) return { ok: false, reason: "empty front" };
  if (!back) return { ok: false, reason: "empty back" };

  const backWords = words(back);
  if (backWords.length > MAX_BACK_WORDS + 5) return { ok: false, reason: "answer too long" };
  if (back.length < 2) return { ok: false, reason: "answer too short" };

  const nf = normaliseWord(front);
  const nb = normaliseWord(back);
  if (nf === nb) return { ok: false, reason: "back repeats front" };
  const ft = contentTokens(front);
  const bt = contentTokens(back);
  if (ft.length > 0 && bt.every((t) => ft.some((f) => tokensMatch(f, t)))) {
    return { ok: false, reason: "back repeats front" };
  }

  if (LESSON_REF.test(back) || LESSON_REF.test(front)) {
    return { ok: false, reason: "refers to the lesson" };
  }
  if (front.includes("?") && /\b(this|these|above|below)\b/i.test(front)) {
    return { ok: false, reason: "front has unresolved reference" };
  }
  if (/^(this|these|those|it|they)\b/i.test(front)) {
    return { ok: false, reason: "front has unresolved reference" };
  }

  const isQuestion = front.includes("?");
  const frontWords = words(front);
  if (!isQuestion && frontWords.length > MAX_FRONT_WORDS_STATEMENT) {
    return { ok: false, reason: "front is a sentence, not a term" };
  }
  if (!isQuestion && /[.!]$/.test(front) && frontWords.length > 6) {
    return { ok: false, reason: "front is a sentence, not a term" };
  }
  if (back.endsWith("…") || back.endsWith("...")) {
    return { ok: false, reason: "answer is truncated" };
  }

  if (!isQuestion) {
    // term -> definition: the answer must define the term.
    const termTokens = contentTokens(front);
    const backTokens = contentTokens(back);
    const overlap = termTokens.some((t) => backTokens.some((b) => tokensMatch(t, b)));
    const isDefinition = DEFINITION_PATTERN.test(back);
    const answerStartsOwnSentence = /^[A-Z][^.]*\b(is|are|was|were|has|have)\b/.test(back) && overlap === false;
    if (!overlap && !isDefinition && backWords.length > 5) return { ok: false, reason: "answer does not define the term" };
    if (answerStartsOwnSentence && termTokens.length > 0 && backWords.length > 12) {
      return { ok: false, reason: "answer is about a different topic" };
    }
  }
  return { ok: true };
}

/** Drop invalid and duplicate cards; preserves order. */
export function filterCards<T extends CardLike>(cards: readonly T[] | null | undefined): T[] {
  const seenFront = new Set<string>();
  const seenPair = new Set<string>();
  const out: T[] = [];
  for (const c of cards ?? []) {
    if (!c || typeof c.front !== "string" || typeof c.back !== "string") continue;
    if (!validateCard(c).ok) continue;
    const f = normaliseForDedupe(c.front);
    const p = `${f}|${normaliseForDedupe(c.back)}`;
    if (seenFront.has(f) || seenPair.has(p)) continue;
    seenFront.add(f);
    seenPair.add(p);
    out.push(c);
  }
  return out;
}

export function isDeckUsable(cards: readonly CardLike[]): boolean {
  return cards.length >= MIN_DECK_CARDS;
}

/**
 * Lesson vocabulary card from a section: heading is the term, the first
 * sentence of the explanation (trimmed to a short definition) is the answer.
 * Returns null when it would not make a genuine card.
 */
export function lessonVocabCard(heading: string, explanation: string): CardLike | null {
  const term = heading.trim().replace(/[.:]+$/, "");
  const sentences = explanation.match(/[^.!?]+[.!?]+/g) ?? [explanation];
  const cleaned = sentences.map((s) => s.trim());
  // Prefer a sentence that names the term and defines it.
  const termTokens = contentTokens(term);
  const defining = cleaned.find(
    (s) => DEFINITION_PATTERN.test(s) && contentTokens(s).some((t) => termTokens.some((x) => tokensMatch(t, x)))
  );
  const back = (defining ?? cleaned[0] ?? "").trim();
  const card = { front: term, back };
  return validateCard(card).ok ? card : null;
}
