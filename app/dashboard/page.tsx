import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { getStudentSubjects, getWeakTopics, getSubjectsNeedingDiagnostic } from "@/lib/supabase/students";
import { listPublishedTopicsBySubject } from "@/lib/supabase/topics";
import { listAssignmentsForStudent } from "@/lib/supabase/assignments";
import { AnimatedNumber } from "@/components/animated-number";
import { ButtonLink } from "@/components/button";

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
  const [subjects, weakTopics, assignments, needingDiagnostic] = await Promise.all([
    getStudentSubjects(profile.id),
    getWeakTopics(profile.id),
    listAssignmentsForStudent(profile.id),
    getSubjectsNeedingDiagnostic(profile.id),
  ]);
  const topicsBySubject = await Promise.all(
    subjects.map(async (subject) => ({
      subject,
      topics: await listPublishedTopicsBySubject(subject.subject_id),
    }))
  );
  const allTopics = topicsBySubject.flatMap(({ topics }) => topics);
  const continueTopic = assignments[0]?.topic_id ?? allTopics[0]?.id;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 pb-24 sm:py-14 sm:pb-14">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Good to see you, {profile.full_name?.split(" ")[0] ?? "there"}.</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">Your learning space</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 font-[family-name:var(--font-mono)] text-sm text-highlight"><AnimatedNumber value={profile.xp} /> XP</span>
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 font-[family-name:var(--font-mono)] text-sm text-secondary">🔥 <AnimatedNumber value={profile.streak_count} /> day streak</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">My subjects</h2>
                <p className="mt-1 text-xs text-muted">Choose a subject, then pick a focused guide to study.</p>
              </div>
              <Link href="/dashboard/add-subjects" className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary hover:text-foreground">Manage</Link>
            </div>

            {topicsBySubject.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-sm text-muted">No subjects yet. <Link href="/dashboard/add-subjects" className="text-primary hover:underline">Add your first subject</Link>.</div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {topicsBySubject.map(({ subject, topics }, index) => {
                  const firstTopic = topics[0];
                  return (
                    <Link key={subject.subject_id} href={firstTopic ? `/subjects/${subject.subject_id}` : "/dashboard/add-subjects"} className={`card-lift min-h-40 rounded-2xl p-4 text-white ${SUBJECT_COLOURS[index % SUBJECT_COLOURS.length]}`}>
                      <p className="text-xs font-medium text-white/75">{subject.exam_board_name}</p>
                      <h3 className="mt-7 font-[family-name:var(--font-display)] text-xl font-semibold">{subject.subject_name}</h3>
                      <div className="mt-5">
                        <div className="flex items-center justify-between text-2xs text-white/80"><span>Ready to study</span><span>{topics.length} topics</span></div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-white/80" style={{ width: topics.length ? "100%" : "0%" }} /></div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Continue learning</h2><p className="mt-1 text-xs text-muted">Small, focused lessons make it easier to build momentum.</p></div>{continueTopic && <Link href={`/learn/${continueTopic}`} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white">Resume</Link>}</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {allTopics.slice(0, 4).map((topic) => <Link key={topic.id} href={`/learn/${topic.id}`} className="rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary"><p className="text-sm font-medium text-foreground">{topic.name}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{topic.summary ?? "Start this lesson"}</p></Link>)}
              {allTopics.length === 0 && <p className="text-sm text-muted">Your teacher or admin has not published a topic yet.</p>}
            </div>
          </section>

          {assignments.length > 0 && <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6"><h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Set work</h2><div className="mt-3 flex flex-col gap-2">{assignments.slice(0, 3).map((assignment) => <Link key={assignment.id} href={assignment.subtopic_id ? `/learn/subtopic/${assignment.subtopic_id}` : `/learn/${assignment.topic_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 hover:border-primary"><div><p className="text-sm font-medium text-foreground">{assignment.subtopic_name ?? assignment.topic_name}</p><p className="text-xs text-muted">{assignment.subject_name} · {assignment.topic_name} · {assignment.class_name}</p></div><span className="text-xs text-primary">Start →</span></Link>)}</div></section>}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between"><div><h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Learning pulse</h2><p className="mt-1 text-xs text-muted">Your study setup at a glance</p></div><span className="rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">Active</span></div>
            <div className="mt-5"><div className="flex justify-between text-xs text-muted"><span>Subjects ready</span><span>{topicsBySubject.filter(({ topics }) => topics.length > 0).length}/{subjects.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${subjects.length ? (topicsBySubject.filter(({ topics }) => topics.length > 0).length / subjects.length) * 100 : 0}%` }} /></div></div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Quick tools</h2><div className="mt-4 grid grid-cols-2 gap-2"><QuickTool href={continueTopic ? `/learn/${continueTopic}` : "/dashboard"} icon="✦" label="AI coach" /><QuickTool href={continueTopic ? `/practice/${continueTopic}` : "/dashboard"} icon="✓" label="Practice" /><QuickTool href={continueTopic ? `/flashcards/${continueTopic}` : "/dashboard"} icon="▤" label="Flashcards" /><QuickTool href="/onboarding/diagnostic" icon="?" label="Diagnostic" /><QuickTool href="/dashboard/add-subjects" icon="+" label="Subjects" /></div></section>

          <section id="focus" className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Recommended focus</h2>
            {weakTopics.length > 0 ? (
              <>
                <div className="mt-3 flex flex-col gap-2">{weakTopics.slice(0, 3).map((topic, index) => <div key={`${topic.subject_name}-${index}`} className="rounded-xl bg-background p-3"><p className="text-sm font-medium text-foreground">{topic.topic_name ?? topic.subject_name}</p><p className="mt-1 text-xs text-muted">Build confidence in {topic.subject_name} · {Math.round(topic.score * 100)}% diagnostic score</p></div>)}</div>
                <p className="mt-3 text-xs text-muted">If these are based on a stale run, retake the diagnostic and we&apos;ll refresh the recommendations.</p>
              </>
            ) : needingDiagnostic.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                <p className="text-sm font-medium text-foreground">New diagnostic needed</p>
                <p className="mt-1 text-sm text-muted">
                  {needingDiagnostic.map((s) => s.subject_name).join(", ")}{" "}
                  {needingDiagnostic.length === 1 ? "hasn't" : "haven't"} been
                  checked yet, a quick quiz tells us what to teach first
                  instead of guessing.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-success/20 bg-success/10 p-4">
                <p className="text-sm font-medium text-foreground">You&apos;re all caught up.</p>
                <p className="mt-1 text-sm text-muted">No new diagnostic needed right now.</p>
              </div>
            )}
            {(weakTopics.length > 0 || needingDiagnostic.length > 0) && (
              <ButtonLink href="/onboarding/diagnostic" className="mt-4 w-full text-sm" size="default">
                {needingDiagnostic.length > 0 ? "Start diagnostic" : "Retake diagnostic"}
              </ButtonLink>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function QuickTool({ href, icon, label }: { href: string; icon: string; label: string }) {
  return <Link href={href} className="rounded-xl border border-border bg-background p-3 text-xs font-medium text-foreground transition-colors hover:border-primary"><span className="mr-2 text-primary">{icon}</span>{label}</Link>;
}
