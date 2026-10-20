// Seeded, pure shuffling for lesson checks. The same seed always gives the same
// order (so server and client renders agree), and a new seed gives a new one.

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for ordering options. */
export function seededRng(seed: string): () => number {
  let a = hashSeed(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates over a copy. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rnd = seededRng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ANCHOR = /^\s*(all|both|none|neither|any)\s+of\s+(the\s+)?(above|these|them)\b|^\s*(all|none) of the above\b|^\s*both\s+\(?[a-e]\)?\s+and\s+\(?[a-e]\)?\b|^\s*(a|b|c|d)\s+and\s+(b|c|d|e)\s*$/i;
const NUMERIC = /^\s*[-+]?[\d.,]+(\s*(to|-|–|—)\s*[-+]?[\d.,]+)?\s*[a-z%°£$€/²³]*\s*$/i;
const ORDERING_Q = /\b(in order|order of|put .{0,40} in|arrange|sequence|rank|first,? then|chronolog|ascending|descending|smallest to|largest to)\b/i;

/** Options whose position carries meaning, so they must not move. */
export function shouldShuffleOptions(question: string, options: readonly string[]): boolean {
  if (options.length < 2) return false;
  if (ORDERING_Q.test(question)) return false;
  const free = options.filter((o) => !ANCHOR.test(o));
  if (free.length < 2) return false;
  if (free.every((o) => NUMERIC.test(o))) return false;
  return true;
}

export type ShuffledOptions = {
  options: string[];
  /** order[displayedIndex] = original index */
  order: number[];
  /** Original index -> displayed index. */
  position: number[];
};

/**
 * Shuffle options for one attempt. "All of the above" style options stay last
 * (in their original relative order); numeric/range options and ordering
 * questions are left alone. Map correct answers with `position`.
 */
export function shuffleOptions(question: string, options: readonly string[], seed: string): ShuffledOptions {
  const identity = options.map((_, i) => i);
  let order = identity;
  if (shouldShuffleOptions(question, options)) {
    const free = identity.filter((i) => !ANCHOR.test(options[i]));
    const anchored = identity.filter((i) => ANCHOR.test(options[i]));
    order = [...seededShuffle(free, seed), ...anchored];
  }
  const position = new Array<number>(options.length);
  order.forEach((orig, shown) => (position[orig] = shown));
  return { options: order.map((i) => options[i]), order, position };
}

/** Seed for one attempt at one step; `visit` bumps when the student comes back. */
export function attemptSeed(scope: string, section: number, attempt: number, visit: number): string {
  return `${scope}|${section}|${attempt}|${visit}`;
}
