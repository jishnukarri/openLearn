// Pure helpers for the student progress views. No I/O, so they stay testable.

export const INACTIVE_DAYS = 7;
export const LOW_MASTERY = 0.5;
export const ACTIVITY_WINDOW_DAYS = 30;

export type AttentionReason = "inactive" | "low-mastery" | "never-started";

export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

export function latestTimestamp(values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t) && t > bestT) {
      bestT = t;
      best = v;
    }
  }
  return best;
}

export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Why a student deserves a teacher's attention. Empty means on track.
export function attentionReasons(input: {
  lastActive: string | null;
  avgScore: number | null;
  now?: Date;
}): AttentionReason[] {
  const out: AttentionReason[] = [];
  const idle = daysSince(input.lastActive, input.now);
  if (idle === null) out.push("never-started");
  else if (idle >= INACTIVE_DAYS) out.push("inactive");
  if (input.avgScore !== null && input.avgScore < LOW_MASTERY) out.push("low-mastery");
  return out;
}

export const ATTENTION_LABEL: Record<AttentionReason, string> = {
  inactive: "Hasn't studied for over a week",
  "low-mastery": "Struggling across topics",
  "never-started": "Hasn't started yet",
};

export type DayPoint = { day: string; attempts: number; percent: number | null };

// Buckets answers into one point per day for the last `days` days (oldest first).
export function bucketActivity(
  answers: { created_at: string; marks_awarded: number | null; max_marks: number | null }[],
  days = ACTIVITY_WINDOW_DAYS,
  now: Date = new Date()
): DayPoint[] {
  const points: { day: string; attempts: number; got: number; max: number }[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    index.set(d, points.length);
    points.push({ day: d, attempts: 0, got: 0, max: 0 });
  }
  for (const a of answers) {
    const i = index.get(a.created_at.slice(0, 10));
    if (i === undefined) continue;
    points[i].attempts += 1;
    points[i].got += a.marks_awarded ?? 0;
    points[i].max += a.max_marks ?? 0;
  }
  return points.map((p) => ({
    day: p.day,
    attempts: p.attempts,
    percent: p.max > 0 ? Math.round((p.got / p.max) * 100) : null,
  }));
}
