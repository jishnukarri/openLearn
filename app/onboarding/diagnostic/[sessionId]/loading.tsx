import { AiLoading } from "@/components/ai-loading";

export default function DiagnosticLoading() {
  return (
    <AiLoading
      title="Preparing your diagnostic"
      messages={[
        "Looking at your subjects…",
        "Picking the right questions…",
        "Balancing the difficulty…",
        "Nearly there…",
      ]}
    />
  );
}
