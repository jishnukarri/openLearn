"use server";

import { redirect } from "next/navigation";
import { requireAnyRole, requireRole } from "@/lib/appwrite/session";
import { getTopic, getSubtopic } from "@/lib/supabase/topics";
import { resolveQuestionForSubtopic } from "@/lib/subtopic-content";
import {
  getQuestionById,
  recordAnswer,
  createQuestionSession,
  completeSession,
  recordQuestionSessionAttempt,
  getSessionAttempts,
  isQuestionSessionOwner,
  getBestMarksLast24h,
  hasAnsweredQuestion,
  countAnswers,
} from "@/lib/supabase/questions";
import { downloadImageBytes } from "@/lib/supabase/practice-uploads";
import { markAnswer, markAnswerFromImages } from "@/lib/ai/marking";
import { explainAnswer } from "@/lib/ai/explain";
import {
  autoMark,
  payloadToText,
  parseAnswerPayload,
  shouldRevealModelAnswer,
} from "@/lib/question-marking";
import { resolveProviderConfig } from "@/lib/ai/client";
import { resolveQuestionContent } from "@/lib/class-content";
import { awardXp } from "@/lib/supabase/progress";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { deriveIsRetry, deriveMasteryExit } from "@/lib/session-rules";
import { claimAnswerSlot, ALREADY_RECORDED_MESSAGE } from "@/lib/answer-lock";

import {
  deriveHints,
  answerCandidates,
  clampHintLevel,
  isHintCopy,
  HINT_COPY_MESSAGE,
} from "@/lib/question-hints";

import { getOrCreateHints, getOrCreateRemediation, readCachedHints } from "@/lib/ai/remediation";
import { checkScaffoldAnswer, checkTransferAnswer } from "@/lib/ai/remediation-helpers";
import type { Remediation } from "@/lib/question-remediation";
import type { PointFeedback } from "@/lib/ai/marking";
import type { Question } from "@/lib/supabase/questions";
import { ownsUploadedFiles } from "@/lib/supabase/practice-uploads";

// Hints are always re-derived here from the stored question, never taken
// from client text, so the anti-copy check cannot be spoofed or skipped.
async function hintsFor(question: Question): Promise<string[]> {
  const topic = await getTopic(question.topic_id).catch(() => null);
  return deriveHints({
    prompt: question.prompt,
    markscheme: question.markscheme,
    maxMarks: question.max_marks,
    format: question.format,
    topicTitle: topic?.name ?? null,
  });
}

// Returns the message to show when the answer is just a shown hint repeated.
async function hintCopyMessage(
  question: Question,
  formData: FormData,
  payload: NonNullable<ReturnType<typeof parseAnswerPayload>>,
  answerText: string
): Promise<string | null> {
  const shown = clampHintLevel(formData.get("hintsShown"));
  if (shown === 0) return null;
  // Both the cached AI hints and the deterministic ones count as "shown".
  const hints = [...(readCachedHints(question) ?? []).slice(0, shown), ...(await hintsFor(question)).slice(0, shown)];
  const candidates = answerCandidates({ answerText, text: payload.text, parts: payload.parts });
  return candidates.some((c) => isHintCopy(c, hints)) ? HINT_COPY_MESSAGE : null;
}

const MARKING_UNAVAILABLE = "Marking isn't available right now. Your answer is still here, so try again in a moment.";

export type HintResult =
  | { hint: string; level: number; total: number }
  | { message: string };

// Reveals the next hint (level is 1-based). No AI call, no attempt used.
export async function getQuestionHintAction(
  questionId: string,
  level: number
): Promise<HintResult> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (!await checkKeyRateLimit("practice-hint", profile.id, 30, 60_000)) {
    return { message: "You're going a bit fast. Wait a few seconds and try again." };
  }
  const question = await getQuestionById(questionId);
  if (!question) return { message: "No question found for this topic." };
  const hints = await hintsFor(question);
  const n = clampHintLevel(level);
  if (n < 1) return { message: "No hint for that level." };
  return { hint: hints[n - 1], level: n, total: hints.length };
}

