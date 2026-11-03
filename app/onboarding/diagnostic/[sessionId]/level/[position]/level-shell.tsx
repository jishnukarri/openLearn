import { ProgressBar } from "@/components/progress-bar";
import { Rise, Stagger } from "@/components/motion";

const TOPIC_INTROS = [
  "Let's see what you remember about",
  "A few questions on",
  "Time to check your knowledge of",
];

// The topic as it reads inside a sentence: "Topic 1: Computational thinking"
// becomes "computational thinking", and a trailing "(physics only)" is dropped.
// Only an ordinary capitalised word is lowercased, so DNA or ASCII stay as written.
export function topicInSentence(name: string): string {
  const bare = name.replace(/^topic\s+\d+\s*[:.\-–]\s*/i, "").replace(/\s*\((?:[^)]*only|[^)]*higher|[^)]*triple)[^)]*\)\s*$/i, "").trim();
  return /^[A-Z][a-z]/.test(bare) ? bare[0].toLowerCase() + bare.slice(1) : bare;
}

// Shared frame for a diagnostic question (signed-in and guest). Desktop puts
// the question on the left and the answer on the right so both sit in view;
// below lg they stack, question first.
export function LevelShell({
  position,
  total,
  unitLabel,
  topicName,
  prompt,
  showPrompt,
  maxMarks,
  children,
}: {
  position: number;
  total: number;
  unitLabel: "Level" | "Question";
  topicName: string | null;
  prompt: string;
  // fill_blank embeds the answer input inline inside the prompt itself
  // (see LevelForm), so the heading is hidden for that type.
  showPrompt: boolean;
  maxMarks: number;
  children: React.ReactNode;
}) {
  const intro = TOPIC_INTROS[position % TOPIC_INTROS.length];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 lg:py-14">
      <Stagger className="flex flex-col gap-8 lg:gap-12">
        <Rise className="flex flex-col gap-2">
          <ProgressBar value={position} max={total} />
          <p className="text-sm text-muted">
            {unitLabel} {position + 1} of {total}
            {topicName ? ` · ${topicName}` : ""}
          </p>
        </Rise>

        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <Rise className="flex flex-col gap-3">
            {topicName && (
              <p className="text-sm text-muted">
                {intro} {topicInSentence(topicName)}.
              </p>
            )}
            {showPrompt && (
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug text-foreground lg:text-4xl lg:leading-[1.15]">
                {prompt}
              </h1>
            )}
            <p className="font-[family-name:var(--font-mono)] text-sm text-highlight">
              {maxMarks} {maxMarks === 1 ? "mark" : "marks"}
            </p>
          </Rise>
          <Rise>{children}</Rise>
        </div>
      </Stagger>
    </main>
  );
}
