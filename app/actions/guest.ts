"use server";

import { redirect } from "next/navigation";
import { ensureGuestToken, getGuestToken, clearGuestToken } from "@/lib/guest-session";
import { buildGuestDiagnostic } from "@/lib/guest-diagnostic";
import {
  isGuestSessionOwner,
  getDiagnosticQuestions,
  recordDiagnosticAnswer,
  getPendingShortAnswers,
  updateAnswerScore,
  deleteDiagnosticSession,
} from "@/lib/supabase/diagnostic";
import { scoreDiagnosticAnswerInstant, type LevelAnswerPayload } from "@/lib/diagnostic-scoring";
import { markAnswersBatch } from "@/lib/ai/marking";

// Picks up subject checkboxes from the landing/start form, builds a
// diagnostic sampled from each topic's pre-generated question pool (zero
// AI cost — see lib/guest-diagnostic.ts), and starts the guest quiz.
export async function startGuestDiagnosticAction(formData: FormData): Promise<void> {
  const subjectIds = formData.getAll("subjectIds").filter((v): v is string => typeof v === "string");
  if (subjectIds.length === 0) throw new Error("Pick at least one subject.");

  const guestToken = await ensureGuestToken();
  const result = await buildGuestDiagnostic(guestToken, subjectIds);
  if (!result) {
    throw new Error("These subjects don't have a diagnostic ready yet — try different ones.");
  }

  redirect(`/start/diagnostic/${result.sessionId}/level/0`);
}

export async function submitGuestDiagnosticLevelAction(formData: FormData): Promise<void> {
  const guestToken = await getGuestToken();
  const sessionId = formData.get("sessionId");
  const positionRaw = formData.get("position");
  const payloadRaw = formData.get("answerPayload");
  if (
    !guestToken ||
    typeof sessionId !== "string" ||
    typeof positionRaw !== "string" ||
    typeof payloadRaw !== "string"
  ) {
    throw new Error("Missing level answer.");
  }
  const position = Number(positionRaw);

  if (!(await isGuestSessionOwner(sessionId, guestToken))) {
    throw new Error("Diagnostic session not found.");
  }

  const questions = await getDiagnosticQuestions(sessionId);
  const question = questions[position];
  if (!question) throw new Error("Question not found for this level.");

  let payload: LevelAnswerPayload;
  try {
    payload = JSON.parse(payloadRaw) as LevelAnswerPayload;
  } catch {
    throw new Error("Invalid answer.");
  }

  const instantScore = scoreDiagnosticAnswerInstant(question, payload);
  const isShortAnswer = question.type === "short_answer";
  await recordDiagnosticAnswer(
    question.id,
    isShortAnswer ? -1 : (instantScore ?? 0),
    question.type === "mcq" ? payload.mcqIndex ?? null : null,
    isShortAnswer ? (payload.shortAnswer ?? null) : null
  );

  const isLast = position === questions.length - 1;
  if (isLast) {
    // Batch-mark short answers same as the logged-in flow — this is the
    // one real AI cost in the guest path, and it only fires for a visitor
    // who actually finished the quiz. No buildKnowledgeModel here: that
    // needs a real studentId, which doesn't exist until signup (see
    // convertGuestSessionAction).
    const pending = await getPendingShortAnswers(sessionId);
    if (pending.length > 0) {
      try {
        const results = await markAnswersBatch(
          pending.map((p) => ({
            questionId: p.questionId,
            question: p.prompt,
            markscheme: p.markscheme,
            maxMarks: p.maxMarks,
            studentAnswer: p.answerText,
          }))
        );
        await Promise.all(results.map((r) => updateAnswerScore(r.questionId, r.score)));
      } catch {
        await Promise.all(pending.map((p) => updateAnswerScore(p.questionId, 0)));
      }
    }
    redirect(`/start/results/${sessionId}`);
  }
  redirect(`/start/diagnostic/${sessionId}/level/${position + 1}`);
}

// "Start over" from the resume-or-reset prompt — deletes the abandoned
// session row and drops the cookie so the next visit starts clean.
export async function resetGuestSessionAction(formData: FormData): Promise<void> {
  const guestToken = await getGuestToken();
  const sessionId = formData.get("sessionId");
  if (guestToken && typeof sessionId === "string") {
    if (await isGuestSessionOwner(sessionId, guestToken)) {
      await deleteDiagnosticSession(sessionId);
    }
  }
  await clearGuestToken();
  redirect("/start");
}