export type PracticeState =
  | {
      marksAwarded: number;
      maxMarks: number;
      feedback: PointFeedback[];
      modelAnswer: string;
      correct?: boolean;
    }
  | { message: string }
  | undefined;

export async function submitAnswerAction(
  _state: PracticeState,
  formData: FormData
): Promise<PracticeState> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (!await checkKeyRateLimit("practice-mark", profile.id, 15, 60_000)) {
    return { message: "You're going a bit fast. Wait a few seconds and try again." };
  }

  const questionId = formData.get("questionId");
  const rawPayload = formData.get("answerPayload");
  if (typeof questionId !== "string" || typeof rawPayload !== "string") {
    return { message: "Missing answer." };
  }

  const payload = parseAnswerPayload(rawPayload);
  if (!payload) return { message: "Missing answer." };

  const question = await getQuestionById(questionId);
  if (!question) return { message: "No question found for this topic." };

  const format = question.format ?? { type: "extended" as const };
  const hasImages = (payload.imagePaths?.length ?? 0) > 0;
  const answerText = hasImages
    ? `[${payload.imagePaths!.length} photo(s)/scan(s) attached]`
    : payloadToText(format, payload);
  if (!hasImages && answerText.trim().length === 0) {
    return { message: "Write an answer, or attach a photo, before submitting." };
  }
  if (hasImages && !(await ownsUploadedFiles(profile.id, question.id, payload.imagePaths!))) {
    return { message: "Those photos don't belong to this question. Upload them again." };
  }
  if (!hasImages) {
    const copied = await hintCopyMessage(question, formData, payload, answerText);
    if (copied) return { message: copied };
  }

  let result;
  if (hasImages) {
    // A photographed/scanned answer always goes to vision marking —
    // structured formats don't really apply to handwritten prose, so it's
    // marked like an extended answer against the full markscheme.
    const images = await Promise.all(payload.imagePaths!.map(downloadImageBytes));
    result = await markAnswerFromImages({
      question: question.prompt,
      markscheme: question.markscheme,
      images,
    });
  } else {
    // Objective formats mark instantly with no AI call; a null result means
    // this format (or this particular answer, e.g. a short-answer near-miss
    // or a wrong calculation needing working marked) goes to the AI marker.
    result = autoMark(format, payload, question.max_marks);
    if (!result) {
      const markscheme =
        format.type === "structured"
          ? format.parts.flatMap((part) =>
              part.markscheme.map((m) => ({
                point: `(${part.label}) ${m.point}`,
              }))
            )
          : question.markscheme;
      try {
        const config = await resolveProviderConfig(profile.id);
        result = await markAnswer(
          {
            question: question.prompt,
            markscheme,
            studentAnswer: answerText,
          },
          config
        );
      } catch (e) {
        console.warn("[practice] marking failed:", e instanceof Error ? e.message : e);
        return { message: MARKING_UNAVAILABLE };
      }
    }
  }

  result = { ...result, marksAwarded: Math.max(0, Math.min(result.marksAwarded, question.max_marks)) };

  // Cross-instance lock: an identical answer submitted twice at once records
  // and pays once.
  if (!(await claimAnswerSlot(profile.id, question.id, answerText))) {
    return { message: ALREADY_RECORDED_MESSAGE };
  }

  const priorBest = profile.role === "student" ? await getBestMarksLast24h(profile.id, question.id) : 0;

  await recordAnswer({
    questionId: question.id,
    studentId: profile.id,
    answerText,
    maxMarks: question.max_marks,
    result,
  });

  if (profile.role === "student") {
    await awardXp(profile.id, Math.max(0, result.marksAwarded - priorBest));
  }

  return {
    marksAwarded: result.marksAwarded,
    maxMarks: question.max_marks,
    feedback: result.feedback,
    modelAnswer: question.model_answer,
  };
}

