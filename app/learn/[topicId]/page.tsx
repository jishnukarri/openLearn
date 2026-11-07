import { notFound } from "next/navigation";
import { Callout } from "@/components/callout";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { resolveLessonContent } from "@/lib/class-content";
import { getSimplifiedLesson } from "@/lib/simplified-lessons";
import { resanitizeLessonContent } from "@/lib/lesson-finalize";
import { getLessonPractice } from "@/lib/supabase/lesson-personalise";
import { LessonPlayer } from "./lesson-player";
import { SimplifyForm, TweakForm } from "./lesson-forms";
import { ReportButton } from "@/components/report-button";
import { LessonCompletedCard } from "@/components/lesson-completed-card";
import { isTopicCompleted } from "@/lib/supabase/progress";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ redo?: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { topicId } = await params;

  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const isStudent = profile.role === "student";

  // A finished lesson offers the exam questions first. The lesson itself is not
  // loaded (or regenerated) until the student chooses to redo it.
  const { redo } = await searchParams;
  if (isStudent && redo !== "1" && (await isTopicCompleted(profile.id, topicId))) {
    return (
      <LessonCompletedCard
        title={topic.name}
        practiceHref={`/practice/${topicId}`}
        redoHref={`/learn/${topicId}?redo=1`}
      />
    );
  }
  const generated =
    (isStudent ? getSimplifiedLesson(profile.id, topicId) : null) ?? (await resolveLessonContent(topic, profile));
  const lesson = resanitizeLessonContent(generated);

  const practice = isStudent
    ? await getLessonPractice({ studentId: profile.id, topic: { id: topic.id, name: topic.name, subject_id: topic.subject_id } })
    : null;

  // Students get a full-page, full-width lesson experience
  if (isStudent) {
    return (
      <LessonPlayer
        topicId={topicId}
        hook={lesson.hook}
        interactive={lesson.interactive}
        sections={lesson.sections}
        practice={practice}
        exitHref="/dashboard"
        title={topic.name}
        subtitle={topic.subject.name}
        mode="topic"
      />
    );
  }

  // Admin / teacher: preview banner above the full-screen lesson
  return (
    <div className="flex flex-col">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4">
          <Callout tone="warning" size="sm" role="none">
            Previewing as {profile.role}, completing this won&apos;t earn XP.
          </Callout>
          <div className="flex flex-wrap items-start gap-3">
            <SimplifyForm topicId={topicId} />
            <TweakForm topicId={topicId} />
            <ReportButton contextLabel={`Lesson: ${topic.name}`} topicId={topicId} />
          </div>
        </div>
      </div>
      <LessonPlayer
        topicId={topicId}
        hook={lesson.hook}
        interactive={lesson.interactive}
        sections={lesson.sections}
        practice={practice}
        exitHref="/dashboard"
        title={topic.name}
        subtitle={topic.subject.name}
        mode="topic"
      />
    </div>
  );
}
