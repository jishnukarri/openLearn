import { AiLoading } from "@/components/ai-loading";

export default function DiagnosticLevelLoading() {
  return (
    <AiLoading
      title="Loading the next level"
      messages={["Fetching your next question…"]}
    />
  );
}
