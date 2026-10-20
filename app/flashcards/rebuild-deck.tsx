import { Button } from "@/components/button";
import { regenerateFlashcardsAction } from "@/app/actions/flashcards";

// Shown instead of a poor deck: too few cards survived the quality check.
export function RebuildDeck({ topicId, subtopicId }: { topicId: string; subtopicId?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 text-base">
      <p className="font-medium">This deck needs rebuilding.</p>
      <p className="mt-1 text-muted">
        Too many of its cards were unclear, so we are not showing them. Rebuilding makes a fresh set.
      </p>
      <form action={regenerateFlashcardsAction} className="mt-4">
        <input type="hidden" name="topicId" value={topicId} />
        {subtopicId && <input type="hidden" name="subtopicId" value={subtopicId} />}
        <Button type="submit">Rebuild this deck</Button>
      </form>
    </div>
  );
}
