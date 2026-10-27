"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects, getSubjectsNeedingDiagnostic } from "@/lib/supabase/students";
import { generateDiagnosticQuiz } from "@/lib/ai/diagnostic";
import { resolveProviderConfig } from "@/lib/ai/client";
import {
  createDiagnosticSession,
  getDiagnosticQuestions,
  recordDiagnosticAnswer,
  getPendingShortAnswers,
  updateAnswerScore,
  buildKnowledgeModel,
  isDiagnosticSessionOwner,
} from "@/lib/supabase/diagnostic";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { selectTopicsForDiagnostic, RECAP_MAX_TOPICS } from "@/lib/diagnostic-select";
import { db } from "@/lib/supabase/database-client";
import { buildStudentPoolDiagnostic, buildStudentRecapPoolDiagnostic } from "@/lib/guest-diagnostic";
import {
  scoreDiagnosticAnswerInstant,
  sanitiseLevelPayload,
} from "@/lib/diagnostic-scoring";
import { markAnswersBatch } from "@/lib/ai/marking";

// "Fresh" diagnostic: mixed questions across every subject the student just
// picked, used when they haven't started the syllabus yet.
// scope="quick" → first topic per subject only; scope="full" → all topics.
export async function startFreshDiagnosticAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");
  const allSubjects = await getStudentSubjects(profile.id);
  if (allSubjects.length === 0) redirect("/onboarding");

  // Only ever quiz (and spend AI credits generating) subjects that don't
  // already have a saved diagnostic result — a subject is diagnosed once,
  // permanently, until the student explicitly asks to recap it.
  const subjects = await getSubjectsNeedingDiagnostic(profile.id);
  if (subjects.length === 0) redirect("/dashboard");

  const scope = formData.get("scope") === "full" ? "full" : "quick";

  // Prefer the topics' preset question pools: no AI wait, no credits.
  const presetSessionId = await buildStudentPoolDiagnostic({
    studentId: profile.id,
    subjects: subjects.map((s) => ({ subjectId: s.subject_id, examBoardId: s.exam_board_id })),
    scope,
  });
  if (presetSessionId) redirect(`/onboarding/diagnostic/${presetSessionId}/level/0`);

  // Only the start of each subject: pick topics in syllabus order, capped so
  // the whole quiz stays within DIAGNOSTIC_MAX_QUESTIONS.
  const perTopic = scope === "quick" ? 4 : 2;
  const allTopics = await Promise.all(
    subjects.map((s) => listPublishedTopicsBySubject(s.subject_id, s.exam_board_id ?? undefined))
  );
  const { selected } = selectTopicsForDiagnostic(
    scope === "quick" ? allTopics.map((l) => l.slice(0, 1)) : allTopics,
    perTopic
  );
  const topicNamesBySubject = new Map<string, string[]>();
  for (const t of selected) {
    topicNamesBySubject.set(t.subject_id, [...(topicNamesBySubject.get(t.subject_id) ?? []), t.name]);
  }

  const subjectNameToId = new Map<string, string>();
  const { data: rows } = await db
    .from("subjects")
    .select("id, name")
    .in(
      "id",
      subjects.map((s) => s.subject_id)
    );
  for (const row of rows ?? []) subjectNameToId.set(row.name, row.id);

  const config = await resolveProviderConfig(profile.id);
  const questions = await generateDiagnosticQuiz(
    subjects.map((s) => ({
      subjectId: s.subject_id,
      subjectName: s.subject_name,
      topicNames: topicNamesBySubject.get(s.subject_id),
    })),
    "fresh",
    config
  );

  const sessionId = await createDiagnosticSession({
    studentId: profile.id,
    mode: "fresh",
    questions,
    subjectNameToId,
  });

  redirect(`/onboarding/diagnostic/${sessionId}/level/0`);
}

