// Word timings for a spoken script, worked out from the audio itself so no
// extra AI call is needed. The speech model gives the audio but no timestamps,
// so: find the pauses in the sound, line each sentence up with a pause, and
// spread the words inside a sentence by their length. Accurate to a fraction
// of a second, which is enough for following along.

export function splitWords(script: string): string[] {
  return script.split(/\s+/).filter(Boolean);
}

function sentenceGroups(words: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const w of words) {
    current.push(w);
    if (/[.!?]["')\]]*$/.test(w)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

// Which sentence (0, 1, 2...) each word belongs to, for highlighting the line being spoken.
export function sentenceIndexes(words: string[]): number[] {
  const out: number[] = [];
  let sentence = 0;
  for (const w of words) {
    out.push(sentence);
    if (/[.!?]["')\]]*$/.test(w)) sentence++;
  }
  return out;
}

// How long a word takes to say, roughly: its letters, plus a beat after a comma.
function weight(word: string): number {
  const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
  return Math.max(1, letters) + (/[,;:]["')\]]*$/.test(word) ? 2 : 0);
}

type Gap = { start: number; end: number };

const WINDOW_SECONDS = 0.02;
const MIN_GAP_SECONDS = 0.2;
const SILENCE_RATIO = 0.05; // of the loudest 20 ms window

function analyse(samples: Int16Array, rate: number): { speechStart: number; speechEnd: number; gaps: Gap[] } {
  const win = Math.max(1, Math.round(rate * WINDOW_SECONDS));
  const levels: number[] = [];
  for (let i = 0; i + win <= samples.length; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j];
    levels.push(Math.sqrt(sum / win));
  }
  const loudest = Math.max(0, ...levels);
  const quiet = levels.map((l) => l < loudest * SILENCE_RATIO);
  const first = quiet.indexOf(false);
  const last = quiet.lastIndexOf(false);
  if (first < 0) return { speechStart: 0, speechEnd: samples.length / rate, gaps: [] };

  const gaps: Gap[] = [];
  let runStart = -1;
  for (let i = first; i <= last + 1; i++) {
    if (i <= last && quiet[i]) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      if ((i - runStart) * WINDOW_SECONDS >= MIN_GAP_SECONDS) gaps.push({ start: runStart * WINDOW_SECONDS, end: i * WINDOW_SECONDS });
      runStart = -1;
    }
  }
  return { speechStart: first * WINDOW_SECONDS, speechEnd: (last + 1) * WINDOW_SECONDS, gaps };
}

// Start time in milliseconds of every word in `splitWords(script)`.
export function wordStartTimes(script: string, samples: Int16Array, rate: number): number[] {
  const words = splitWords(script);
  if (!words.length) return [];
  const groups = sentenceGroups(words);
  const { speechStart, speechEnd, gaps } = analyse(samples, rate);
  const span = Math.max(0.1, speechEnd - speechStart);

  const weights = groups.map((g) => g.reduce((a, w) => a + weight(w), 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Boundary k sits between sentence k and k+1: the nearest pause to where it
  // should fall by length, else just that expected spot.
  const ends: number[] = [];
  const starts: number[] = [speechStart];
  let before = 0;
  let minMid = -Infinity;
  for (let k = 0; k < groups.length - 1; k++) {
    before += weights[k];
    const expected = speechStart + (before / totalWeight) * span;
    let best: Gap | null = null;
    for (const g of gaps) {
      const mid = (g.start + g.end) / 2;
      if (mid <= minMid) continue;
      if (Math.abs(mid - expected) > span * 0.25) continue;
      if (!best || Math.abs(mid - expected) < Math.abs((best.start + best.end) / 2 - expected)) best = g;
    }
    if (best) {
      ends.push(best.start);
      starts.push(best.end);
      minMid = (best.start + best.end) / 2;
    } else {
      ends.push(expected);
      starts.push(expected);
      minMid = expected;
    }
  }
  ends.push(speechEnd);

  const out: number[] = [];
  const spread = (ws: string[], from: number, to: number) => {
    const total = ws.reduce((a, w) => a + weight(w), 0) || 1;
    let acc = 0;
    for (const w of ws) {
      out.push(Math.round((from + (acc / total) * Math.max(0, to - from)) * 1000));
      acc += weight(w);
    }
  };

  groups.forEach((group, i) => {
    const segStart = starts[i];
    const segEnd = Math.max(segStart, ends[i]);
    const total = weights[i];
    const len = segEnd - segStart;
    // Pauses inside a sentence (a clause break, a breath) pin down the word that follows them.
    const inside = gaps.filter((g) => g.start > segStart + 0.05 && g.end < segEnd - 0.05);
    let from = 0;
    let cursor = segStart;
    for (const g of inside) {
      const mid = (g.start + g.end) / 2;
      let bestB = -1;
      let bestScore = Infinity;
      let cum = group.slice(0, from).reduce((a, w) => a + weight(w), 0);
      for (let b = from + 1; b < group.length; b++) {
        cum += weight(group[b - 1]);
        const expected = segStart + (cum / total) * len;
        const punctuated = /[,;:]["')\]]*$/.test(group[b - 1]);
        const score = Math.abs(expected - mid) - (punctuated ? 0.15 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestB = b;
        }
      }
      if (bestB < 0 || bestScore > 0.6) continue;
      spread(group.slice(from, bestB), cursor, g.start);
      cursor = g.end;
      from = bestB;
    }
    spread(group.slice(from), cursor, segEnd);
  });
  return out;
}

// Index of the word being spoken at `timeMs`, or -1 before the first word.
export function activeWord(starts: number[], timeMs: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= timeMs) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
