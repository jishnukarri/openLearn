import { AiLoading } from "@/components/ai-loading";

export default function SubtopicFlashcardsLoading() {
  return (
    <AiLoading
      title="Building your flashcards"
      messages={["Picking out the key terms…", "Writing quick answers…", "Nearly there…"]}
    />
  );
}
