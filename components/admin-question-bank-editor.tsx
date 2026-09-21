"use client";

import { useState } from "react";
import { Question } from "@/lib/supabase/questions";
import { updateQuestionVerificationAction } from "@/app/actions/subjects";

export function AdminQuestionBankEditor({
  topicId,
  initialQuestions,
}: {
  topicId: string;
  initialQuestions: Question[];
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editModelAnswer, setEditModelAnswer] = useState("");

  const handleStartEdit = (q: Question) => {
    setEditingId(q.id);
    setEditPrompt(q.prompt);
    setEditModelAnswer(q.model_answer);
  };

  const handleSaveVerify = async (questionId: string, verifyStatus: boolean) => {
    try {
      await updateQuestionVerificationAction({
        questionId,
        verified: verifyStatus,
        prompt: editingId === questionId ? editPrompt : undefined,
        modelAnswer: editingId === questionId ? editModelAnswer : undefined,
      });

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                verified: verifyStatus,
                prompt: editingId === questionId ? editPrompt : q.prompt,
                model_answer: editingId === questionId ? editModelAnswer : q.model_answer,
              }
            : q
        )
      );
      setEditingId(null);
    } catch (e) {
      console.error("Failed to verify question:", e);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
            Question Bank ({questions.length}/10)
          </h3>
          <p className="text-xs text-muted">
            Batch-generated 10-question bank across lesson sections.
          </p>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="text-xs text-muted">No question bank generated yet for this topic.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className={`flex flex-col gap-2 rounded-xl border p-4 transition-all ${
                q.verified
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-xs text-muted">
                    #{idx + 1} (Sec {q.section_index ?? 0})
                  </span>
                  {q.verified ? (
                    <span className="rounded-full bg-success/20 px-2 py-0.5 text-3xs font-semibold text-success">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted/20 px-2 py-0.5 text-3xs text-muted">
                      Unverified
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {editingId === q.id ? (
                    <button
                      onClick={() => handleSaveVerify(q.id, true)}
                      className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Save &amp; Verify
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEdit(q)}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleSaveVerify(q.id, !q.verified)}
                        className={`text-xs font-medium ${
                          q.verified ? "text-muted hover:text-error" : "text-success hover:underline"
                        }`}
                      >
                        {q.verified ? "Unverify" : "Verify ✓"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editingId === q.id ? (
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-2xs text-muted">Question Prompt:</label>
                  <textarea
                    rows={2}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="rounded-lg border border-border bg-surface p-2 text-xs text-foreground"
                  />
                  <label className="text-2xs text-muted">Model Answer:</label>
                  <textarea
                    rows={2}
                    value={editModelAnswer}
                    onChange={(e) => setEditModelAnswer(e.target.value)}
                    className="rounded-lg border border-border bg-surface p-2 text-xs text-foreground"
                  />
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium text-foreground">{q.prompt}</p>
                  <p className="text-2xs text-muted">Model Answer: {q.model_answer}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
