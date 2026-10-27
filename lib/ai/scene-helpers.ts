// Pure helpers for scene generation (no network, no server-only) so they can
// be unit-tested. See lib/ai/scenes.ts for the model call.
import { WORKED_EXAMPLE_GUIDE } from "./scene-prompt";
import type { Collision } from "@/lib/scene-layout";

export type SceneSectionInput = {
  heading: string;
  explanation: string;
  example: string;
  subjectName: string;
};

export const SCENE_SYSTEM_PROMPT =
  `You turn one worked example from a GCSE lesson into a small animated ` +
  `scene. Reply with ONLY a single JSON object (the scene itself, no ` +
  `wrapper key, no markdown fences).` +
  WORKED_EXAMPLE_GUIDE;

export function buildScenePrompt(s: SceneSectionInput): string {
  return (
    `Subject: ${s.subjectName}\nSection: ${s.heading}\n\n` +
    `Explanation:\n${s.explanation.slice(0, 2000)}\n\n` +
    `Worked example to animate:\n${s.example.slice(0, 2000)}\n\n` +
    `Return the scene JSON object now.`
  );
}

export function buildRetryPrompt(reason: string): string {
  return `Your previous reply failed validation: ${reason}. Reply again with ONLY the corrected scene JSON object.`;
}

// Precise retry reason for labels the layout pass could not separate.
export function describeCollisions(cs: Collision[]): string {
  const parts = cs.slice(0, 3).map((c) =>
    c.kind === "hard"
      ? `the labels "${c.a}" and "${c.b}" overlap; move them apart or shorten them`
      : `the label "${c.a}" overlaps ${c.b}; move it clear of it`
  );
  return parts.join("; ");
}

// Tolerates code fences, leading/trailing prose, and a {"exampleScene": {...}} wrapper.
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let body = (fenced ? fenced[1] : text).trim();
  if (!body.startsWith("{")) {
    const a = body.indexOf("{");
    const b = body.lastIndexOf("}");
    if (a >= 0 && b > a) body = body.slice(a, b + 1);
  }
  const parsed = JSON.parse(body);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && !("elements" in parsed)) {
    const inner = (parsed as Record<string, unknown>).exampleScene ?? (parsed as Record<string, unknown>).scene;
    if (inner) return inner;
  }
  return parsed;
}

// Rough cost in USD at the default model's prices ($0.028/M in, $0.12/M out).
export function estimateSceneCostUsd(sections: number, inTokens = 1800, outTokens = 1500): number {
  return sections * (inTokens * 0.028 + outTokens * 0.12) / 1_000_000;
}
