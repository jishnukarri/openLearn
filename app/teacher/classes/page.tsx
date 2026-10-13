import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { listClassesByTeacher, listClassMembers } from "@/lib/supabase/classes";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { listPublishedTopicsBySubject, listPublishedSubtopicsByTopic } from "@/lib/supabase/topics";
import { listAssignmentsForClass } from "@/lib/supabase/assignments";
import { createClassAction, deleteClassAction, removeStudentAction } from "@/app/actions/classes";
import { assignSubtopicsAction, copyAssignmentsAction } from "@/app/actions/assign";
import { Button } from "@/components/button";
import { CopyButton } from "@/components/copy-button";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";

export default async function TeacherClassesPage() {
  const { profile } = await requireRole("teacher");
  const classes = await listClassesByTeacher(profile.id);
  const subjects = await listPublishedSubjects();
  const topicsBySubject = await Promise.all(
    subjects.map((s) => listPublishedTopicsBySubject(s.id))
  );
  // The assign-work picker needs the full subject → topic → subtopic tree
  // (only topics/subtopics with at least one subtopic are worth showing —
  // a topic with none can't be assigned at the subtopic level at all).
  const subtopicsByTopic = await Promise.all(
    topicsBySubject.flatMap((topics) => topics.map((t) => listPublishedSubtopicsByTopic(t.id)))
  );
  let subtopicCursor = 0;
  const pickerSubjects = subjects
    .map((s, i) => ({
      id: s.id,
      name: s.name,
      topics: topicsBySubject[i]
        .map((t) => ({ id: t.id, name: t.name, subtopics: subtopicsByTopic[subtopicCursor++] }))
        .filter((t) => t.subtopics.length > 0),
    }))
    .filter((s) => s.topics.length > 0);

  const [assignmentsByClass, membersByClass] = await Promise.all([
    Promise.all(classes.map((c) => listAssignmentsForClass(c.id))),
    Promise.all(classes.map((c) => listClassMembers(c.id, profile.id))),
  ]);

  const totalStudents = membersByClass.reduce((sum, m) => sum + m.length, 0);
  const totalAssignments = assignmentsByClass.reduce((sum, a) => sum + a.length, 0);

  const field =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="Teaching overview">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <dt>Classes</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{classes.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Students</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{totalStudents}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Active assignments</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{totalAssignments}</dd>
              </div>
            </dl>
          </AsideBlock>
          <AsideBlock title="How students join">
            <p>
              Every class has an invite code and a join link. Share either one and students are added to the class.
            </p>
            <p>Copy buttons sit next to each class name. You can remove a student from the Students list at any time.</p>
          </AsideBlock>
          {pickerSubjects.length === 0 && (
            <AsideBlock title="Nothing to assign yet">
              <p>No published subtopics exist yet, publish some guides in Subjects first.</p>
            </AsideBlock>
          )}
        </>
      }
    >
      <PageHeader
        title="Your classes"
        description="Create a class, then share its invite code or link with students."
      />

      <form action={createClassAction} className="animate-fade-slide-up flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Class name
          </label>
          <input id="name" name="name" placeholder="e.g. Year 11 Chemistry" className={field} />
        </div>
        <Button type="submit" size="compact">
          Create class
        </Button>
      </form>

      {classes.length === 0 && <p className="text-sm text-muted">No classes yet, add the first one above.</p>}
      <Stagger className="flex flex-col gap-4" delay={0.1} gap={0.06}>
        {classes.map((cls, i) => {
          const members = membersByClass[i];
          const otherClasses = classes.filter((c) => c.id !== cls.id);
          return (
            <Rise key={cls.id}>
              <article className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                      {cls.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {cls.member_count} {cls.member_count === 1 ? "student" : "students"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-[family-name:var(--font-mono)] text-sm text-highlight">
                        {cls.invite_code}
                      </span>
                      <CopyButton text={cls.invite_code} label="Copy code" />
                      <CopyButton text={`/join/${cls.invite_code}`} prependOrigin label="Copy link" />
                      <Link href={`/teacher/classes/${cls.id}`} className="text-sm font-medium text-primary hover:underline">
                        View progress
                      </Link>
                    </div>
                  </div>
                  <form action={deleteClassAction}>
                    <input type="hidden" name="classId" value={cls.id} />
                    <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                      Delete
                    </Button>
                  </form>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <h3 className="text-base font-semibold text-foreground">Set work</h3>
                  {pickerSubjects.length === 0 ? (
                    <p className="text-sm text-muted">
                      No published subtopics yet, publish some guides in Subjects first.
                    </p>
                  ) : (
                    <form action={assignSubtopicsAction} className="flex flex-col gap-3">
                      <input type="hidden" name="classId" value={cls.id} />
                      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                        {pickerSubjects.map((subject) => (
                          <details key={subject.id}>
                            <summary className="cursor-pointer rounded px-1.5 py-1 text-sm font-medium text-foreground hover:bg-background">
                              {subject.name}
                            </summary>
                            <div className="ml-3 flex flex-col gap-1 border-l border-border pl-3">
                              {subject.topics.map((topic) => (
                                <details key={topic.id}>
                                  <summary className="cursor-pointer rounded px-1.5 py-1 text-sm font-medium text-foreground hover:bg-background">
                                    {topic.name}
                                  </summary>
                                  <div className="ml-3 flex flex-col gap-0.5 py-1">
                                    {topic.subtopics.map((subtopic) => (
                                      <label
                                        key={subtopic.id}
                                        className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-foreground hover:bg-background"
                                      >
                                        <input type="checkbox" name="subtopicIds" value={subtopic.id} />
                                        {subtopic.name}
                                      </label>
                                    ))}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          name="notes"
                          aria-label="Optional note for students"
                          placeholder="Optional note for students (e.g. 'Focus on part b for the mock')"
                          className={`${field} min-w-0 flex-1`}
                        />
                        <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                          Assign selected
                        </Button>
                      </div>
                    </form>
                  )}
                  {assignmentsByClass[i].length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {assignmentsByClass[i].map((a) => (
                        <li key={a.id} className="flex flex-col">
                          <span className="w-fit rounded-full border border-border px-3 py-1 text-sm text-muted">
                            {a.subtopic_name ? `${a.topic_name} · ${a.subtopic_name}` : a.topic_name}
                          </span>
                          {a.notes && (
                            <p className="mt-1 pl-3 text-sm text-muted">&ldquo;{a.notes}&rdquo;</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {otherClasses.length > 0 && (
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <h3 className="text-base font-semibold text-foreground">Copy set work from another class</h3>
                    <form action={copyAssignmentsAction} className="flex items-center gap-2">
                      <input type="hidden" name="targetClassId" value={cls.id} />
                      <select
                        name="sourceClassId"
                        aria-label="Class to copy set work from"
                        className={`${field} min-w-0 flex-1`}
                      >
                        {otherClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                        Copy in
                      </Button>
                    </form>
                  </div>
                )}

                <details className="border-t border-border pt-4">
                  <summary className="cursor-pointer text-base font-semibold text-foreground hover:text-primary">
                    Students ({members.length})
                  </summary>
                  {members.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">No students yet, share the invite code above.</p>
                  ) : (
                    <ul className="mt-3 flex flex-col divide-y divide-border">
                      {members.map((m) => (
                        <li key={m.profileId} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{m.fullName ?? m.email}</p>
                            {m.fullName && <p className="text-sm text-muted">{m.email}</p>}
                          </div>
                          <form action={removeStudentAction}>
                            <input type="hidden" name="classId" value={cls.id} />
                            <input type="hidden" name="studentId" value={m.profileId} />
                            <button type="submit" className="text-sm text-error hover:underline">
                              Remove
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </article>
            </Rise>
          );
        })}
      </Stagger>
    </PageShell>
  );
}
