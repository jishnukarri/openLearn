import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { resolveFlashcards } from "@/app/actions/flashcards";
import { PageShell, PageHeader, AsideBlock } from "@/components/page-shell";
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
        title={<>{topic.name}, flashcards</>}
        description={topic.subject.name}
      />

      <FlashcardDeck topicId={topicId} cards={set.cards} />
    </PageShell>
  );
}
