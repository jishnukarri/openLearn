"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects, getSubjectsNeedingDiagnostic, getFirstTopicPerSubject } from "@/lib/supabase/students";
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
import { createServiceClient } from "@/lib/supabase/server";
import {
  scoreDiagnosticAnswerInstant,
  type LevelAnswerPayload,
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

  // For "quick", pin each subject to its first published topic so the
  // quiz stays short (one topic × ~3 questions each).
  let topicMap: Map<string, string> | null = null;
  if (scope === "quick") {
    topicMap = await getFirstTopicPerSubject(subjects.map((s) => s.subject_id));
  }

  const supabase = createServiceClient();
  const subjectNameToId = new Map<string, string>();
  const { data: rows } = await supabase
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
      topicNames: topicMap ? (topicMap.get(s.subject_id) ? [topicMap.get(s.subject_id)!] : undefined) : undefined,
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

// "Recap" diagnostic: samples up to 3 topics the student says they've
// already covered, to check what actually stuck.
export async function startRecapDiagnosticAction(formData: FormData): Promise<void> {
  const { profile } = await requireRole("student");

  const selections = (formData.getAll("topic") as string[])
    .slice(0, 3)
    .map((v) => {
      const [subjectId, topicName] = v.split("::");
      return { subjectId, topicName };
    });

  if (selections.length === 0) redirect("/dashboard");

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from("subjects")
    .select("id, name")
    .in(
      "id",
      selections.map((s) => s.subjectId)
    );
  const idToName = new Map((rows ?? []).map((r: any) => [r.id, r.name]));
  const subjectNameToId = new Map((rows ?? []).map((r: any) => [r.name, r.id]));

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

  let payload: LevelAnswerPayload;
  try {
    payload = JSON.parse(payloadRaw) as LevelAnswerPayload;
  } catch {
    throw new Error("Invalid answer.");
  }

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
