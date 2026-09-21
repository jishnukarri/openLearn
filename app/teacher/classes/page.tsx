import { requireRole } from "@/lib/appwrite/session";
import { listClassesByTeacher, listClassMembers } from "@/lib/supabase/classes";
import { listPublishedSubjects } from "@/lib/supabase/subjects";
import { listPublishedTopicsBySubject, listPublishedSubtopicsByTopic } from "@/lib/supabase/topics";
import { listAssignmentsForClass } from "@/lib/supabase/assignments";
import { createClassAction, deleteClassAction, removeStudentAction } from "@/app/actions/classes";
import { assignSubtopicsAction, copyAssignmentsAction } from "@/app/actions/assign";
import { Button } from "@/components/button";
import { CopyButton } from "@/components/copy-button";

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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
          Your classes
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create a class, then share its invite code or link with students.
        </p>
      </div>

      <form
        action={createClassAction}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Class name
          </label>
          <input
            id="name"
            name="name"
            placeholder="e.g. Year 11 Chemistry"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <Button type="submit" size="compact">
          Create class
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        {classes.length === 0 && (
          <p className="text-sm text-muted">No classes yet, add the first one above.</p>
        )}
        {classes.map((cls, i) => {
          const members = membersByClass[i];
          const otherClasses = classes.filter((c) => c.id !== cls.id);
          return (
            <div
              key={cls.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                    {cls.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {cls.member_count} {cls.member_count === 1 ? "student" : "students"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-highlight">
                      {cls.invite_code}
                    </span>
                    <CopyButton text={cls.invite_code} label="Copy code" />
                    <CopyButton
                      text={`/join/${cls.invite_code}`}
                      prependOrigin
                      label="Copy link"
                    />
                  </div>
                </div>
                <form action={deleteClassAction}>
                  <input type="hidden" name="classId" value={cls.id} />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                    Delete
                  </Button>
                </form>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Set work
                </span>
                {pickerSubjects.length === 0 ? (
                  <p className="text-xs text-muted">
                    No published subtopics yet, publish some guides in Subjects first.
                  </p>
                ) : (
                  <form action={assignSubtopicsAction} className="flex flex-col gap-2">
                    <input type="hidden" name="classId" value={cls.id} />
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-2">
                      {pickerSubjects.map((subject) => (
                        <details key={subject.id}>
                          <summary className="cursor-pointer rounded px-1.5 py-1 text-sm font-medium text-foreground hover:bg-surface">
                            {subject.name}
                          </summary>
                          <div className="ml-3 flex flex-col gap-1 border-l border-border pl-3">
                            {subject.topics.map((topic) => (
                              <details key={topic.id}>
                                <summary className="cursor-pointer rounded px-1.5 py-1 text-xs font-medium text-foreground hover:bg-surface">
                                  {topic.name}
                                </summary>
                                <div className="ml-3 flex flex-col gap-0.5 py-1">
                                  {topic.subtopics.map((subtopic) => (
                                    <label
                                      key={subtopic.id}
                                      className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-foreground hover:bg-surface"
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
                        placeholder="Optional note for students (e.g. 'Focus on part b for the mock')"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                        Assign selected
                      </Button>
                    </div>
                  </form>
                )}
                {assignmentsByClass[i].length > 0 && (
                  <div className="mt-1 flex flex-col gap-1">
                    {assignmentsByClass[i].map((a) => (
                      <div key={a.id} className="flex flex-col">
                        <span className="w-fit rounded-full border border-border px-3 py-1 text-xs text-muted">
                          {a.subtopic_name ? `${a.topic_name} · ${a.subtopic_name}` : a.topic_name}
                        </span>
                        {a.notes && (
                          <p className="mt-1 pl-3 text-2xs text-muted">
                            &ldquo;{a.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {otherClasses.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    Copy set work from another class
                  </span>
                  <form action={copyAssignmentsAction} className="flex items-center gap-2">
                    <input type="hidden" name="targetClassId" value={cls.id} />
                    <select
                      name="sourceClassId"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
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
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted hover:text-foreground">
                  Students ({members.length})
                </summary>
                {members.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">No students yet, share the invite code above.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1">
                    {members.map((m) => (
                      <li key={m.profileId} className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-foreground">{m.fullName ?? m.email}</p>
                          {m.fullName && <p className="text-2xs text-muted">{m.email}</p>}
                        </div>
                        <form action={removeStudentAction}>
                          <input type="hidden" name="classId" value={cls.id} />
                          <input type="hidden" name="studentId" value={m.profileId} />
                          <button type="submit" className="text-xs text-error hover:underline">
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
          );
        })}
      </div>
    </main>
  );
}
