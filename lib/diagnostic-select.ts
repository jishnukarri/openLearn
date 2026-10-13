// Pure topic selection for the initial diagnostic (no server-only imports so
// it can be unit-tested). The diagnostic only covers the START of each
// subject: topics are taken in syllabus order, round-robin across subjects,
// until adding another topic would push the question total past the cap.

export const DIAGNOSTIC_MAX_QUESTIONS = 30;

export const RECAP_MAX_TOPICS = 6;

export type SelectableTopic = { id: string; name: string; subject_id: string };

export function selectTopicsForDiagnostic<T extends SelectableTopic>(
  topicsBySubject: T[][],
  perTopic: number,
  cap: number = DIAGNOSTIC_MAX_QUESTIONS
): { selected: T[]; leftover: T[] } {
  const maxTopics = Math.max(0, Math.floor(cap / Math.max(1, perTopic)));
  const chosen = new Set<T>();
  const longest = Math.max(0, ...topicsBySubject.map((l) => l.length));
  outer: for (let i = 0; i < longest; i++) {
    for (const list of topicsBySubject) {
      if (i >= list.length) continue;
      if (chosen.size >= maxTopics) break outer;
      chosen.add(list[i]);
    }
  }
  // Keep each subject's syllabus order in the output.
  const selected = topicsBySubject.flat().filter((t) => chosen.has(t));
  const leftover = topicsBySubject.flat().filter((t) => !chosen.has(t));
  return { selected, leftover };
}
