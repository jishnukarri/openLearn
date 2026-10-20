import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getTopic } from "@/lib/supabase/topics";
import { resolveLessonContent } from "@/lib/class-content";
import { resanitizeLessonContent } from "@/lib/lesson-finalize";
import { getLessonPractice } from "@/lib/supabase/lesson-personalise";
import { LessonPlayer } from "./lesson-player";
import { SimplifyForm, TweakForm } from "./lesson-forms";
import { ReportButton } from "@/components/report-button";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { topicId } = await params;

  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const isStudent = profile.role === "student";
  const generated = await resolveLessonContent(topic, profile);
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
          <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-xs text-highlight">
            Previewing as {profile.role}, completing this won&apos;t earn XP.
          </div>
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
