// Backfills animated scenes for stored lessons that have none.
//
//   bun scripts/backfill-scenes.ts --limit 20          (dry run, default)
//   bun scripts/backfill-scenes.ts --limit 20 --write  (saves)
//
// Needs OPENROUTER_API_KEY (and optional SCENE_MODEL) plus the DB env used by
// lib/supabase. Dry run makes NO model calls; it only counts and estimates cost.
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const write = process.argv.includes("--write");
  const limit = Number(arg("limit") ?? 20);
  const { db } = await import("../lib/supabase/database-client");
  const { parseScene } = await import("../lib/lesson-scene");
  const { generateSceneForSection } = await import("../lib/ai/scenes");
  const { estimateSceneCostUsd } = await import("../lib/ai/scene-helpers");

  const { data, error } = await db
    .from("lessons")
    .select("id, content, topic:topics(name, subject:subjects(name))")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;

  const todo: { id: string; content: any; subject: string; idx: number[] }[] = [];
  for (const row of (data ?? []) as any[]) {
    const sections: any[] = row.content?.sections ?? [];
    const idx = sections
      .map((s, i) => (s && s.example?.trim() && !parseScene(s.exampleScene) ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, 8);
    if (idx.length) todo.push({ id: row.id, content: row.content, subject: row.topic?.subject?.name ?? "General", idx });
    if (todo.length >= limit) break;
  }
  const total = todo.reduce((n, t) => n + t.idx.length, 0);
  console.log(`${todo.length} lessons, ${total} sections need scenes. Estimated cost ~$${estimateSceneCostUsd(total).toFixed(4)}.`);
  if (!write) {
    console.log("Dry run; pass --write to generate and save.");
    return;
  }
  let done = 0;
  for (const t of todo) {
    const sections = [...t.content.sections];
    let changed = false;
    for (const i of t.idx) {
      const s = sections[i];
      const scene = await generateSceneForSection({
        heading: s.heading, explanation: s.explanation, example: s.example, subjectName: t.subject,
      });
      if (scene) { sections[i] = { ...s, exampleScene: scene }; changed = true; done++; }
    }
    if (changed) {
      const { error: upErr } = await db.from("lessons").update({ content: { ...t.content, sections } }).eq("id", t.id);
      if (upErr) console.error("update failed", t.id, upErr.message);
    }
  }
  console.log(`Generated ${done}/${total} scenes.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
