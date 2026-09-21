import "server-only";
import type { TopicWithSubject } from "@/lib/supabase/topics";
import type { Profile } from "@/lib/supabase/profiles";
import { getForkingAssignment } from "@/lib/supabase/assignments";
import { getLessonByTopic, createLesson } from "@/lib/supabase/lessons";
import { getQuestionForTopic, createQuestion, type Question } from "@/lib/supabase/questions";
import { generateLesson, type LessonContent } from "@/lib/ai/lessons";
import { generateQuestion } from "@/lib/ai/questions";
import { resolveProviderConfig } from "@/lib/ai/client";
import { finalizeLessonContent } from "@/lib/lesson-finalize";
import { withReferenceContext } from "@/lib/rag";

// Fork-on-demand: a class only gets its own lesson/question once a teacher
// attaches a customization note to an assignment for it — most classes
// never fork, so most content stays shared (cheap, one generation for
// every self-study student too) and only the customized ones cost an
// extra AI call, generated once and cached from then on.

export async function resolveLessonContent(
  topic: TopicWithSubject,
  profile: Profile
): Promise<LessonContent> {
  const fork = profile.role === "student" ? await getForkingAssignment(profile.id, topic.id) : null;

  if (fork) {
    const existing = await getLessonByTopic(topic.id, fork.classId);
    if (existing && existing.sections[0]?.check) return existing;

    const config = await resolveProviderConfig(profile.id);
    const instructions = await withReferenceContext(
      topic.id,
      topic.name,
      [topic.custom_instructions, `For this class: ${fork.notes}`].filter(Boolean).join("\n\n")
    );
    const generated = await generateLesson(topic.name, topic.subject.name, false, instructions, config);
    const finalized = await finalizeLessonContent(generated, topic.id);
    await createLesson(topic.id, finalized, fork.classId);
    return finalized;
  }

  const existing = await getLessonByTopic(topic.id);
  if (existing && existing.sections[0]?.check) return existing;

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topic.id, topic.name, topic.custom_instructions);
  const generated = await generateLesson(topic.name, topic.subject.name, false, instructions, config);
  const finalized = await finalizeLessonContent(generated, topic.id);
  await createLesson(topic.id, finalized);
  return finalized;
}

// force=true always generates a fresh question (used by "try a similar
// question") — still saved into the right slot (the class fork if this
// student is in a forked context, otherwise shared) so it stays consistent
// with whatever the student was just looking at.
export async function resolveQuestionContent(
  topic: TopicWithSubject,
  profile: Profile,
  opts?: { force?: boolean }
): Promise<Question> {
  const fork = profile.role === "student" ? await getForkingAssignment(profile.id, topic.id) : null;

  if (fork) {
    if (!opts?.force) {
      const existing = await getQuestionForTopic(topic.id, fork.classId);
      if (existing) return existing;
    }
    const config = await resolveProviderConfig(profile.id);
    const instructions = await withReferenceContext(
      topic.id,
      topic.name,
      [topic.custom_instructions, `For this class: ${fork.notes}`].filter(Boolean).join("\n\n")
    );
    const generated = await generateQuestion(topic.name, topic.subject.name, instructions, config);
    return createQuestion(topic.id, generated, fork.classId);
  }

  if (!opts?.force) {
    const existing = await getQuestionForTopic(topic.id);
    if (existing) return existing;
  }

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topic.id, topic.name, topic.custom_instructions);
  const generated = await generateQuestion(topic.name, topic.subject.name, instructions, config);
  return createQuestion(topic.id, generated);
}
