"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAnyRole } from "@/lib/appwrite/session";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { getTopic, getSubtopic } from "@/lib/supabase/topics";
import {
  getLessonByTopic,
  createLesson,
  getLessonBySubtopic,
  createLessonForSubtopic,
} from "@/lib/supabase/lessons";
import { generateLesson, tweakLesson } from "@/lib/ai/lessons";
import { askLessonTutor, rewriteLessonStep, adaptNextSection, type CoachTurn, type CoachHistoryItem } from "@/lib/ai/lesson-tutor";
import { explainAnswer } from "@/lib/ai/explain";
import { resolveLessonContent } from "@/lib/class-content";
import { resolveLessonForSubtopic } from "@/lib/subtopic-content";
import { getCoachTopicHistory } from "@/lib/supabase/coach-history";
import { buildCoachContext, clampIndex, coveredSectionSet, sanitizePlan, sanitizeSession, summarizeHistory, summarizeSession } from "@/lib/lesson-coach-context";
import { resolveProviderConfig } from "@/lib/ai/client";
import { finalizeLessonContent, resanitizeLessonContent } from "@/lib/lesson-finalize";
import type { LessonContent, LessonSection } from "@/lib/ai/lessons";
import { withReferenceContext } from "@/lib/rag";
import { awardXp, awardRawXp, markTopicComplete, markSubtopicComplete, isTopicCompleted, getCompletedSubtopicIds } from "@/lib/supabase/progress";
import { recordLessonMiss, resolveLessonMiss, resolveLessonMissById } from "@/lib/supabase/lesson-misses";
import { checkAnswerText } from "@/lib/lesson-misses";
import { clampPerformance, lessonXp, xpBreakdownLine, type LessonPerformance } from "@/lib/lesson-xp";
import { uploadFile, getFileUrl } from "@/lib/appwrite/storage";

export type LessonCompletion = {
  xp: number; // profile total after this award
  streak: number;
  earned: number;
  breakdown: string;
  repeat: boolean;
  hintsUsed: number;
};

export async function completeLessonAction(
  id: string,
  mode: "topic" | "subtopic" = "topic",
  rawPerformance?: Partial<LessonPerformance>
): Promise<LessonCompletion> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  // Only real students earn XP and progress — admin/teacher visits are previews.
  if (profile.role !== "student") {
    return { xp: profile.xp, streak: profile.streak_count, earned: 0, breakdown: "", repeat: false, hintsUsed: 0 };
  }

  const repeat =
    mode === "subtopic"
      ? (await getCompletedSubtopicIds(profile.id)).has(id)
      : await isTopicCompleted(profile.id, id);

  // The number of checks comes from the stored lesson, not the client.
  let serverChecks = Math.round(Number(rawPerformance?.checksTotal)) || 0;
  try {
    if (mode === "subtopic") {
      const sub = await getSubtopic(id);
      if (sub) serverChecks = (await resolveLessonForSubtopic(sub, profile.id)).sections.length;
    } else {
      const topic = await getTopic(id);
      if (topic) serverChecks = (await resolveLessonContent(topic, profile)).sections.length;
    }
  } catch {
    // keep the clamped client figure
  }
  const perf = clampPerformance(rawPerformance, serverChecks);

  let result = lessonXp(perf, { repeat });
  // Replays pay a little, but only a few per day.
  if (repeat && !await checkKeyRateLimit("lesson-repeat-xp", profile.id, 5, 24 * 60 * 60_000)) {
    result = { ...result, total: 0 };
  }

  await awardRawXp(profile.id, result.total);
  if (mode === "subtopic") await markSubtopicComplete(profile.id, id);
  else await markTopicComplete(profile.id, id);
  return {
    xp: profile.xp + result.total,
    streak: profile.streak_count,
    earned: result.total,
    breakdown: result.total === 0 ? "Daily limit for repeat lessons reached." : xpBreakdownLine(result),
    repeat,
    hintsUsed: result.hintsUsed,
  };
}

// Remembers a first-try check result so later lessons can bring a missed idea
// back, and closes the miss when the same question is later answered right.
// The prompt and answer come from the stored lesson, never from the client.
// Zero AI calls; if the table is missing this quietly does nothing.
export async function recordCheckResultAction({
  id,
  mode = "topic",
  section,
  correct,
}: {
  id: string;
  mode?: "topic" | "subtopic";
  section: number;
  correct: boolean;
}): Promise<void> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (profile.role !== "student") return;
  if (!await checkKeyRateLimit("lesson-check-result", profile.id, 60, 60_000)) return;
  try {
    let topicId: string;
    let subtopicId: string | null = null;
    let lesson: LessonContent;
    if (mode === "subtopic") {
      const sub = await getSubtopic(id);
      if (!sub) return;
      topicId = sub.topic.id;
      subtopicId = sub.id;
      lesson = await resolveLessonForSubtopic(sub, profile.id);
    } else {
      const topic = await getTopic(id);
      if (!topic) return;
      topicId = topic.id;
      lesson = await resolveLessonContent(topic, profile);
    }
    const check = lesson.sections[Math.round(section)]?.check;
    if (!check) return;
    if (correct) await resolveLessonMiss(profile.id, topicId, check.question);
    else await recordLessonMiss({ studentId: profile.id, topicId, subtopicId, prompt: check.question, correctAnswer: checkAnswerText(check) });
  } catch {
    // never block the lesson on bookkeeping
  }
}