// On-demand "why?" for a wrong (or partially-wrong) practice answer —
// explains the model answer's reasoning rather than just restating it.
export async function explainPracticeAnswerAction(questionId: string): Promise<string> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (!await checkKeyRateLimit("practice-explain", profile.id, 10, 60_000)) {
    throw new Error("You're going a bit fast. Wait a few seconds and try again.");
  }
  const question = await getQuestionById(questionId);
  if (!question) throw new Error("Question not found.");
  // The explanation reveals the model answer, so only after an attempt.
  if (!(await hasAnsweredQuestion(profile.id, question.id))) {
    throw new Error("Answer the question first.");
  }

  const config = await resolveProviderConfig(profile.id);
  return explainAnswer(question.prompt, question.model_answer, config);
}

export async function newSimilarQuestionAction(formData: FormData): Promise<void> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  await resolveQuestionContent(topic, profile, { force: true });

  redirect(`/practice/${topicId}`);
}

export async function createBankSessionAction(topicId: string): Promise<string> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  return createQuestionSession(profile.id, topicId, null);
}

export async function completeBankSessionAction(
  sessionId: string,
  _clientMasteryExit?: boolean // ignored: derived from recorded attempts
): Promise<void> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (typeof sessionId !== "string" || !(await isQuestionSessionOwner(sessionId, profile.id))) return;
  const attempts = await getSessionAttempts(sessionId, profile.id).catch(() => []);
  await completeSession(sessionId, deriveMasteryExit(attempts));
}

export async function submitBankAnswerAction(
  _state: PracticeState,
  formData: FormData
): Promise<PracticeState & { correct?: boolean }> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (!await checkKeyRateLimit("practice-mark", profile.id, 15, 60_000)) {
    return { message: "You're going a bit fast. Wait a few seconds and try again." };
  }

  const questionId = formData.get("questionId");
  const rawPayload = formData.get("answerPayload");
  const sessionId = formData.get("sessionId");
  // formData "isRetry" is still sent by the client but ignored; derived below.

  if (typeof questionId !== "string" || typeof rawPayload !== "string") {
    return { message: "Missing answer." };
  }

  const payload = parseAnswerPayload(rawPayload);
  if (!payload) return { message: "Missing answer." };

  const question = await getQuestionById(questionId);
  if (!question) return { message: "No question found for this topic." };

  const format = question.format ?? { type: "extended" as const };
  const hasImages = (payload.imagePaths?.length ?? 0) > 0;
  const answerText = hasImages
    ? `[${payload.imagePaths!.length} photo(s)/scan(s) attached]`
    : payloadToText(format, payload);
  if (!hasImages && answerText.trim().length === 0) {
    return { message: "Write an answer, or attach a photo, before submitting." };
  }
  if (hasImages && !(await ownsUploadedFiles(profile.id, question.id, payload.imagePaths!))) {
    return { message: "Those photos don't belong to this question. Upload them again." };
  }
  if (!hasImages) {
    const copied = await hintCopyMessage(question, formData, payload, answerText);
    if (copied) return { message: copied };
  }

  let result;
  if (hasImages) {
    const images = await Promise.all(payload.imagePaths!.map(downloadImageBytes));
    result = await markAnswerFromImages({
      question: question.prompt,
      markscheme: question.markscheme,
      images,
    });
  } else {
    result = autoMark(format, payload, question.max_marks);
    if (!result) {
      const markscheme =
        format.type === "structured"
          ? format.parts.flatMap((part) =>
              part.markscheme.map((m) => ({
                point: `(${part.label}) ${m.point}`,
              }))
            )
          : question.markscheme;
      try {
        const config = await resolveProviderConfig(profile.id);
        result = await markAnswer(
          { question: question.prompt, markscheme, studentAnswer: answerText },
          config
        );
      } catch (e) {
        console.warn("[practice] marking failed:", e instanceof Error ? e.message : e);
        return { message: MARKING_UNAVAILABLE };
      }
    }
  }

  const correct = result.marksAwarded === question.max_marks;

  result = { ...result, marksAwarded: Math.max(0, Math.min(result.marksAwarded, question.max_marks)) };

  // Cross-instance lock: an identical answer submitted twice at once records
  // and pays once.
  if (!(await claimAnswerSlot(profile.id, question.id, answerText))) {
    return { message: ALREADY_RECORDED_MESSAGE };
  }

  const priorBest = profile.role === "student" ? await getBestMarksLast24h(profile.id, question.id) : 0;

  await recordAnswer({
    questionId: question.id,
    studentId: profile.id,
    answerText,
    maxMarks: question.max_marks,
    result,
  });

  if (typeof sessionId === "string" && (await isQuestionSessionOwner(sessionId, profile.id))) {
    const prior = await getSessionAttempts(sessionId, profile.id).catch(() => []);
    await recordQuestionSessionAttempt({
      questionId: question.id,
      studentId: profile.id,
      sessionId,
      correct,
      isRetry: deriveIsRetry(prior, question.id),
    });
  }

  if (profile.role === "student") {
    await awardXp(profile.id, Math.max(0, result.marksAwarded - priorBest));
  }

  const reveal = shouldRevealModelAnswer({
    formatType: format.type,
    marksAwarded: result.marksAwarded,
    maxMarks: question.max_marks,
    answersRecorded: await countAnswers(profile.id, question.id),
  });

  return {
    marksAwarded: result.marksAwarded,
    maxMarks: question.max_marks,
    feedback: result.feedback,
    modelAnswer: reveal ? question.model_answer : "",
    correct,
  };
}

