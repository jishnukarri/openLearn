// Compares models on ONE animated worked-example scene (one call per model).
//
//   OPENROUTER_API_KEY=sk-or-... bun scripts/compare-scene-models.ts
//   bun scripts/compare-scene-models.ts --topic "Your topic here"
//   bun scripts/compare-scene-models.ts --models deepseek/deepseek-v4.1-flash,openai/gpt-6-luna
//
// The key is read from the environment or .env.local (OPENROUTER_API_KEY).
// Results go to .scene-compare/results.json; view them side by side, rendered
// with the real scene player, at http://localhost:3000/dev/scene-compare
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { WORKED_EXAMPLE_GUIDE } from "../lib/ai/scene-prompt";
import { parseScene, countElements, sceneStepCount } from "../lib/lesson-scene";

const DEFAULT_MODELS = [
  "deepseek/deepseek-v4.1-flash",
  "openai/gpt-6-luna",
  "google/gemini-3.8-flash",
  "moonshotai/kimi-k3",
];
const DEFAULT_TOPIC =
  "GCSE Physics, series circuits: a 12 V cell is connected to a 4 ohm and a 2 ohm resistor in series. Find the total resistance and the current (use V = I x R).";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (existsSync(".env.local")) {
    const m = readFileSync(".env.local", "utf8").match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  console.error("Set OPENROUTER_API_KEY in your shell (or .env.local) and run again.");
  process.exit(1);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? body.slice(start, end + 1) : body);
}

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
  scene?: unknown;
};

async function run(model: string, key: string, topic: string): Promise<Result> {
  const started = Date.now();
  const system =
    "You write one animated worked-example scene for a GCSE revision site. " +
    'Reply with ONLY a JSON object of the form {"exampleScene": {...}} and nothing else.' +
    WORKED_EXAMPLE_GUIDE;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "openLearn scene model comparison",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Worked example topic: ${topic}\nWrite the exampleScene now.` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
        usage: { include: true },
      }),
    });
    const ms = Date.now() - started;
    const data = await res.json();
    if (!res.ok || data.error) {
      return { model, ok: false, ms, error: `HTTP ${res.status}: ${data?.error?.message ?? JSON.stringify(data).slice(0, 200)}` };
    }
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage ?? {};
    const base = {
      model,
      ms,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
      costUsd: usage.cost,
    };
    let parsedJson: unknown;
    try {
      parsedJson = extractJson(text);
    } catch {
      return { ...base, ok: false, error: "Reply was not valid JSON" };
    }
    const raw = (parsedJson as { exampleScene?: unknown })?.exampleScene ?? parsedJson;
    const scene = parseScene(raw);
    if (!scene) return { ...base, ok: false, error: "JSON parsed but failed scene validation", scene: raw };
    return { ...base, ok: true, scene, elements: countElements(scene.elements), steps: sceneStepCount(scene) };
  } catch (e) {
    return { model, ok: false, ms: Date.now() - started, error: (e as Error).message };
  }
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: bun scripts/compare-scene-models.ts [--topic \"...\"] [--models a/b,c/d]\nNeeds OPENROUTER_API_KEY in the environment or .env.local. Makes one paid call per model.");
  process.exit(0);
}

const key = loadKey();
const topic = arg("topic") ?? DEFAULT_TOPIC;
const models = (arg("models")?.split(",") ?? DEFAULT_MODELS).map((m) => m.trim());

console.log(`Topic: ${topic}\nModels: ${models.join(", ")}\n(one call per model)\n`);
const results = await Promise.all(models.map((m) => run(m, key, topic)));

mkdirSync(".scene-compare", { recursive: true });
writeFileSync(".scene-compare/results.json", JSON.stringify({ topic, at: new Date().toISOString(), results }, null, 2));

for (const r of results) {
  const cost = r.costUsd != null ? `$${r.costUsd.toFixed(5)}` : "n/a";
  console.log(
    `${r.ok ? "OK  " : "FAIL"} ${r.model.padEnd(32)} ${String(r.ms).padStart(6)}ms  cost ${cost}  tokens in ${r.promptTokens ?? "?"} / out ${r.completionTokens ?? "?"}` +
      (r.reasoningTokens ? ` (reasoning ${r.reasoningTokens})` : "") +
      (r.ok ? `  steps ${r.steps}  elements ${r.elements}` : `  ${r.error}`),
  );
}
console.log("\nOpen http://localhost:3000/dev/scene-compare to see the scenes side by side.");
