import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/appwrite/session";
import { getSubject } from "@/lib/supabase/subjects";
import { listTopicsBySubject, listSubtopicsByTopic } from "@/lib/supabase/topics";
import {
  deleteSubjectAction,
  publishSubjectAction,
  unpublishSubjectAction,
  saveSpecAction,
  generateTopicsAction,
  generateSingleTopicAction,
  addCustomTopicAction,
  deleteSubtopicAction,
  publishTopicAction,
  publishSubtopicAction,
  unpublishTopicAction,
  unpublishSubtopicAction,
  editSubtopicAction,
  saveSubjectInstructionsAction,
  saveTopicInstructionsAction,
} from "@/app/actions/subjects";
import { Button } from "@/components/button";
import { PendingAiOverlay } from "@/components/pending-ai-overlay";
import { listDocumentsByTopic } from "@/lib/supabase/topic-documents";
import { listQuestionBankForTopic } from "@/lib/supabase/questions";
import { AdminQuestionBankEditor } from "@/components/admin-question-bank-editor";
import {
  uploadTopicDocumentsAction,
  deleteTopicDocumentAction,
} from "@/app/actions/topic-documents";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export async function SubjectDetailPage({
  params,
  searchParams,
  basePath = "/admin/subjects",
  requireAccess,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ board?: string }>;
  basePath?: string;
  requireAccess: (subjectId: string) => Promise<unknown>;
}) {
  const { subjectId } = await params;
  const { board: boardParam } = await searchParams;
  await requireAccess(subjectId);

  const subject = await getSubject(subjectId);
  if (!subject) notFound();

  const multiBoard = subject.exam_boards.length > 1;
  const activeBoard = multiBoard
    ? (subject.exam_boards.find((b) => b.id === boardParam) ?? subject.exam_boards[0])
    : subject.exam_boards[0] ?? null;

  const topics = await listTopicsBySubject(subjectId);
  const subtopicsByTopic = await Promise.all(topics.map((t) => listSubtopicsByTopic(t.id)));
  const subtopicsByTopicId = new Map(topics.map((t, i) => [t.id, subtopicsByTopic[i]]));
  const documentsByTopic = await Promise.all(topics.map((t) => listDocumentsByTopic(t.id)));
  const documentsByTopicId = new Map(topics.map((t, i) => [t.id, documentsByTopic[i]]));
  const questionBanksByTopic = await Promise.all(topics.map((t) => listQuestionBankForTopic(t.id)));
  const questionBanksByTopicId = new Map(topics.map((t, i) => [t.id, questionBanksByTopic[i]]));


  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <Link
          href={basePath}
          className="text-xs text-muted hover:text-foreground"
        >
          ← All subjects
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
              {subject.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {subject.exam_boards.map((b) => b.name).join(", ") || "No exam boards"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
              {subject.status}
            </span>
            {subject.status === "draft" ? (
              <form action={publishSubjectAction}>
                <input type="hidden" name="subjectId" value={subject.id} />
                <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                  Publish
                </Button>
              </form>
            ) : (
              <form action={unpublishSubjectAction}>
                <input type="hidden" name="subjectId" value={subject.id} />
                <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                  Unpublish
                </Button>
              </form>
            )}
            <form action={deleteSubjectAction}>
              <input type="hidden" name="subjectId" value={subject.id} />
              <input type="hidden" name="redirectTo" value={basePath} />
              <button type="submit" className="text-xs text-error hover:underline">
                Delete
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="">
        <TabsList variant="line">
          <TabsTrigger value="spec">Specfication</TabsTrigger>
          <TabsTrigger value="custominstrct">Custom instructions</TabsTrigger>
        </TabsList>
        <TabsContent value="spec">
          <div className="mt-3 flex flex-col gap-4 p-3 ">
            
            {subject.exam_boards.map((board) => (
              <form key={board.id} action={saveSpecAction} className="flex flex-col gap-2">
                <input type="hidden" name="subjectId" value={subject.id} />
                <input type="hidden" name="examBoardId" value={board.id} />
                <label className="text-xs text-muted">{board.name} spec</label>
                <textarea
                  name="specText"
                  rows={3}
                  placeholder="Paste the official spec text for this exam board..."
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    name="specFile"
                    accept=".pdf,.txt,.md"
                    className="flex-1 text-xs text-muted file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                    Save
                  </Button>
                </div>
                <p className="text-2xs text-muted">
                  Upload a PDF/text file, or paste text above, a file wins if you give both.
                </p>
              </form>
            ))}
            {subject.exam_boards.length === 0 && (
              <p className="text-xs text-muted">No exam boards, go back and add one first.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="custominstrct">
          <form action={saveSubjectInstructionsAction} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="subjectId" value={subject.id} />
            <textarea
              name="instructions"
              rows={2}
              defaultValue={subject.custom_instructions ?? ""}
              placeholder="e.g. Focus on Triple Science depth, not Combined. Use metric units throughout."
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
              Save
            </Button>
          </form>
        </TabsContent>

      </Tabs>


      <div className="flex flex-col gap-4">
        {/* Board tabs, only shown when the subject spans multiple boards */}
        {multiBoard && (
          <div className="flex gap-1 border-b border-border">
            {subject.exam_boards.map((board) => {
              const isActive = board.id === activeBoard?.id;
              return (
                <Link
                  key={board.id}
                  href={`${basePath}/${subjectId}?board=${board.id}`}
                  prefetch={true}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border border-b-surface border-border bg-surface text-foreground -mb-px"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {board.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Topic controls + list for the active (or only) board */}
        {(() => {
          const boardId = activeBoard?.id ?? null;
          const displayTopics = multiBoard
            ? topics.filter((t) => t.exam_board_id === boardId)
            : topics;

          return (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Topics ({displayTopics.length})
                </span>
                <form action={generateTopicsAction}>
                  <input type="hidden" name="subjectId" value={subject.id} />
                  {boardId && <input type="hidden" name="examBoardId" value={boardId} />}
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                    Generate {activeBoard ? `${activeBoard.name} ` : "All "}Topics
                  </Button>
                  <PendingAiOverlay
                    title="Generating topics"
                    messages={[
                      "Reading the spec…",
                      "Mapping out the syllabus…",
                      "Naming each topic…",
                      "Nearly there…",
                    ]}
                  />
                </form>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-end">
                <form action={generateSingleTopicAction} className="flex flex-1 items-end gap-2">
                  <input type="hidden" name="subjectId" value={subject.id} />
                  {boardId && <input type="hidden" name="examBoardId" value={boardId} />}
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-2xs text-muted">Generate one topic (AI)</label>
                    <input
                      name="hint"
                      placeholder="Optional, e.g. Isotopes. Leave blank to let AI pick a gap."
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                    Generate
                  </Button>
                  <PendingAiOverlay
                    title="Generating topic"
                    messages={["Reading the spec…", "Finding a gap in the syllabus…", "Writing it up…"]}
                  />
                </form>
              </div>

              <details className="rounded-lg border border-border bg-surface px-3 py-2">
                <summary className="cursor-pointer text-2xs text-muted">
                  Add a topic by hand (no AI)
                </summary>
                <form action={addCustomTopicAction} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="subjectId" value={subject.id} />
                  {boardId && <input type="hidden" name="examBoardId" value={boardId} />}
                  <input
                    name="name"
                    placeholder="Topic name"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <input
                    name="summary"
                    placeholder="One-line summary"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
                    Add topic
                  </Button>
                  <p className="text-2xs text-muted">
                    A lesson and practice question still generate automatically for it.
                  </p>
                </form>
              </details>

              {displayTopics.map((topic) => {
                const subtopics = subtopicsByTopicId.get(topic.id) ?? [];
                return (
                  <details key={topic.id} className="group rounded-xl border border-border bg-surface">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs text-muted transition-transform group-open:rotate-90">
                          ›
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{topic.name}</p>
                          <p className="text-xs text-muted">
                            {subtopics.length} {subtopics.length === 1 ? "guide" : "guides"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {topic.status === "draft" ? (
                          <form action={publishTopicAction}>
                            <input type="hidden" name="topicId" value={topic.id} />
                            <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                              Publish
                            </Button>
                          </form>
                        ) : (
                          <form action={unpublishTopicAction}>
                            <input type="hidden" name="topicId" value={topic.id} />
                            <button type="submit" className="text-xs text-success hover:underline">
                              Published · unpublish
                            </button>
                          </form>
                        )}
                      </div>
                    </summary>
                    <div className="flex flex-col gap-1 border-t border-border px-4 py-3 pl-12">
                      {subtopics.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between gap-2 py-1">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs ${
                              sub.status === "published"
                                ? "bg-success/20 text-success"
                                : "border border-border text-muted"
                            }`}
                          >
                            {sub.status === "published" ? "✓" : ""}
                          </span>
                          <span className="flex-1 text-sm text-foreground">{sub.name}</span>
                          <Link
                            href={`/learn/subtopic/${sub.id}`}
                            className="shrink-0 text-xs text-muted hover:text-foreground"
                          >
                            View lesson
                          </Link>
                          {sub.status === "draft" && (
                            <form action={publishSubtopicAction}>
                              <input type="hidden" name="subtopicId" value={sub.id} />
                              <button type="submit" className="text-xs text-primary hover:underline">
                                Publish
                              </button>
                            </form>
                          )}
                          {sub.status === "published" && (
                            <form action={unpublishSubtopicAction}>
                              <input type="hidden" name="subtopicId" value={sub.id} />
                              <button type="submit" className="text-xs text-success hover:underline">
                                Unpublish
                              </button>
                            </form>
                          )}
                          <details className="shrink-0">
                            <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                              Edit
                            </summary>
                            <form action={editSubtopicAction} className="mt-2 flex gap-2">
                              <input type="hidden" name="subtopicId" value={sub.id} />
                              <input
                                name="name"
                                defaultValue={sub.name}
                                aria-label="Guide name"
                                className="min-w-0 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
                              />
                              <button type="submit" className="text-xs text-primary hover:underline">
                                Save
                              </button>
                            </form>
                          </details>
                          <form action={deleteSubtopicAction}>
                            <input type="hidden" name="subtopicId" value={sub.id} />
                            <button type="submit" className="text-xs text-error hover:underline">
                              Delete
                            </button>
                          </form>
                        </div>
                      ))}
                      <form
                        action={saveTopicInstructionsAction}
                        className="mt-2 flex flex-col gap-2 border-t border-border pt-2"
                      >
                        <input type="hidden" name="topicId" value={topic.id} />
                        <label className="text-2xs text-muted">
                          Custom instructions for this topic&apos;s lessons/questions
                        </label>
                        <textarea
                          name="instructions"
                          rows={2}
                          defaultValue={topic.custom_instructions ?? ""}
                          placeholder="e.g. Always include a diagram description. Avoid calculator-based examples."
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                        <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
                          Save
                        </Button>
                      </form>

                      <details className="mt-2 rounded-lg border border-border bg-surface px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold text-foreground">
                          Reference documents ({(documentsByTopicId.get(topic.id) ?? []).length})
                        </summary>
                        <p className="mt-1 text-2xs text-muted">
                          Upload spec extracts, worksheets, or notes, lessons, practice questions, and
                          flashcards for this topic will be grounded in them.
                        </p>
                        <form action={uploadTopicDocumentsAction} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="topicId" value={topic.id} />
                          <input
                            type="file"
                            name="files"
                            accept=".pdf,.txt,.md"
                            multiple
                            className="min-w-0 flex-1 text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                          />
                          <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                            Upload &amp; index
                          </Button>
                        </form>
                        {(documentsByTopicId.get(topic.id) ?? []).length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1">
                            {(documentsByTopicId.get(topic.id) ?? []).map((doc) => (
                              <li
                                key={doc.id}
                                className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1 text-2xs"
                              >
                                <span className="truncate text-foreground">
                                  {doc.filename}{" "}
                                  <span className="text-muted">
                                    ({doc.chunkCount} {doc.chunkCount === 1 ? "chunk" : "chunks"})
                                  </span>
                                </span>
                                <form action={deleteTopicDocumentAction}>
                                  <input type="hidden" name="documentId" value={doc.id} />
                                  <button type="submit" className="shrink-0 text-error hover:underline">
                                    Delete
                                  </button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>

                      <div className="mt-3">
                        <AdminQuestionBankEditor
                          topicId={topic.id}
                          initialQuestions={questionBanksByTopicId.get(topic.id) ?? []}
                        />
                      </div>
                    </div>
                  </details>
                );
              })}

              {displayTopics.length === 0 && (
                <p className="text-sm text-muted">No topics yet, generate or add one above.</p>
              )}
            </>
          );
        })()}
      </div>
    </main>
  );
}

export default async function AdminSubjectDetailPage(props: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ board?: string }>;
}) {
  return SubjectDetailPage({
    ...props,
    basePath: "/admin/subjects",
    requireAccess: async () => requireRole("admin"),
  });
}
