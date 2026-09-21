import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getSubtopic } from "@/lib/supabase/topics";
import { resolveFlashcardsForSubtopic } from "@/lib/subtopic-content";
import { FlashcardDeck } from "../../[topicId]/flashcard-deck";

export default async function SubtopicFlashcardsPage({
  params,
}: {
  params: Promise<{ subtopicId: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { subtopicId } = await params;

  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) notFound();

  const set = await resolveFlashcardsForSubtopic(subtopic, profile.id);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-xs text-highlight">
          Previewing as {profile.role}.
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {subtopic.topic.subject.name}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          {subtopic.name}, Flashcards
        </h1>
      </div>

      <FlashcardDeck
        topicId={subtopicId}
        cards={set.cards}
        lessonHref={`/learn/subtopic/${subtopicId}`}
      />
    </main>
  );
}
