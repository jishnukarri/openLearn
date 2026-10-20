import "server-only";
import type { LessonContent } from "@/lib/ai/lessons";

// Session-only store for a student's "explain it simpler" lesson. It is never
// written to the database, so one student asking for help can't change the
// shared lesson (or a class fork) that everyone else sees.
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const store = new Map<string, { content: LessonContent; expires: number }>();

const keyOf = (studentId: string, topicId: string) => `${studentId}:${topicId}`;

export function setSimplifiedLesson(studentId: string, topicId: string, content: LessonContent): void {
  const now = Date.now();
  for (const [k, v] of store) if (v.expires < now) store.delete(k);
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  store.set(keyOf(studentId, topicId), { content, expires: now + TTL_MS });
}

export function getSimplifiedLesson(studentId: string, topicId: string): LessonContent | null {
  const hit = store.get(keyOf(studentId, topicId));
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    store.delete(keyOf(studentId, topicId));
    return null;
  }
  return hit.content;
}
