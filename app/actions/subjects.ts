"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyRole, requireOwnerOrAdmin } from "@/lib/appwrite/session";
import {
  createSubject,
  createExamBoard,
  getSubject,
  publishSubject,
  unpublishSubject,
  deleteSubject,
  updateSpecText,
  updateSubjectInstructions,
  updateSubjectName,
  updateSubjectArchetype,
  getSpecTextForSubject,
  getSpecTextForBoard,
  type SubjectArchetype,
} from "@/lib/supabase/subjects";
import { generateTopicsForSubject, generateSingleTopic } from "@/lib/ai/topics";
import { generateLesson } from "@/lib/ai/lessons";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { resolveProviderConfig } from "@/lib/ai/client";
import { generateTopicDiagnosticPool } from "@/lib/ai/diagnostic-pool";
import { saveTopicDiagnosticPool } from "@/lib/supabase/topic-diagnostic-questions";
import {
  createTopics,
  createCustomTopic,
  deleteTopic,
  deleteSubtopic,
  getTopic,
  getSubtopic,
  publishTopic,
  publishSubtopic,
  unpublishTopic,
  unpublishSubtopic,
  updateTopic,
  updateSubtopic,
  publishAllTopicsBySubject,
  updateTopicInstructions,
  listTopicsBySubject,
  deleteDraftTopicsBySubject,
  deleteDraftTopicsBySubjectAndBoard,
} from "@/lib/supabase/topics";
import { pregenerateTopicContent } from "@/lib/content-pipeline";
import { extractTextFromFile } from "@/lib/extract-text";
import { createLesson, createLessonForSubtopic } from "@/lib/supabase/lessons";
import { finalizeLessonContent } from "@/lib/lesson-finalize";
import { withReferenceContext } from "@/lib/rag";

export async function addExamBoardAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireAnyRole(["admin", "teacher"]);
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length < 2) {
    return { error: "Exam board name must be at least 2 characters." };
  }

  try {
    await createExamBoard(name.trim());
  } catch (error: any) {
    if (error?.code === "23505") {
      return { error: `"${name.trim()}" already exists.` };
    }
    return { error: "Something went wrong — please try again." };
  }

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  return null;
}

const CreateSubjectSchema = z.object({
  name: z.string().min(2, "Subject name must be at least 2 characters.").trim(),
  examBoardIds: z.array(z.string()).min(1, "Pick at least one exam board."),
});

const RenameSubjectSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().min(2, "Subject name must be at least 2 characters.").trim(),
});

export async function renameSubjectAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const validated = RenameSubjectSchema.safeParse({
    subjectId: formData.get("subjectId"),
    name: formData.get("name"),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input." };
  }
  const { subjectId, name } = validated.data;
  await requireOwnerOrAdmin(subjectId);

  try {
    await updateSubjectName(subjectId, name);
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") {
      return { error: "A subject with that name already exists." };
    }
    return { error: "Something went wrong — please try again." };
  }

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
  revalidatePath("/subjects/[subjectId]", "page");
  revalidatePath("/dashboard");
  return null;
}

export async function createSubjectAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { profile } = await requireAnyRole(["admin", "teacher"]);

  const validated = CreateSubjectSchema.safeParse({
    name: formData.get("name"),
    examBoardIds: formData.getAll("examBoardIds"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await createSubject({
      name: validated.data.name,
      createdBy: profile.id,
      examBoardIds: validated.data.examBoardIds,
    });
  } catch {
    return { error: "Something went wrong — please try again." };
  }

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
  return null;
}

export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  await requireOwnerOrAdmin(subjectId);

  await deleteSubject(subjectId);
  revalidatePath("/admin/subjects");
  revalidatePath("/teacher/subjects");
  const redirectTo = formData.get("redirectTo");
  redirect(typeof redirectTo === "string" && redirectTo ? redirectTo : "/admin/subjects");
}

