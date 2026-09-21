import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { resolveFlashcards } from "@/app/actions/flashcards";
import { FlashcardDeck } from "./flashcard-deck";

export default async function FlashcardsPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { topicId } = await params;

  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const set = await resolveFlashcards(topicId);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-xs text-highlight">
          Previewing as {profile.role}.
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {topic.subject.name}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          {topic.name}, Flashcards
        </h1>
      </div>

      <FlashcardDeck topicId={topicId} cards={set.cards} />
    </main>
  );
}