export async function newSimilarSubtopicQuestionAction(formData: FormData): Promise<void> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const subtopicId = formData.get("subtopicId");
  if (typeof subtopicId !== "string") throw new Error("Missing subtopicId.");

  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");

  await resolveQuestionForSubtopic(subtopic, profile.id, { force: true });

  redirect(`/practice/subtopic/${subtopicId}`);
}

/* ── escalating feedback: AI hints, remediation, completion ───────────── */

const TEN_MIN = 10 * 60_000;
const RATE_MESSAGE = "You're going a bit fast. Wait a moment and try again.";

export type Unavailable = { unavailable: true; message?: string };

async function topicTitleFor(question: Question): Promise<string | null> {
  const topic = await getTopic(question.topic_id).catch(() => null);
  return topic?.name ?? null;
}

// AI hint for a level (1..3), generated on first need and cached for everyone.
// On failure returns {unavailable:true}; the masked mark-scheme hints are
// deliberately not used as a fallback.
export async function getHintAction(input: {
  questionId: string;
  level: number;
}): Promise<{ hint: string; level: number; maxLevel: number } | Unavailable> {
  const { profile } = await requireRole("student");
  if (!await checkKeyRateLimit("practice-ai-hint", profile.id, 20, TEN_MIN)) {
    return { unavailable: true, message: RATE_MESSAGE };
  }
  const level = clampHintLevel(input?.level);
  if (level < 1 || typeof input?.questionId !== "string") return { unavailable: true };
  const question = await getQuestionById(input.questionId);
  if (!question) return { unavailable: true };
  const hints = await getOrCreateHints(question, await topicTitleFor(question));
  if (!hints) return { unavailable: true };
  return { hint: hints[level - 1], level, maxLevel: hints.length };
}

// Remediation for a question (scaffold or explain). Answers are stripped:
// the client checks every answer through checkScaffoldStepAction /
// checkTransferAction so nothing can be read ahead of time.
function redact(r: Remediation): Remediation {
  if (r.type === "scaffold") {
    return { type: "scaffold", steps: r.steps.map(({ answer: _a, accepted: _acc, ...rest }) => ({ ...rest, answer: "" })) };
  }
  const { correctIndex: _c, accepted: _a, ...tc } = r.transferCheck;
  return { ...r, transferCheck: tc };
}

