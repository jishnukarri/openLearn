"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { fetchSubjectDetailData } from "@/app/actions/subject-cache-actions";
import type { SubjectItem, SubjectDetailCache } from "@/lib/cache/session-store";

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

export function AdminSubjectGrid({
  initialSubjects,
  basePath = "/admin/subjects",
}: {
  initialSubjects: SubjectItem[];
  basePath?: string;
}) {
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [detailData, setDetailData] = useState<SubjectDetailCache | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleCardClick = async (subject: SubjectItem) => {
    setSelectedSubject(subject);
    setLoadingDetail(true);
    setDetailData(null);
    try {
      const detail = await fetchSubjectDetailData(subject.id);
      setDetailData(detail);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialSubjects.map((subject, i) => (
          <div
            key={subject.id}
            onClick={() => handleCardClick(subject)}
            className={`card-lift flex cursor-pointer min-h-40 flex-col justify-between rounded-2xl p-5 text-white ${
              SUBJECT_COLOURS[i % SUBJECT_COLOURS.length]
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-white/75">
                {subject.exam_boards.map((b) => b.name).join(", ") || "No exam boards"}
              </p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-3xs font-semibold ${
                  subject.status === "published"
                    ? "bg-white/25 text-white"
                    : "bg-black/20 text-white/70"
                }`}
              >
                {subject.status}
              </span>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                {subject.name}
              </h2>
              <div className="mt-3 flex items-center justify-between text-2xs text-white/75">
                <span>{subject.topicCount} {subject.topicCount === 1 ? "topic" : "topics"}</span>
                <span className="font-semibold underline">Quick preview →</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
                {selectedSubject.name}
              </h2>
              <button
                onClick={() => { setSelectedSubject(null); setDetailData(null); }}
                className="rounded-full border border-border p-2 text-xs text-muted hover:text-foreground"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
                  <p className="text-xs">Loading…</p>
                </div>
              ) : detailData ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Status: <strong className="text-foreground capitalize">{detailData.status}</strong></span>
                    <span>Topics: <strong className="text-foreground">{detailData.topics.length}</strong></span>
                  </div>

                  {detailData.custom_instructions && (
                    <div className="rounded-xl border border-border bg-background p-3 text-xs">
                      <strong className="text-foreground">Custom instructions:</strong>
                      <p className="mt-1 text-muted">{detailData.custom_instructions}</p>
                    </div>
                  )}

                  <h3 className="mt-2 text-sm font-semibold text-foreground">Topics overview</h3>
                  {detailData.topics.length === 0 ? (
                    <p className="text-xs text-muted">No topics created yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {detailData.topics.map((t) => (
                        <div key={t.id} className="rounded-xl border border-border bg-background p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{t.name}</span>
                            <span className="text-3xs rounded bg-surface px-2 py-0.5 text-muted uppercase">
                              {t.status}
                            </span>
                          </div>
                          {t.summary && <p className="mt-1 text-xs text-muted">{t.summary}</p>}
                          {t.subtopics.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {t.subtopics.map((st) => (
                                <span key={st.id} className="rounded-full bg-surface border border-border px-2 py-0.5 text-3xs text-muted">
                                  {st.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">Failed to load subject details.</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-background p-4">
              <button
                onClick={() => { setSelectedSubject(null); setDetailData(null); }}
                className="text-xs text-muted hover:underline"
              >
                Close preview
              </button>
              <Link
                href={`${basePath}/${selectedSubject.id}`}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
              >
                Full subject manager →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
