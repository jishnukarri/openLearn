import { notFound } from "next/navigation";
import { requireAnyRole } from "@/lib/appwrite/session";
import { getSubtopic } from "@/lib/supabase/topics";
import { resolveLessonForSubtopic } from "@/lib/subtopic-content";
import { resanitizeLessonContent } from "@/lib/lesson-finalize";
import { LessonPlayer } from "../../[topicId]/lesson-player";
import { SubtopicTweakForm } from "../../[topicId]/lesson-forms";
import { SubtopicLessonEditor } from "@/components/subtopic-lesson-editor";

export default async function SubtopicLessonPage({
  params,
}: {
  params: Promise<{ subtopicId: string }>;
}) {
  const { profile } = await requireAnyRole(["student", "teacher", "admin"]);
  const { subtopicId } = await params;

  const subtopic = await getSubtopic(subtopicId);
  if (!subtopic) notFound();

  const generated = await resolveLessonForSubtopic(subtopic, profile.id);
  const lesson = resanitizeLessonContent(generated);

  const isPreview = profile.role !== "student";

  // Students get the same full-width, full-screen lesson experience as topic lessons.
  if (!isPreview) {
    return (
      <LessonPlayer
        topicId={subtopicId}
        hook={lesson.hook}
        interactive={lesson.interactive}
        sections={lesson.sections}
        mode="subtopic"
        coachTopicId={subtopic.topic.id}
        title={subtopic.name}
        subtitle={`${subtopic.topic.subject.name} · ${subtopic.topic.name}`}
        exitHref="/dashboard"
        practiceHref={`/practice/subtopic/${subtopicId}`}
        flashcardsHref={`/flashcards/subtopic/${subtopicId}`}
      />
    );
  }

  // Admin / teacher: constrained preview layout with editing tools above the player.
  return (
    <div className="flex flex-col">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4">
          <div className="rounded-xl border border-highlight/40 bg-highlight/10 px-4 py-2 text-xs text-highlight">
            Previewing as {profile.role}, completing this won&apos;t earn XP.
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {subtopic.topic.subject.name} · {subtopic.topic.name}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
              {subtopic.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <SubtopicTweakForm subtopicId={subtopicId} />
          </div>
          <SubtopicLessonEditor subtopicId={subtopicId} initialContent={lesson} />
        </div>
      </div>
      <LessonPlayer
        topicId={subtopicId}
        hook={lesson.hook}
        interactive={lesson.interactive}
        sections={lesson.sections}
        mode="subtopic"
        coachTopicId={subtopic.topic.id}
        title={subtopic.name}
        subtitle={`${subtopic.topic.subject.name} · ${subtopic.topic.name}`}
        exitHref="/dashboard"
        practiceHref={`/practice/subtopic/${subtopicId}`}
        flashcardsHref={`/flashcards/subtopic/${subtopicId}`}
      />
    </div>
  );
}