export async function getRemediationAction(input: {
  questionId: string;
}): Promise<Remediation | Unavailable> {
  const { profile } = await requireRole("student");
  if (!await checkKeyRateLimit("practice-remediation", profile.id, 20, TEN_MIN)) {
    return { unavailable: true, message: RATE_MESSAGE };
  }
  if (typeof input?.questionId !== "string") return { unavailable: true };
  const question = await getQuestionById(input.questionId);
  if (!question) return { unavailable: true };
  const rem = await getOrCreateRemediation(question, await topicTitleFor(question));
  if (!rem) return { unavailable: true };
  // A scaffold is redacted and can open from a hint; an explain card states
  // the answer, so it only follows an attempt.
  if (rem.type === "explain" && !(await hasAnsweredQuestion(profile.id, question.id))) {
    return { unavailable: true };
  }
  return redact(rem);
}

// Marks one scaffold step server-side. Never returns the step's answer; a
// wrong try gets the step's own nudge (which never contains the answer).
export async function checkScaffoldStepAction(input: {
  questionId: string;
  stepIndex: number;
  answer: string;
}): Promise<{ correct: boolean; hint?: string }> {
  const { profile } = await requireRole("student");
  if (!await checkKeyRateLimit("practice-scaffold", profile.id, 120, TEN_MIN)) return { correct: false };
  if (typeof input?.questionId !== "string" || typeof input?.answer !== "string" || input.answer.length > 200) {
    return { correct: false };
  }
  const question = await getQuestionById(input.questionId);
  if (!question) return { correct: false };
  const rem = await getOrCreateRemediation(question, null);
  if (!rem || rem.type !== "scaffold") return { correct: false };
  const step = rem.steps[input.stepIndex];
  if (!step) return { correct: false };
  const correct = checkScaffoldAnswer(step, input.answer);
  return correct ? { correct } : { correct, ...(step.hint ? { hint: step.hint } : {}) };
}

// Marks the transfer check of an explain remediation. For mcq the answer is
// the chosen option's index (as text) or its text.
export async function checkTransferAction(input: {
  questionId: string;
  answer: string;
}): Promise<{ correct: boolean }> {
  const { profile } = await requireRole("student");
  if (!await checkKeyRateLimit("practice-transfer", profile.id, 60, TEN_MIN)) return { correct: false };
  if (typeof input?.questionId !== "string" || typeof input?.answer !== "string" || input.answer.length > 200) {
    return { correct: false };
  }
  const question = await getQuestionById(input.questionId);
  if (!question) return { correct: false };
  const rem = await getOrCreateRemediation(question, null);
  if (!rem || rem.type !== "explain") return { correct: false };
  return { correct: checkTransferAnswer(rem.transferCheck, input.answer) };
}

// A question finished through remediation: no marks, no XP, no answer row.
// It is logged as an incorrect, resolved retry so the session can move on
// (Next appears) while mastery still sees it was not got first time.
export async function completeAfterRemediationAction(input: {
  questionId: string;
  sessionId?: string | null;
}): Promise<{ ok: boolean }> {
  const { profile } = await requireRole("student");
  if (!await checkKeyRateLimit("practice-remediation-done", profile.id, 60, TEN_MIN)) return { ok: false };
  if (typeof input?.questionId !== "string") return { ok: false };
  const question = await getQuestionById(input.questionId);
  if (!question) return { ok: false };
  if (typeof input.sessionId === "string" && (await isQuestionSessionOwner(input.sessionId, profile.id))) {
    await recordQuestionSessionAttempt({
      questionId: question.id,
      studentId: profile.id,
      sessionId: input.sessionId,
      correct: false,
      isRetry: true,
    });
  }
  return { ok: true };
}
