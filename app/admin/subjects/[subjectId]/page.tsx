import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
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
import { RenameSubject } from "@/components/rename-subject";
import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
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


  const boardId = activeBoard?.id ?? null;
  const displayTopics = multiBoard
    ? topics.filter((t) => t.exam_board_id === boardId)
    : topics;
  const publishedTopicCount = displayTopics.filter((t) => t.status === "published").length;
  const guideCount = displayTopics.reduce((n, t) => n + (subtopicsByTopicId.get(t.id)?.length ?? 0), 0);

  const INPUT =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <PageShell
      size="fluid"
      aside={
        <>
          <AsideBlock title="Status">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <dt>Subject</dt>
                <dd className="capitalize text-foreground">{subject.status}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Topics published</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">
                  {publishedTopicCount}/{displayTopics.length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Guides</dt>
                <dd className="font-[family-name:var(--font-mono)] text-foreground">{guideCount}</dd>
              </div>
            </dl>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {subject.status === "draft" ? (
                <form action={publishSubjectAction}>
                  <input type="hidden" name="subjectId" value={subject.id} />
                  <Button type="submit" size="compact" className="!shadow-none">
                    Publish subject
                  </Button>
                </form>
              ) : (
                <form action={unpublishSubjectAction}>
                  <input type="hidden" name="subjectId" value={subject.id} />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none">
                    Unpublish subject
                  </Button>
                </form>
              )}
              <form action={deleteSubjectAction}>
                <input type="hidden" name="subjectId" value={subject.id} />
                <input type="hidden" name="redirectTo" value={basePath} />
                <button type="submit" className="text-sm text-error hover:underline">
                  Delete subject
                </button>
              </form>
            </div>
          </AsideBlock>

          <AsideBlock title="Generate topics">
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

            <form action={generateSingleTopicAction} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="subjectId" value={subject.id} />
              {boardId && <input type="hidden" name="examBoardId" value={boardId} />}
              <label htmlFor="single-topic-hint" className="font-medium text-foreground">
                Generate one topic (AI)
              </label>
              <input
                id="single-topic-hint"
                name="hint"
                placeholder="Optional, e.g. Isotopes. Leave blank to let AI pick a gap."
                className={INPUT}
              />
              <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
                Generate
              </Button>
              <PendingAiOverlay
                title="Generating topic"
                messages={["Reading the spec…", "Finding a gap in the syllabus…", "Writing it up…"]}
              />
            </form>

            <details className="group mt-2 border-t border-border pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground">
                <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
                Add a topic by hand (no AI)
              </summary>
              <form action={addCustomTopicAction} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="subjectId" value={subject.id} />
                {boardId && <input type="hidden" name="examBoardId" value={boardId} />}
                <input name="name" aria-label="Topic name" placeholder="Topic name" className={INPUT} />
                <input name="summary" aria-label="One-line summary" placeholder="One-line summary" className={INPUT} />
                <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
                  Add topic
                </Button>
                <p>A lesson and practice question still generate automatically for it.</p>
              </form>
            </details>
          </AsideBlock>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Link
          href={basePath}
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> All subjects
        </Link>
        <PageHeader
          title={subject.name}
          actions={<RenameSubject subjectId={subject.id} name={subject.name} />}
          description={subject.exam_boards.map((b) => b.name).join(", ") || "No exam boards"}
        />
      </div>

      <Tabs defaultValue="">
        <TabsList variant="line">
          <TabsTrigger value="spec">Specification</TabsTrigger>
          <TabsTrigger value="custominstrct">Custom instructions</TabsTrigger>
        </TabsList>
        <TabsContent value="spec">
          <div className="mt-3 flex flex-col gap-6 py-3">
            {subject.exam_boards.map((board) => (
              <form key={board.id} action={saveSpecAction} className="flex max-w-[65ch] flex-col gap-2">
                <input type="hidden" name="subjectId" value={subject.id} />
                <input type="hidden" name="examBoardId" value={board.id} />
                <label htmlFor={`spec-${board.id}`} className="text-sm font-medium text-foreground">
                  {board.name} spec
                </label>
                <textarea
                  id={`spec-${board.id}`}
                  name="specText"
                  rows={3}
                  placeholder="Paste the official spec text for this exam board..."
                  className={INPUT}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    name="specFile"
                    aria-label={`${board.name} spec file`}
                    accept=".pdf,.txt,.md"
                    className="min-w-0 flex-1 text-sm text-muted file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
                  />
                  <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted">
                  Upload a PDF/text file, or paste text above, a file wins if you give both.
                </p>
              </form>
            ))}
            {subject.exam_boards.length === 0 && (
              <p className="text-sm text-muted">No exam boards, go back and add one first.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="custominstrct">
          <form action={saveSubjectInstructionsAction} className="mt-3 flex max-w-[65ch] flex-col gap-2">
            <input type="hidden" name="subjectId" value={subject.id} />
            <textarea
              name="instructions"
              aria-label="Custom instructions for this subject"
              rows={3}
              defaultValue={subject.custom_instructions ?? ""}
              placeholder="e.g. Focus on Triple Science depth, not Combined. Use metric units throughout."
              className={INPUT}
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
                  aria-current={isActive ? "page" : undefined}
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

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
          Topics ({displayTopics.length})
        </h2>

        {displayTopics.length === 0 ? (
          <p className="text-sm text-muted">No topics yet, generate or add one in the panel.</p>
        ) : (
          <Stagger>
            <Rise>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {displayTopics.map((topic) => {
                const subtopics = subtopicsByTopicId.get(topic.id) ?? [];
                return (
                  <li key={topic.id}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <ChevronRight
                              className="size-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-90"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="truncate text-base font-medium text-foreground">{topic.name}</p>
                              <p className="text-sm text-muted">
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
                                <button type="submit" className="text-sm text-success hover:underline">
                                  Published · unpublish
                                </button>
                              </form>
                            )}
                          </div>
                        </summary>
                        <div className="flex flex-col gap-1 pb-4 pl-8">
                          {subtopics.map((sub) => (
                            <div key={sub.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                  sub.status === "published"
                                    ? "bg-success/20 text-success"
                                    : "border border-border text-muted"
                                }`}
                              >
                                {sub.status === "published" && <Check className="size-3" strokeWidth={2.5} aria-hidden />}
                                <span className="sr-only">{sub.status}</span>
                              </span>
                              <span className="min-w-0 flex-1 text-sm text-foreground">{sub.name}</span>
                              <Link
                                href={`/learn/subtopic/${sub.id}`}
                                className="shrink-0 text-sm text-muted hover:text-foreground"
                              >
                                View lesson
                              </Link>
                              {sub.status === "draft" && (
                                <form action={publishSubtopicAction}>
                                  <input type="hidden" name="subtopicId" value={sub.id} />
                                  <button type="submit" className="text-sm text-primary hover:underline">
                                    Publish
                                  </button>
                                </form>
                              )}
                              {sub.status === "published" && (
                                <form action={unpublishSubtopicAction}>
                                  <input type="hidden" name="subtopicId" value={sub.id} />
                                  <button type="submit" className="text-sm text-success hover:underline">
                                    Unpublish
                                  </button>
                                </form>
                              )}
                              <details className="shrink-0">
                                <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
                                  Edit
                                </summary>
                                <form action={editSubtopicAction} className="mt-2 flex gap-2">
                                  <input type="hidden" name="subtopicId" value={sub.id} />
                                  <input
                                    name="name"
                                    defaultValue={sub.name}
                                    aria-label="Guide name"
                                    className="min-w-0 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground"
                                  />
                                  <button type="submit" className="text-sm text-primary hover:underline">
                                    Save
                                  </button>
                                </form>
                              </details>
                              <form action={deleteSubtopicAction}>
                                <input type="hidden" name="subtopicId" value={sub.id} />
                                <button type="submit" className="text-sm text-error hover:underline">
                                  Delete
                                </button>
                              </form>
                            </div>
                          ))}
                          <form
                            action={saveTopicInstructionsAction}
                            className="mt-3 flex max-w-[65ch] flex-col gap-2 border-t border-border pt-3"
                          >
                            <input type="hidden" name="topicId" value={topic.id} />
                            <label htmlFor={`topic-instr-${topic.id}`} className="text-sm font-medium text-foreground">
                              Custom instructions for this topic&apos;s lessons/questions
                            </label>
                            <textarea
                              id={`topic-instr-${topic.id}`}
                              name="instructions"
                              rows={2}
                              defaultValue={topic.custom_instructions ?? ""}
                              placeholder="e.g. Always include a diagram description. Avoid calculator-based examples."
                              className={INPUT}
                            />
                            <Button type="submit" variant="secondary" size="compact" className="!shadow-none self-start">
                              Save
                            </Button>
                          </form>

                          <details className="group/docs mt-3 border-t border-border pt-3">
                            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-foreground">
                              <ChevronRight
                                className="size-4 transition-transform duration-200 group-open/docs:rotate-90"
                                aria-hidden
                              />
                              Reference documents ({(documentsByTopicId.get(topic.id) ?? []).length})
                            </summary>
                            <p className="mt-2 max-w-[65ch] text-sm text-muted">
                              Upload spec extracts, worksheets, or notes, lessons, practice questions, and
                              flashcards for this topic will be grounded in them.
                            </p>
                            <form action={uploadTopicDocumentsAction} className="mt-2 flex flex-wrap items-center gap-2">
                              <input type="hidden" name="topicId" value={topic.id} />
                              <input
                                type="file"
                                name="files"
                                aria-label="Reference documents to upload"
                                accept=".pdf,.txt,.md"
                                multiple
                                className="min-w-0 flex-1 text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-sm file:font-semibold file:text-white"
                              />
                              <Button type="submit" variant="secondary" size="compact" className="!shadow-none shrink-0">
                                Upload &amp; index
                              </Button>
                            </form>
                            {(documentsByTopicId.get(topic.id) ?? []).length > 0 && (
                              <ul className="mt-2 flex flex-col divide-y divide-border">
                                {(documentsByTopicId.get(topic.id) ?? []).map((doc) => (
                                  <li
                                    key={doc.id}
                                    className="flex items-center justify-between gap-2 py-1.5 text-sm"
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

                          <div className="mt-3 border-t border-border pt-3">
                            <AdminQuestionBankEditor
                              topicId={topic.id}
                              topicName={topic.name}
                              initialQuestions={questionBanksByTopicId.get(topic.id) ?? []}
                            />
                          </div>
                        </div>
                      </details>
                  </li>
                );
              })}
            </ul>
            </Rise>
          </Stagger>
        )}
      </div>
    </PageShell>
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
