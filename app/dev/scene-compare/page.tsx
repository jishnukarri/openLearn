import { notFound } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LessonScene } from "@/components/lesson-scene";
import type { Scene } from "@/lib/lesson-scene";

// Development-only: shows the output of scripts/compare-scene-models.ts.
export const dynamic = "force-dynamic";

type Result = {
  model: string;
  ok: boolean;
  error?: string;
  ms: number;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  elements?: number;
  steps?: number;
  scene?: Scene;
};

export default function SceneComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const file = join(process.cwd(), ".scene-compare/results.json");
  if (!existsSync(file)) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Scene model comparison</h1>
        <p className="mt-3 text-base text-muted">
          No results yet. Run <code>bun scripts/compare-scene-models.ts</code> first.
        </p>
      </main>
    );
  }
  const data = JSON.parse(readFileSync(file, "utf8")) as { topic: string; at: string; results: Result[] };

  return (
    <main className="mx-auto max-w-7xl p-6 sm:p-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Scene model comparison</h1>
      <p className="mt-2 max-w-[70ch] text-base text-muted">{data.topic}</p>
      <p className="mt-1 text-sm text-muted">Generated {new Date(data.at).toLocaleString()}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {data.results.map((r) => (
          <section key={r.model} className="flex flex-col gap-3" aria-label={r.model}>
            <header className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{r.model}</h2>
              <p className="text-sm text-muted">
                {r.ok ? "Valid scene" : `Failed: ${r.error}`} · {(r.ms / 1000).toFixed(1)}s
                {r.costUsd != null ? ` · $${r.costUsd.toFixed(5)}` : ""}
                {r.completionTokens != null ? ` · ${r.completionTokens} output tokens` : ""}
                {r.reasoningTokens ? ` (${r.reasoningTokens} reasoning)` : ""}
                {r.ok ? ` · ${r.steps} steps, ${r.elements} elements` : ""}
              </p>
            </header>
            {r.ok && r.scene ? <LessonScene scene={r.scene} label={`Scene from ${r.model}`} /> : null}
          </section>
        ))}
      </div>
    </main>
  );
}