// "Recap" diagnostic: samples up to 6 topics the student says they've
// already covered, to check what actually stuck.
export async function startRecapDiagnosticAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");

  const selections = (formData.getAll("topic") as string[])
    .slice(0, RECAP_MAX_TOPICS)
    .map((v) => {
      const [subjectId, topicName] = v.split("::");
      return { subjectId, topicName };
    });

  if (selections.length === 0) redirect("/dashboard");

  const { data: rows } = await db
    .from("subjects")
    .select("id, name")
    .in(
      "id",
      selections.map((s) => s.subjectId)
    );
  const idToName = new Map((rows ?? []).map((r: any) => [r.id, r.name]));
  const subjectNameToId = new Map((rows ?? []).map((r: any) => [r.name, r.id]));

  const presetSessionId = await buildStudentRecapPoolDiagnostic({ studentId: profile.id, selections });
  if (presetSessionId) redirect(`/onboarding/diagnostic/${presetSessionId}/level/0`);

  const bySubject = new Map<string, string[]>();
  for (const s of selections) {
    const name = idToName.get(s.subjectId);
    if (!name) continue;
    bySubject.set(name, [...(bySubject.get(name) ?? []), s.topicName]);
  }

  const config = await resolveProviderConfig(profile.id);
  const questions = await generateDiagnosticQuiz(
    Array.from(bySubject.entries()).map(([subjectName, topicNames]) => ({
      subjectId: subjectNameToId.get(subjectName)!,
      subjectName,
      topicNames,
    })),
    "recap",
    config
  );

  const sessionId = await createDiagnosticSession({
    studentId: profile.id,
    mode: "recap",
    questions,
    subjectNameToId,
  });

  redirect(`/onboarding/diagnostic/${sessionId}/level/0`);
}

export async function skipDiagnosticAction(): Promise<void> {
  await requireRole("student");
  redirect("/dashboard");
}

// Scores and records exactly one level's question, then moves on to the
// next level (or, on the last level, finalizes the knowledge model and
// heads to results). Each level is its own page/round-trip so nothing is
// lost if the student closes the tab partway through.
export async function submitDiagnosticLevelAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");
  const sessionId = formData.get("sessionId");
  const positionRaw = formData.get("position");
  const payloadRaw = formData.get("answerPayload");
  if (
    typeof sessionId !== "string" ||
    typeof positionRaw !== "string" ||
    typeof payloadRaw !== "string"
  ) {
    throw new Error("Missing level answer.");
  }
  const position = Number(positionRaw);

  if (!(await isDiagnosticSessionOwner(sessionId, profile.id))) {
    throw new Error("Diagnostic session not found.");
  }

  const questions = await getDiagnosticQuestions(sessionId);
  const question = questions[position];
  if (!question) throw new Error("Question not found for this level.");

  let parsedPayload: unknown;
  try {
    parsedPayload = payloadRaw.length > 20_000 ? null : JSON.parse(payloadRaw);
  } catch {
    parsedPayload = null;
  }
  const payload = sanitiseLevelPayload(parsedPayload);
  if (!payload) throw new Error("Invalid answer.");

  // Score instantly for objective question types — no AI needed.
  // Short-answer questions are stored with score=-1 and batch-marked at the
  // very end, so no AI latency on each step.
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
    // Batch-mark all short_answer questions in one AI call.
    // If the AI call fails for any reason, fall back to 0 so the student
    // still completes the diagnostic rather than hitting an error screen.
    const config = await resolveProviderConfig(profile.id);
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
          })),
          config
        );
        await Promise.all(results.map((r) => updateAnswerScore(r.questionId, r.score)));
      } catch {
        await Promise.all(pending.map((p) => updateAnswerScore(p.questionId, 0)));
      }
    }
    await buildKnowledgeModel(sessionId, profile.id);
    redirect(`/onboarding/diagnostic/${sessionId}/results`);
  }
  redirect(`/onboarding/diagnostic/${sessionId}/level/${position + 1}`);
}
