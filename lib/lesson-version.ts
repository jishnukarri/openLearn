// The version of the lesson format. Bump it whenever lessons gain something an
// older stored lesson lacks (a new field, a new feature). The next time anyone
// opens a lesson stored at an older version, it is regenerated and the new one
// replaces it. A lesson a teacher edits or tweaks is saved at the current
// version, so their changes are never regenerated away.
//
//   1  original lessons
//   2  voiceovers with follow-along highlighting
export const LESSON_VERSION = 2;

export function isCurrentLesson(version: number | null | undefined): boolean {
  return typeof version === "number" && version >= LESSON_VERSION;
}