// The student said "I got it" on a carried-over question.
export async function resolveCarriedMissAction(missId: string): Promise<void> {
  const { profile } = await requireAnyRole(["student"]);
  if (typeof missId === "string" && missId.length <= 64) await resolveLessonMissById(profile.id, missId);
}

// Finishing a recall deck is revision: students earn 10 XP for it. The
// client calls this once per deck visit; teachers and admins only preview.
export async function completeRevisionDeckAction(): Promise<{ xp: number }> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (profile.role !== "student") return { xp: 0 };
  // At most 5 paid decks a day; beyond that the deck still works, it just
  // stops paying.
  if (!await checkKeyRateLimit("revision-deck-xp", profile.id, 5, 24 * 60 * 60_000)) return { xp: 0 };
  await awardXp(profile.id, 1);
  return { xp: 10 };
}

// On-demand "why?" explanation after a wrong quick-check answer — the
// check itself already reveals the correct answer, this just explains it.
export async function explainCheckAnswerAction({
  question,
  correctAnswer,
}: {
  question: string;
  correctAnswer: string;
}): Promise<string> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const config = await resolveProviderConfig(profile.id);
  return explainAnswer(question, correctAnswer, config);
}

export async function askLessonTutorAction({
  topicId,
  mode = "topic",
  lessonId,
  question,
  history = [],
  stepIndex = 0,
  plan: rawPlan,
  session: rawSession,
}: {
  topicId: string;
  mode?: "topic" | "subtopic";
  lessonId?: string;
  question: string;
  history?: CoachHistoryItem[];
  stepIndex?: number;
  plan?: unknown;
  session?: unknown;
}): Promise<CoachTurn> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (!await checkKeyRateLimit("lesson-coach", profile.id, 20, 60_000)) {
    throw new Error("You're going a bit fast. Wait a few seconds and try again.");
  }
  if (question.trim().length === 0 || question.length > 500) {
    throw new Error("Please enter a question of up to 500 characters.");
  }

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  // Lesson text comes from the stored lesson, never from the client. The
  // client only sends the plan's shape and a step index, both validated.
  let lesson: LessonContent;
  if (mode === "subtopic") {
    const sub = lessonId ? await getSubtopic(lessonId) : null;
    if (!sub || sub.topic.id !== topic.id) throw new Error("Lesson not found.");
    lesson = resanitizeLessonContent(await resolveLessonForSubtopic(sub, profile.id));
  } else {
    lesson = resanitizeLessonContent(await resolveLessonContent(topic, profile));
  }
  const plan = sanitizePlan(rawPlan, lesson.sections.length);
  const cur = clampIndex(stepIndex, plan.length);
  const ctx = buildCoachContext({ plan, sections: lesson.sections, hook: lesson.hook, stepIndex: cur });
  const covered = coveredSectionSet(plan, cur);
  const sessionText = summarizeSession(sanitizeSession(rawSession, lesson.sections.length), lesson.sections, covered);
  const historyText = summarizeHistory(await getCoachTopicHistory(profile.id, topic.id, topic.subject.id, topic.name));

  const config = await resolveProviderConfig(profile.id);
  return askLessonTutor(
    topic.name,
    topic.subject.name,
    ctx.text,
    history.slice(-8).map((h) => ({ role: h.role === "student" ? "student" : "coach", text: String(h.text).slice(0, 600) })),
    question.trim(),
    config,
    { coveredTopics: ctx.coveredTopics, studentSummary: [sessionText, historyText].filter(Boolean).join(" ") }
  );
}

export async function rewriteLessonStepAction({
  topicId,
  context,
}: {
  topicId: string;
  context: string;
}): Promise<{ reply: string; explanation: string; example: string }> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  if (!await checkKeyRateLimit("lesson-rewrite", profile.id, 10, 60_000)) {
    throw new Error("You're going a bit fast. Wait a few seconds and try again.");
  }
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  return rewriteLessonStep(
    topic.name,
    topic.subject.name,
    context.slice(0, 4000),
    config
  );
}

// Adaptive learning: fired in the background as soon as a student gets a
// quick check wrong, so by the time they hit Continue the next section
// (if it's worth touching at all) is already adapted. Never lengthens the
// lesson or adds sections — at most a short bridging sentence woven into
// the next section that was going to be shown anyway.
export async function adaptNextSectionAction({
  topicId,
  struggledConcept,
  nextSection,
}: {
  topicId: string;
  struggledConcept: { heading: string; explanation: string };
  nextSection: { heading: string; explanation: string; example: string };
}): Promise<{ adapted: boolean; explanation: string; example: string }> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  return adaptNextSection(
    topic.name,
    topic.subject.name,
    struggledConcept,
    nextSection,
    config
  );
}

