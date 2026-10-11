import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getSubtopic } from "@/lib/supabase/topics";
import { resolveFlashcardsForSubtopic } from "@/lib/subtopic-content";
import { PageShell, PageHeader, AsideBlock } from "@/components/page-shell";
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

  const aside = (
    <>
      <AsideBlock title="How rating works">
        <p><span className="font-medium text-error">Hard</span> brings the card back after the next one.</p>
        <p><span className="font-medium text-primary">Good</span> moves on and schedules a later review.</p>
        <p><span className="font-medium text-success">Easy</span> marks it learned and removes it from the deck.</p>
      </AsideBlock>
      <AsideBlock title="This deck">
        <p>{set.cards.length} {set.cards.length === 1 ? "card" : "cards"}. Tap a card to flip it, then rate how well you knew it.</p>
      </AsideBlock>
    </>
  );

  return (
    <PageShell size="form" aside={aside}>
      {profile.role !== "student" && (
        <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-sm text-highlight">
          Previewing as {profile.role}.
        </div>
      )}
      <PageHeader
        title={<>{subtopic.name}, flashcards</>}
        description={subtopic.topic.subject.name}
      />

      <FlashcardDeck
        topicId={subtopicId}
        cards={set.cards}
        lessonHref={`/learn/subtopic/${subtopicId}`}
      />
    </PageShell>
  );
}
