"use server";

import { requireAnyRole } from "@/lib/appwrite/session";
import { markAnswerFromImages } from "@/lib/ai/marking";
import type { MarkingResult } from "@/lib/ai/marking";

export type MarkPaperResult =
  | { ok: true; result: MarkingResult; marksAvailable: number }
  | { ok: false; error: string };

export async function markPaperAction(formData: FormData): Promise<MarkPaperResult> {
  await requireAnyRole(["teacher", "admin"]);

  const question = (formData.get("question") as string | null)?.trim() ?? "";
  const markschemeRaw = (formData.get("markscheme") as string | null)?.trim() ?? "";
  const files = formData.getAll("images") as File[];

  if (!question) return { ok: false, error: "Question is required." };
  if (!markschemeRaw) return { ok: false, error: "At least one markscheme point is required." };
  if (files.length === 0 || files[0].size === 0)
    return { ok: false, error: "At least one image or PDF is required." };

  const markscheme = markschemeRaw
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .map((point) => ({ point }));

  const images = await Promise.all(
    files.map(async (f) => ({
      bytes: Buffer.from(await f.arrayBuffer()),
      contentType: f.type,
    }))
  );

  try {
    const result = await markAnswerFromImages({ question, markscheme, images });
    return { ok: true, result, marksAvailable: markscheme.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Marking failed — check that a vision-capable AI key is configured.",
    };
  }
}
