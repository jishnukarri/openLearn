"use server";

import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic, getSubtopic } from "@/lib/supabase/topics";
import { resolveQuestionForSubtopic } from "@/lib/subtopic-content";
import {
  getQuestionById,
  recordAnswer,
  createQuestionSession,
  completeSession,
  recordQuestionSessionAttempt,
} from "@/lib/supabase/questions";
import { downloadImageBytes } from "@/lib/supabase/practice-uploads";
import { markAnswer, markAnswerFromImages } from "@/lib/ai/marking";
import { explainAnswer } from "@/lib/ai/explain";
import {
  autoMark,
  payloadToText,
  type AnswerPayload,
} from "@/lib/question-marking";
import { resolveProviderConfig } from "@/lib/ai/client";
import { resolveQuestionContent } from "@/lib/class-content";
import { awardXp } from "@/lib/supabase/progress";
import type { PointFeedback } from "@/lib/ai/marking";

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

  const questionId = formData.get("questionId");
  const rawPayload = formData.get("answerPayload");
  if (typeof questionId !== "string" || typeof rawPayload !== "string") {
    return { message: "Missing answer." };
  }

  let payload: AnswerPayload;
  try {
    payload = JSON.parse(rawPayload) as AnswerPayload;
  } catch {
    return { message: "Missing answer." };
  }

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
      const config = await resolveProviderConfig(profile.id);
      result = await markAnswer(
        {
          question: question.prompt,
          markscheme,
          studentAnswer: answerText,
        },
        config
      );
    }
  }

  await recordAnswer({
    questionId: question.id,
    studentId: profile.id,
    answerText,
    maxMarks: question.max_marks,
    result,
  });

  if (profile.role === "student") {
    await awardXp(profile.id, result.marksAwarded);
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
  const question = await getQuestionById(questionId);
  if (!question) throw new Error("Question not found.");

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
  masteryExit: boolean
): Promise<void> {
  await requireAnyRole(["student", "teacher", "admin"]);
  await completeSession(sessionId, masteryExit);
}

export async function submitBankAnswerAction(
  _state: PracticeState,
  formData: FormData
): Promise<PracticeState & { correct?: boolean }> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);

  const questionId = formData.get("questionId");
  const rawPayload = formData.get("answerPayload");
  const sessionId = formData.get("sessionId");
  const isRetry = formData.get("isRetry") === "true";

  if (typeof questionId !== "string" || typeof rawPayload !== "string") {
    return { message: "Missing answer." };
  }

  let payload: AnswerPayload;
  try {
    payload = JSON.parse(rawPayload) as AnswerPayload;
  } catch {
    return { message: "Missing answer." };
  }

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
      const config = await resolveProviderConfig(profile.id);
      result = await markAnswer(
        { question: question.prompt, markscheme, studentAnswer: answerText },
        config
      );
    }
  }

  const correct = result.marksAwarded === question.max_marks;

  await recordAnswer({
    questionId: question.id,
    studentId: profile.id,
    answerText,
    maxMarks: question.max_marks,
    result,
  });

  if (typeof sessionId === "string") {
    await recordQuestionSessionAttempt({
      questionId: question.id,
      studentId: profile.id,
      sessionId,
      correct,
      isRetry,
    });
  }

  if (profile.role === "student") {
    await awardXp(profile.id, result.marksAwarded);
  }

  return {
    marksAwarded: result.marksAwarded,
    maxMarks: question.max_marks,
    feedback: result.feedback,
    modelAnswer: question.model_answer,
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
