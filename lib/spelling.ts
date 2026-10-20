import { KEY_TERM_SET } from "./key-terms";

/*
 * Spelling tolerance for written answers (pure; no server-only imports).
 *
 * RULE (after normalisation + light stemming of both words):
 *  - Ordinary words: length <=3 exact; 4-6 chars: <=1 edit; 7+ chars: <=2 edits.
 *    An edit is an insertion, deletion, substitution or adjacent transposition
 *    (Damerau-Levenshtein, optimal string alignment).
 *  - Key terms (see isKeyTerm): exact, OR exactly 1 edit when the word is >=8
 *    chars (e.g. "osmosys"-style slips on long terms; "osmosis" has 7 so must be
 *    exact), AND the typed word must be strictly closer to the expected term
 *    than to any other known key term (so mitosis/meiosis never pass).
 *    A near-miss key term still earns the mark but returns exact:false so the
 *    caller can show "Check the spelling of ...".
 */

export function normaliseWord(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Light stemming: plurals, -ing, -ed. Only applied to words long enough to keep a root.
export function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// Damerau-Levenshtein (optimal string alignment).
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

export function ordinaryTolerance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

export type KeyTermContext = {
  subject?: string;
  /** Mark scheme point text; quoted/emphasised words ("x", *x*, **x**, `x`) are key. */
  markSchemeText?: string;
  /** The expected answer of a fill-blank question. */
  fillBlankExpected?: boolean;
};

const SCIENCE_SUBJECT = /\b(science|biology|chemistry|physics|computer|computing|maths?|mathematics)\b/i;

export function isKeyTerm(term: string, context: KeyTermContext = {}): boolean {
  const t = normaliseWord(term);
  if (!t) return false;
  if (KEY_TERM_SET.has(t) || KEY_TERM_SET.has(stem(t))) return true;
  if (context.markSchemeText) {
    const re = /"([^"]+)"|“([^”]+)”|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(context.markSchemeText))) {
      const q = normaliseWord(m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "");
      if (q && (q === t || q.split(" ").includes(t))) return true;
    }
  }
  if (context.fillBlankExpected && context.subject && SCIENCE_SUBJECT.test(context.subject)) {
    return true;
  }
  return false;
}

export type SpellingMatch = { matched: boolean; exact: boolean };

function matchWord(student: string, expected: string, keyTerm: boolean): SpellingMatch {
  const s = normaliseWord(student);
  const e = normaliseWord(expected);
  if (s === e) return { matched: true, exact: true };
  const ss = stem(s);
  const es = stem(e);
  if (ss === es) return { matched: true, exact: true };
  const dist = damerauLevenshtein(ss, es);
  if (keyTerm) {
    if (dist !== 1 || e.length < 8) return { matched: false, exact: false };
    for (const other of KEY_TERM_SET) {
      if (other === e || stem(other) === es) continue;
      if (damerauLevenshtein(ss, stem(other)) <= dist) return { matched: false, exact: false };
    }
    return { matched: true, exact: false };
  }
  const tol = ordinaryTolerance(Math.max(ss.length, es.length));
  return dist <= tol ? { matched: true, exact: false } : { matched: false, exact: false };
}

/**
 * Compare a student's word/phrase with the expected one. Phrases are compared
 * token by token (same token count); each token is key-term-checked when
 * opts.keyTerm is true or the token is itself in the curated set.
 * matched && !exact on a key term means "correct but check the spelling".
 */
export function matchesExpected(
  studentWord: string,
  expected: string,
  opts: { keyTerm?: boolean; context?: KeyTermContext } = {}
): SpellingMatch & { misspelledKeyTerm?: string } {
  const st = normaliseWord(studentWord).split(" ").filter(Boolean);
  const ex = normaliseWord(expected).split(" ").filter(Boolean);
  if (!st.length || st.length !== ex.length) return { matched: false, exact: false };
  let exact = true;
  let misspelledKeyTerm: string | undefined;
  for (let i = 0; i < ex.length; i++) {
    const key = !!opts.keyTerm || isKeyTerm(ex[i], opts.context);
    const r = matchWord(st[i], ex[i], key);
    if (!r.matched) return { matched: false, exact: false };
    if (!r.exact) {
      exact = false;
      if (key) misspelledKeyTerm = ex[i];
    }
  }
  return { matched: true, exact, ...(misspelledKeyTerm ? { misspelledKeyTerm } : {}) };
}

export function spellingNote(term: string): string {
  return `Check the spelling of "${term}"`;
}
