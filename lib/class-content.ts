import "server-only";
import type { TopicWithSubject } from "@/lib/supabase/topics";
import type { Profile } from "@/lib/supabase/profiles";
import { getForkingAssignment } from "@/lib/supabase/assignments";
import { getLessonWithVersion, createLesson } from "@/lib/supabase/lessons";
import { isCurrentLesson } from "@/lib/lesson-version";
import { getQuestionForTopic, createQuestion, type Question } from "@/lib/supabase/questions";
import { generateLesson, type LessonContent } from "@/lib/ai/lessons";
import { generateQuestion } from "@/lib/ai/questions";
import { resolveProviderConfig } from "@/lib/ai/client";
import { finalizeLessonContent } from "@/lib/lesson-finalize";
import { withReferenceContext } from "@/lib/rag";
import { getGroundingBlock } from "@/lib/supabase/spec-grounding";

// Fork-on-demand: a class only gets its own lesson/question once a teacher
// attaches a customization note to an assignment for it — most classes
// never fork, so most content stays shared (cheap, one generation for
// every self-study student too) and only the customized ones cost an
// extra AI call, generated once and cached from then on.

// One generation per lesson slot at a time. Opening a new lesson twice (a
// prefetch, a double navigation, a refresh while it builds) used to start a
// second paid generation and race the first; later callers now wait on the
// first one's promise and get the same saved lesson.
const generating = new Map<string, Promise<LessonContent>>();

export function resolveLessonContent(topic: TopicWithSubject, profile: Profile): Promise<LessonContent> {
  return resolveLessonContentOnce(topic, profile);
}

async function resolveLessonContentOnce(topic: TopicWithSubject, profile: Profile): Promise<LessonContent> {
  const fork = profile.role === "student" ? await getForkingAssignment(profile.id, topic.id) : null;
  const key = `${topic.id}:${fork?.classId ?? "shared"}`;
  const running = generating.get(key);
  if (running) return running;
  const p = resolveLessonContentUncached(topic, profile, fork);
  generating.set(key, p);
  try {
    return await p;
  } finally {
    if (generating.get(key) === p) generating.delete(key);
  }
}

async function resolveLessonContentUncached(
  topic: TopicWithSubject,
  profile: Profile,
  fork: Awaited<ReturnType<typeof getForkingAssignment>>
): Promise<LessonContent> {
  const classId = fork?.classId ?? null;
  const stored = await getLessonWithVersion(topic.id, classId);
  const usable = !!stored && !!stored.content.sections[0]?.check;
  if (stored && usable && isCurrentLesson(stored.version)) return stored.content;

  // Missing, or written by an older version of the lesson format: generate a new
  // one, which replaces it (the newest row wins). If that fails, an old lesson
  // that still works is better than an error.
  try {
    const config = await resolveProviderConfig(profile.id);
    const instructions = await withReferenceContext(
      topic.id,
      topic.name,
      fork
        ? [topic.custom_instructions, `For this class: ${fork.notes}`].filter(Boolean).join("\n\n")
        : topic.custom_instructions
    );
    const generated = await generateLesson(topic.name, topic.subject.name, false, instructions, config);
    const finalized = await finalizeLessonContent(generated, topic.id, topic.subject.name);
    await createLesson(topic.id, finalized, classId);
    return finalized;
  } catch (e) {
    if (stored && usable) {
      console.warn("[lessons] could not upgrade an older lesson, showing it as it is:", e instanceof Error ? e.message : e);
      return stored.content;
    }
    throw e;
  }
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
    const generated = await generateQuestion(topic.name, topic.subject.name, instructions, config, await getGroundingBlock({ topicId: topic.id }));
    return createQuestion(topic.id, generated, fork.classId);
  }

  if (!opts?.force) {
    const existing = await getQuestionForTopic(topic.id);
    if (existing) return existing;
  }

  const config = await resolveProviderConfig(profile.id);
  const instructions = await withReferenceContext(topic.id, topic.name, topic.custom_instructions);
  const generated = await generateQuestion(topic.name, topic.subject.name, instructions, config, await getGroundingBlock({ topicId: topic.id }));
  return createQuestion(topic.id, generated);
}