// Regenerates the lesson for this topic in a slower, simpler style — used
// when a student says the normal version isn't clicking.
export async function requestExtraHelpAction(formData: FormData): Promise<void> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
  const lesson = await generateLesson(topic.name, topic.subject.name, true, instructions, config);
  await createLesson(topicId, await finalizeLessonContent(lesson, topicId));

  redirect(`/learn/${topicId}`);
}

// Admin/teacher-only: revise the current lesson with a free-text
// instruction instead of a full regeneration.
export async function tweakLessonAction(formData: FormData): Promise<void> {
  const { profile } = await requireAnyRole(["teacher", "admin"]);
  const topicId = formData.get("topicId");
  const instruction = formData.get("instruction");
  if (typeof topicId !== "string" || typeof instruction !== "string") {
    throw new Error("Missing topicId or instruction.");
  }
  if (instruction.trim().length === 0) {
    throw new Error("Write an instruction before tweaking.");
  }

  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");

  const current = await getLessonByTopic(topicId);
  if (!current) throw new Error("No lesson exists for this topic yet.");

  const config = await resolveProviderConfig(profile.id);
  const revised = await tweakLesson(
    current,
    instruction,
    topic.name,
    topic.subject.name,
    config
  );
  await createLesson(topicId, await finalizeLessonContent(revised, topicId));

  redirect(`/learn/${topicId}`);
}

export async function tweakSubtopicLessonAction(formData: FormData): Promise<void> {
  const { profile } = await requireAnyRole(["teacher", "admin"]);
  const subtopicId = formData.get("subtopicId");
  const instruction = formData.get("instruction");
  if (typeof subtopicId !== "string" || typeof instruction !== "string") {
    throw new Error("Missing subtopicId or instruction.");
  }
  if (!instruction.trim()) throw new Error("Write an instruction before tweaking.");

  const [subtopic, current] = await Promise.all([
    getSubtopic(subtopicId),
    getLessonBySubtopic(subtopicId),
  ]);
  if (!subtopic) throw new Error("Subtopic not found.");
  if (!current) throw new Error("No lesson exists for this subtopic yet.");

  const config = await resolveProviderConfig(profile.id);
  const revised = await tweakLesson(
    current,
    instruction.trim(),
    subtopic.name,
    subtopic.topic.subject.name,
    config
  );
  await createLessonForSubtopic(
    subtopic.topic.id,
    subtopic.id,
    await finalizeLessonContent(revised, subtopic.id)
  );

  redirect(`/learn/subtopic/${subtopicId}`);
}

export async function uploadLessonImageAction(formData: FormData): Promise<string> {
  await requireAnyRole(["teacher", "admin"]);
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) throw new Error("No image provided.");
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be under 10 MB.");
  const fileId = await uploadFile(file);
  return getFileUrl(fileId);
}

export async function saveSubtopicLessonAction(formData: FormData): Promise<void> {
  await requireAnyRole(["teacher", "admin"]);
  const subtopicId = formData.get("subtopicId");
  const rawContent = formData.get("content");
  if (typeof subtopicId !== "string" || typeof rawContent !== "string") {
    throw new Error("Missing subtopic lesson content.");
  }

  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");

  let content: LessonContent;
  try {
    content = JSON.parse(rawContent) as LessonContent;
  } catch {
    throw new Error("The lesson contains invalid data. Check the edited fields and try again.");
  }

  if (
    !content ||
    !Array.isArray(content.sections) ||
    content.sections.length === 0 ||
    content.sections.some((section: LessonSection) =>
      !section.heading?.trim() ||
      !section.explanation?.trim() ||
      !section.example?.trim() ||
      !section.check?.question?.trim()
    )
  ) {
    throw new Error("Every section needs a heading, explanation, example, and check question.");
  }

  await createLessonForSubtopic(
    subtopic.topic.id,
    subtopic.id,
    resanitizeLessonContent(content)
  );
  revalidatePath(`/learn/subtopic/${subtopicId}`);
  redirect(`/learn/subtopic/${subtopicId}`);
}

export async function markOpenAnswerAction({
  topicId,
  sectionHeading,
  question,
  explanation,
  answer,
}: {
  topicId: string;
  sectionHeading: string;
  question: string;
  explanation: string;
  answer: string;
}): Promise<{ feedback: string; marks: number; total: number }> {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  const config = await resolveProviderConfig(profile.id);

  const context = `Section: ${sectionHeading}. ${explanation}`.slice(0, 2000);
  const prompt = `MARKING TASK. You are a tutor. Mark this student answer out of 3 marks, GCSE standard.\n\nQuestion: ${question}\n\nModel answer (key points): ${explanation}\n\nStudent answer: "${answer}"\n\nStart with the marks like "2/3" then give specific feedback naming what was correct or missing, and the correct answer in 1 sentence. Be encouraging but accurate. Under 60 words.`;

  const feedback = (
    await askLessonTutor(topic.name, topic.subject.name, context, [], prompt, config)
  ).reply;

  const match = feedback.match(/(\d)\/3/);
  const marks = match ? parseInt(match[1]) : Math.min(2, Math.ceil(answer.trim().length / 60));

  return { feedback: feedback.replace(/^\d\/3\s*[-–—]?\s*/, ""), marks, total: 3 };
}
