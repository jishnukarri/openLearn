// Orders a student's unfinished topics using their diagnostic results, so
// the dashboard and subject pages lead with what they most need instead of
// whichever subject happens to be listed first.
export type RankableTopic = {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
};

export type Reason = "weak" | "unscored" | "medium" | "strong";

export type RankedTopic = RankableTopic & { score: number | null; reason: Reason };

export const scoreKey = (subjectId: string, topicName: string) => `${subjectId}:${topicName}`;

const BUCKET: Record<Reason, number> = { weak: 0, unscored: 1, medium: 2, strong: 3 };

function reasonFor(score: number | null): Reason {
  if (score === null) return "unscored";
  if (score < 0.6) return "weak";
  if (score >= 0.8) return "strong";
  return "medium";
}

// Per subject: weakest first, then topics not yet assessed (in syllabus
// order), then middling, with strong topics last. Across subjects: the best
// candidate from each subject in turn, so no one subject floods the list.
export function rankTopics(
  topics: RankableTopic[],
  scores: Map<string, number>,
  completed: Set<string>
): RankedTopic[] {
  const bySubject = new Map<string, RankedTopic[]>();
  topics.forEach((t) => {
    if (completed.has(t.id)) return;
    const score = scores.get(scoreKey(t.subjectId, t.name)) ?? null;
    const list = bySubject.get(t.subjectId) ?? [];
    list.push({ ...t, score, reason: reasonFor(score) });
    bySubject.set(t.subjectId, list);
  });

  for (const list of bySubject.values()) {
    // Array.prototype.sort is stable, so syllabus order survives ties.
    list.sort((a, b) => {
      const bucket = BUCKET[a.reason] - BUCKET[b.reason];
      if (bucket !== 0) return bucket;
      return (a.score ?? 0) - (b.score ?? 0);
    });
  }

  const lists = [...bySubject.values()];
  const picks = new Map<RankedTopic[], number>(lists.map((l) => [l, 0]));
  const out: RankedTopic[] = [];
  while (lists.some((l) => l.length > 0)) {
    const live = lists.filter((l) => l.length > 0);
    live.sort((a, b) => {
      const bucket = BUCKET[a[0].reason] - BUCKET[b[0].reason];
      if (bucket !== 0) return bucket;
      return (picks.get(a) ?? 0) - (picks.get(b) ?? 0);
    });
    const chosen = live[0];
    out.push(chosen.shift()!);
    picks.set(chosen, (picks.get(chosen) ?? 0) + 1);
  }
  return out;
}
