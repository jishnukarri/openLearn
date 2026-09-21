import { AiLoading } from "@/components/ai-loading";

export default function SubtopicPracticeLoading() {
  return (
    <AiLoading
      title="Preparing your question"
      messages={["Reading the topic…", "Writing a fresh question…", "Nearly there…"]}
    />
  );
}
