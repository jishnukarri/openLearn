import "server-only";
import { db } from "./database-client";
import { deleteFile } from "@/lib/appwrite/storage";

// Every table that holds a row per student, and the column that points at them.
// Used for "download my data" (right of access / portability). A table that
// does not exist in a given deployment is skipped, never an error.
const STUDENT_TABLES: { table: string; column: string }[] = [
  { table: "student_subjects", column: "student_id" },
  { table: "class_members", column: "student_id" },
  { table: "topic_completions", column: "student_id" },
  { table: "subtopic_completions", column: "student_id" },
  { table: "student_answers", column: "student_id" },
  { table: "question_sessions", column: "student_id" },
  { table: "question_session_attempts", column: "student_id" },
  { table: "knowledge_model", column: "student_id" },
  { table: "lesson_check_misses", column: "student_id" },
  { table: "diagnostic_sessions", column: "student_id" },
  { table: "practice_uploads", column: "student_id" },
  { table: "onboarding_progress", column: "profile_id" },
  { table: "student_deck_choice", column: "student_id" },
];

export async function exportPersonalData(profileId: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  const { data: profile } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  out.profile = profile ?? null;
  for (const { table, column } of STUDENT_TABLES) {
    const { data, error } = await db.from(table).select("*").eq(column, profileId);
    if (!error) out[table] = data ?? [];
  }
  // The student's own flashcard decks (personal and extra), with their cards.
  // Standard decks are shared course content, not personal data.
  const { data: decks, error: decksError } = await db.from("flashcard_decks").select("*").eq("owner_id", profileId);
  if (!decksError) {
    const ids = (decks ?? []).map((d: { id: string }) => d.id);
    const { data: cards } = ids.length ? await db.from("flashcards").select("*").in("deck_id", ids).order("position") : { data: [] };
    out.flashcard_decks = (decks ?? []).map((d: { id: string }) => ({
      ...d,
      cards: (cards ?? []).filter((c: { deck_id: string }) => c.deck_id === d.id),
    }));
  }
  return out;
}

// Photographed answers live in file storage, outside the database, so deleting
// the profile row alone would leave them behind. Remove them first.
export async function deleteUploadedFiles(profileId: string): Promise<number> {
  const { data } = await db.from("practice_uploads").select("image_paths").eq("student_id", profileId);
  const ids = (data ?? []).flatMap((r: { image_paths: string[] | null }) => r.image_paths ?? []);
  const results = await Promise.allSettled(ids.map((id) => deleteFile(id)));
  return results.filter((r) => r.status === "fulfilled").length;
}
