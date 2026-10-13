import { AiLoading } from "@/components/ai-loading";

export default function StartResultsLoading() {
  return (
    <AiLoading
      title="Working out your results"
      messages={["Marking your answers…", "Mapping what you know…", "Nearly there…"]}
    />
  );
}