export async function publishSubjectAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  const { profile } = await requireOwnerOrAdmin(subjectId);

  await publishSubject(subjectId);
  const topics = await publishAllTopicsBySubject(subjectId);
  await Promise.all(topics.map((t) => pregenerateTopicContent(t.id, profile.id)));

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

// Pulls the whole subject off the published subjects list (self-study
// pickers, dashboards) without touching topic/subtopic status underneath —
// republishing brings it straight back as it was.
export async function unpublishSubjectAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  await requireOwnerOrAdmin(subjectId);

  await unpublishSubject(subjectId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function saveSpecAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  const examBoardId = formData.get("examBoardId");
  if (typeof subjectId !== "string" || typeof examBoardId !== "string") {
    throw new Error("Missing subjectId or examBoardId.");
  }
  await requireOwnerOrAdmin(subjectId);

  const pastedText = formData.get("specText");
  const file = formData.get("specFile");

  // A real uploaded file wins over the pasted-text field if both are given.
  let specText = typeof pastedText === "string" ? pastedText : "";
  if (file instanceof File && file.size > 0) {
    specText = await extractTextFromFile(file);
  }
  await updateSpecText(subjectId, examBoardId, specText);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function generateTopicsAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  const examBoardId = formData.get("examBoardId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  const { profile } = await requireOwnerOrAdmin(subjectId);

  const subject = await getSubject(subjectId);
  if (!subject) throw new Error("Subject not found.");

  const config = await resolveProviderConfig(profile.id);

  let specText: string | undefined;
  let boardNames: string[];
  let created;

  if (typeof examBoardId === "string" && examBoardId) {
    // Per-board generation: only generate and replace drafts for this board
    const board = subject.exam_boards.find((b) => b.id === examBoardId);
    boardNames = board ? [board.name] : [];
    specText = (await getSpecTextForBoard(subjectId, examBoardId)) || undefined;

    const generated = await generateTopicsForSubject(
      subject.name,
      boardNames,
      specText,
      subject.custom_instructions ?? undefined,
      config
    );
    await deleteDraftTopicsBySubjectAndBoard(subjectId, examBoardId);
    created = await createTopics(subjectId, generated, examBoardId);
  } else {
    // Single-board or legacy: generate for all boards together
    specText = (await getSpecTextForSubject(subjectId)) || undefined;
    boardNames = subject.exam_boards.map((b) => b.name);

    const generated = await generateTopicsForSubject(
      subject.name,
      boardNames,
      specText,
      subject.custom_instructions ?? undefined,
      config
    );
    await deleteDraftTopicsBySubject(subjectId);
    created = await createTopics(subjectId, generated);
  }

  await Promise.allSettled([
    ...created.map((t) => pregenerateTopicContent(t.id, profile.id)),
    ...created.map((t) => pregenerateDiagnosticPool(t.id, t.name, subject.name, profile.id)),
  ]);

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

// Admin-time cost, paid once per topic: a bank of 10 diagnostic questions
// the guest-onboarding flow samples from later at zero marginal AI cost
// (see lib/supabase/topic-diagnostic-questions.ts). Failure here shouldn't
// block topic creation — a topic without a pool just isn't offered in the
// guest diagnostic yet, same "don't block on this" posture as lesson
// pregeneration.
async function pregenerateDiagnosticPool(
  topicId: string,
  topicName: string,
  subjectName: string,
  profileId: string
): Promise<void> {
  const config = await resolveProviderConfig(profileId);
  const questions = await generateTopicDiagnosticPool(topicName, subjectName, config);
  await saveTopicDiagnosticPool(topicId, questions);
}

export async function generateSingleTopicAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  const examBoardId = formData.get("examBoardId");
  const hint = formData.get("hint");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  const { profile } = await requireOwnerOrAdmin(subjectId);

  const subject = await getSubject(subjectId);
  if (!subject) throw new Error("Subject not found.");

  const config = await resolveProviderConfig(profile.id);
  const existing = await listTopicsBySubject(subjectId);

  const boardId = typeof examBoardId === "string" && examBoardId ? examBoardId : undefined;
  const board = boardId ? subject.exam_boards.find((b) => b.id === boardId) : undefined;
  const boardNames = board ? [board.name] : subject.exam_boards.map((b) => b.name);

  const generated = await generateSingleTopic(
    subject.name,
    boardNames,
    existing.map((t) => t.name),
    typeof hint === "string" && hint.trim() ? hint.trim() : undefined,
    subject.custom_instructions ?? undefined,
    config
  );
  const [created] = await createTopics(subjectId, [generated], boardId);
  await Promise.allSettled([
    pregenerateTopicContent(created.id, profile.id),
    pregenerateDiagnosticPool(created.id, created.name, subject.name, profile.id),
  ]);

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

const CustomTopicSchema = z.object({
  name: z.string().min(2, "Topic name must be at least 2 characters.").trim(),
  summary: z.string().trim(),
});

export async function addCustomTopicAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  const examBoardId = formData.get("examBoardId");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  const { profile } = await requireOwnerOrAdmin(subjectId);

  const validated = CustomTopicSchema.safeParse({
    name: formData.get("name"),
    summary: formData.get("summary"),
  });
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message ?? "Invalid input.");
  }

  const boardId = typeof examBoardId === "string" && examBoardId ? examBoardId : undefined;
  const topic = await createCustomTopic({
    subjectId,
    examBoardId: boardId,
    name: validated.data.name,
    summary: validated.data.summary,
  });
  await pregenerateTopicContent(topic.id, profile.id);

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function deleteTopicAction(formData: FormData): Promise<void> {
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  await requireOwnerOrAdmin(topic.subject.id);

  await deleteTopic(topicId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function deleteSubtopicAction(formData: FormData): Promise<void> {
  const subtopicId = formData.get("subtopicId");
  if (typeof subtopicId !== "string") throw new Error("Missing subtopicId.");
  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");
  await requireOwnerOrAdmin(subtopic.topic.subject.id);

  await deleteSubtopic(subtopicId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

const VALID_ARCHETYPES: SubjectArchetype[] = [
  "dynamic_causal",
  "decision_incentive",
  "spatial_pattern",
  "procedural_structural",
  "sequential_process",
];

export async function saveSubjectArchetypeAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  const archetypeRaw = formData.get("archetype");
  if (typeof subjectId !== "string") throw new Error("Missing subjectId.");
  await requireOwnerOrAdmin(subjectId);

  const archetype =
    typeof archetypeRaw === "string" && VALID_ARCHETYPES.includes(archetypeRaw as SubjectArchetype)
      ? (archetypeRaw as SubjectArchetype)
      : null;

  await updateSubjectArchetype(subjectId, archetype);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function saveSubjectInstructionsAction(formData: FormData): Promise<void> {
  const subjectId = formData.get("subjectId");
  const instructions = formData.get("instructions");
  if (typeof subjectId !== "string" || typeof instructions !== "string") {
    throw new Error("Missing subjectId or instructions.");
  }
  await requireOwnerOrAdmin(subjectId);

  await updateSubjectInstructions(subjectId, instructions);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function saveTopicInstructionsAction(formData: FormData): Promise<void> {
  const topicId = formData.get("topicId");
  const instructions = formData.get("instructions");
  if (typeof topicId !== "string" || typeof instructions !== "string") {
    throw new Error("Missing topicId or instructions.");
  }
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  await requireOwnerOrAdmin(topic.subject.id);

  await updateTopicInstructions(topicId, instructions);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function publishTopicAction(formData: FormData): Promise<void> {
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  const { profile } = await requireOwnerOrAdmin(topic.subject.id);

  await publishTopic(topicId);
  await pregenerateTopicContent(topicId, profile.id);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function publishSubtopicAction(formData: FormData): Promise<void> {
  const subtopicId = formData.get("subtopicId");
  if (typeof subtopicId !== "string") throw new Error("Missing subtopicId.");
  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");
  await requireOwnerOrAdmin(subtopic.topic.subject.id);

  await publishSubtopic(subtopicId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function unpublishTopicAction(formData: FormData): Promise<void> {
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  await requireOwnerOrAdmin(topic.subject.id);

  await unpublishTopic(topicId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function unpublishSubtopicAction(formData: FormData): Promise<void> {
  const subtopicId = formData.get("subtopicId");
  if (typeof subtopicId !== "string") throw new Error("Missing guide ID.");
  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");
  await requireOwnerOrAdmin(subtopic.topic.subject.id);

  await unpublishSubtopic(subtopicId);
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function editTopicAction(formData: FormData): Promise<void> {
  const topicId = formData.get("topicId");
  const name = formData.get("name");
  const summary = formData.get("summary");
  if (typeof topicId !== "string" || typeof name !== "string" || typeof summary !== "string") {
    throw new Error("Missing topic details.");
  }
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  await requireOwnerOrAdmin(topic.subject.id);

  if (name.trim().length < 2) throw new Error("Topic name must be at least 2 characters.");
  await updateTopic(topicId, { name: name.trim(), summary: summary.trim() });
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function editSubtopicAction(formData: FormData): Promise<void> {
  const subtopicId = formData.get("subtopicId");
  const name = formData.get("name");
  if (typeof subtopicId !== "string" || typeof name !== "string" || name.trim().length < 2) {
    throw new Error("Guide name must be at least 2 characters.");
  }
  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");
  await requireOwnerOrAdmin(subtopic.topic.subject.id);

  await updateSubtopic(subtopicId, name.trim());
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

function revalidateSubjectPages() {
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]", "page");
}

export async function regenerateTopicLessonAction(formData: FormData): Promise<void> {
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string") throw new Error("Missing topicId.");
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  const { profile } = await requireOwnerOrAdmin(topic.subject.id);
  if (!(await checkKeyRateLimit("lesson-regenerate", profile.id, 6, 10 * 60_000))) {
    throw new Error("Please wait a few minutes before regenerating again.");
  }

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topicId, topic.name, topic.custom_instructions);
  const lesson = await generateLesson(topic.name, topic.subject.name, false, instructions, config);
  await createLesson(topicId, await finalizeLessonContent(lesson, topicId, topic.subject.name));
  revalidateSubjectPages();
  revalidatePath(`/learn/${topicId}`);
}

export async function regenerateSubtopicLessonAction(formData: FormData): Promise<void> {
  const subtopicId = formData.get("subtopicId");
  if (typeof subtopicId !== "string") throw new Error("Missing subtopicId.");
  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) throw new Error("Subtopic not found.");
  const { profile } = await requireOwnerOrAdmin(subtopic.topic.subject.id);
  if (!(await checkKeyRateLimit("lesson-regenerate", profile.id, 6, 10 * 60_000))) {
    throw new Error("Please wait a few minutes before regenerating again.");
  }

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(
    subtopic.topic.id,
    subtopic.name,
    subtopic.topic.custom_instructions
  );
  const lesson = await generateLesson(subtopic.name, subtopic.topic.subject.name, false, instructions, config);
  await createLessonForSubtopic(
    subtopic.topic.id,
    subtopic.id,
    await finalizeLessonContent(lesson, subtopic.id, subtopic.topic.subject.name)
  );
  revalidateSubjectPages();
  revalidatePath(`/learn/subtopic/${subtopicId}`);
}

export async function updateQuestionVerificationAction(input: {
  questionId: string;
  verified: boolean;
  prompt?: string;
  modelAnswer?: string;
}): Promise<void> {
  await requireAnyRole(["admin", "teacher"]);
  const { updateQuestionVerification } = await import("@/lib/supabase/questions");
  await updateQuestionVerification(input.questionId, input.verified, {
    prompt: input.prompt,
    model_answer: input.modelAnswer,
  });
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subjects/[subjectId]", "page");
}

