import Link from "next/link";
import { Sparkles, ClipboardCheck, Layers, ListChecks, Plus, Flame, Zap, ArrowRight, type LucideIcon } from "lucide-react";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects, getWeakTopics, getSubjectsNeedingDiagnostic } from "@/lib/supabase/students";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { listAssignmentsForStudent } from "@/lib/supabase/assignments";
import { getCompletedTopicIds } from "@/lib/supabase/progress";
import { AnimatedNumber } from "@/components/animated-number";
import { ButtonLink } from "@/components/button";
import { PageShell, AsideBlock } from "@/components/page-shell";
import { Stagger, Rise } from "@/components/motion";

// Flat colours, not gradients, each subject gets one solid hue so cards stay
// legible and consistent instead of a mesh of purple-to-indigo blends.
const SUBJECT_COLOURS = [
  "bg-primary",
  "bg-teal-700",
  "bg-rose-700",
  "bg-purple-700",
  "bg-orange-700",
  "bg-blue-700",
];

export default async function DashboardPage() {
  const { profile } = await requireRole("student");
  const [subjects, weakTopics, assignments, needingDiagnostic, completedTopicIds] = await Promise.all([
    getStudentSubjects(profile.id),
    getWeakTopics(profile.id),
    listAssignmentsForStudent(profile.id),
    getSubjectsNeedingDiagnostic(profile.id),
    getCompletedTopicIds(profile.id),
  ]);
  const topicsBySubject = await Promise.all(
    subjects.map(async (subject) => ({
      subject,
      topics: await listPublishedTopicsBySubject(subject.subject_id),
    }))
  );
  const allTopics = topicsBySubject.flatMap(({ topics }) => topics);
  const continueTopic = assignments[0]?.topic_id ?? allTopics[0]?.id;
  const continueName = assignments[0]?.topic_name ?? allTopics[0]?.name;
  const firstName = profile.full_name?.split(" ")[0] ?? "there";
  const completedTotal = allTopics.filter((t) => completedTopicIds.has(t.id)).length;
  const overallPct = allTopics.length ? Math.round((completedTotal / allTopics.length) * 100) : 0;

  const aside = (
    <>
      <AsideBlock title="Your progress">
        {allTopics.length > 0 ? (
          <>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-foreground">
              {completedTotal}
              <span className="text-base font-normal text-muted"> of {allTopics.length} topics complete</span>
            </p>
            <div
              role="progressbar"
              aria-label="Topics complete"
              aria-valuenow={overallPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-surface"
            >
              <div className="h-full rounded-full bg-highlight" style={{ width: `${overallPct}%` }} />
            </div>
          </>
        ) : (
          <p>Progress shows up here once your subjects have published topics.</p>
        )}
      </AsideBlock>

      <AsideBlock title="Recommended focus">
        {weakTopics.length > 0 ? (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {weakTopics.slice(0, 3).map((topic, index) => (
                <li key={`${topic.subject_name}-${index}`} className="py-2 first:pt-0">
                  <p className="text-sm font-medium text-foreground">{topic.topic_name ?? topic.subject_name}</p>
                  <p>
                    {topic.subject_name} · {Math.round(topic.score * 100)}% diagnostic score
                  </p>
                </li>
              ))}
            </ul>
            <p>If these come from an old run, retake the diagnostic to refresh them.</p>
          </>
        ) : needingDiagnostic.length > 0 ? (
          <p>
            {needingDiagnostic.map((s) => s.subject_name).join(", ")}{" "}
            {needingDiagnostic.length === 1 ? "hasn't" : "haven't"} been checked yet. A quick quiz tells us what to teach
            first instead of guessing.
          </p>
        ) : (
          <p>You&apos;re all caught up. No new diagnostic needed right now.</p>
        )}
        {(weakTopics.length > 0 || needingDiagnostic.length > 0) && (
          <ButtonLink href="/onboarding/diagnostic" className="mt-2 w-full text-sm" size="default">
            {needingDiagnostic.length > 0 ? "Start diagnostic" : "Retake diagnostic"}
          </ButtonLink>
        )}
      </AsideBlock>

      <AsideBlock title="Quick tools">
        <ul className="grid grid-cols-2 gap-2">
          {continueTopic && (
            <>
              <QuickTool href={`/learn/${continueTopic}`} icon={Sparkles} label="AI coach" />
              <QuickTool href={`/practice/${continueTopic}`} icon={ClipboardCheck} label="Practice" />
              <QuickTool href={`/flashcards/${continueTopic}`} icon={Layers} label="Flashcards" />
            </>
          )}
          <QuickTool href="/onboarding/diagnostic" icon={ListChecks} label="Diagnostic" />
          <QuickTool href="/dashboard/add-subjects" icon={Plus} label="Subjects" />
        </ul>
      </AsideBlock>
    </>
  );

  return (
    <PageShell size="wide" aside={aside} className="pb-24 sm:pb-14">
      <Stagger className="flex flex-col gap-10">
        <Rise className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight text-foreground lg:text-5xl">
            Good to see you, {firstName}.
          </h1>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 font-[family-name:var(--font-mono)] text-sm text-highlight">
              <Zap className="size-4" strokeWidth={2} aria-hidden /> <AnimatedNumber value={profile.xp} /> XP
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 font-[family-name:var(--font-mono)] text-sm text-secondary">
              <Flame className="size-4" strokeWidth={2} aria-hidden /> <AnimatedNumber value={profile.streak_count} /> day streak
            </span>
          </div>
        </Rise>

        {continueTopic && (
          <Rise>
            <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-6">
              <div className="min-w-0">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Continue learning</h2>
                {continueName && <p className="mt-1 text-base text-muted">{continueName}</p>}
              </div>
              <ButtonLink href={`/learn/${continueTopic}`} className="gap-2">
                Resume <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </ButtonLink>
            </section>
          </Rise>
        )}

        <Rise>
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">My subjects</h2>
              <Link
                href="/dashboard/add-subjects"
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-foreground"
              >
                Manage
              </Link>
            </div>

            {topicsBySubject.length === 0 ? (
              <p className="mt-5 text-base text-muted">
                No subjects yet.{" "}
                <Link href="/dashboard/add-subjects" className="text-primary hover:underline">
                  Add your first subject
                </Link>
                .
              </p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {topicsBySubject.map(({ subject, topics }, index) => {
                  const firstTopic = topics[0];
                  const completedCount = topics.filter((t) => completedTopicIds.has(t.id)).length;
                  const pct = topics.length ? Math.round((completedCount / topics.length) * 100) : 0;
                  const status =
                    topics.length === 0
                      ? "No topics yet"
                      : completedCount === 0
                        ? "Not started"
                        : completedCount === topics.length
                          ? "All topics complete"
                          : `${completedCount} of ${topics.length} complete`;
                  return (
                    <Link
                      key={subject.subject_id}
                      href={firstTopic ? `/subjects/${subject.subject_id}` : "/dashboard/add-subjects"}
                      className={`card-lift min-h-40 rounded-2xl p-4 text-white ${SUBJECT_COLOURS[index % SUBJECT_COLOURS.length]}`}
                    >
                      <p className="text-sm font-medium text-white/80">{subject.exam_board_name}</p>
                      <h3 className="mt-7 font-[family-name:var(--font-display)] text-xl font-semibold">{subject.subject_name}</h3>
                      <div className="mt-5">
                        <div className="flex items-center justify-between text-sm text-white/85">
                          <span>{status}</span>
                          <span>
                            {topics.length} {topics.length === 1 ? "topic" : "topics"}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/20">
                          <div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </Rise>

        {assignments.length > 0 && (
          <Rise>
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">Set work</h2>
              <ul className="mt-3 flex flex-col divide-y divide-border border-y border-border">
                {assignments.slice(0, 3).map((assignment) => (
                  <li key={assignment.id}>
                    <Link
                      href={assignment.subtopic_id ? `/learn/subtopic/${assignment.subtopic_id}` : `/learn/${assignment.topic_id}`}
                      className="group flex items-center justify-between gap-3 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-medium text-foreground group-hover:text-primary">
                          {assignment.subtopic_name ?? assignment.topic_name}
                        </p>
                        <p className="text-sm text-muted">
                          {assignment.subject_name} · {assignment.topic_name} · {assignment.class_name}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                        Start <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </Rise>
        )}

        <Rise>
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">Next lessons</h2>
            {allTopics.length === 0 ? (
              <p className="mt-3 text-base text-muted">Your teacher or admin has not published a topic yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border border-y border-border">
                {allTopics.slice(0, 4).map((topic) => (
                  <li key={topic.id}>
                    <Link href={`/learn/${topic.id}`} className="group block py-3">
                      <p className="text-base font-medium text-foreground group-hover:text-primary">{topic.name}</p>
                      <p className="mt-0.5 line-clamp-2 max-w-[65ch] text-sm text-muted">{topic.summary ?? "Start this lesson"}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Rise>
      </Stagger>
    </PageShell>
  );
}

function QuickTool({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full min-h-[4.5rem] flex-col justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5 text-sm font-semibold text-foreground transition-colors hover:border-primary focus-visible:border-primary"
      >
        <Icon className="size-5 shrink-0 text-primary" strokeWidth={2} aria-hidden />
        {label}
      </Link>
    </li>
  );
}
