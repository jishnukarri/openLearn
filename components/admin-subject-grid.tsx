"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowRight, Eye, X } from "lucide-react";
import { fetchSubjectDetailData } from "@/app/actions/subject-cache-actions";
import type { SubjectItem, SubjectDetailCache } from "@/lib/cache/session-store";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

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
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const closePreview = useCallback(() => {
    setSelectedSubject(null);
    setDetailData(null);
    triggerRef.current?.focus();
  }, []);

  const handleCardClick = async (subject: SubjectItem, trigger: HTMLElement) => {
    triggerRef.current = trigger;
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

  useEffect(() => {
    if (!selectedSubject) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedSubject, closePreview]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
        {initialSubjects.map((subject, i) => (
          <button
            type="button"
            key={subject.id}
            onClick={(e) => handleCardClick(subject, e.currentTarget)}
            className={`card-lift flex min-h-40 cursor-pointer flex-col justify-between rounded-2xl p-5 text-left text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              SUBJECT_COLOURS[i % SUBJECT_COLOURS.length]
            }`}
          >
            <span className="flex w-full items-start justify-between gap-2">
              <span className="text-sm font-medium text-white/80">
                {subject.exam_boards.map((b) => b.name).join(", ") || "No exam boards"}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  subject.status === "published"
                    ? "bg-white/25 text-white"
                    : "bg-black/25 text-white"
                }`}
              >
                {subject.status}
              </span>
            </span>
            <span className="block w-full">
              <span className="block font-[family-name:var(--font-display)] text-xl font-semibold">
                {subject.name}
              </span>
              <span className="mt-3 flex items-center justify-between text-sm text-white/85">
                <span>{subject.topicCount} {subject.topicCount === 1 ? "topic" : "topics"}</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Eye className="size-4" aria-hidden /> Quick preview
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedSubject && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            onClick={closePreview}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border p-5">
                <h2
                  id={titleId}
                  className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground"
                >
                  {selectedSubject.name}
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closePreview}
                  aria-label="Close preview"
                  className="rounded-full border border-border p-2 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingDetail ? (
                  <div role="status" className="flex flex-col items-center justify-center py-10 text-muted">
                    <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm">Loading…</p>
                  </div>
                ) : detailData ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span>Status: <strong className="capitalize text-foreground">{detailData.status}</strong></span>
                      <span>Topics: <strong className="text-foreground">{detailData.topics.length}</strong></span>
                    </div>

                    {detailData.custom_instructions && (
                      <div className="border-y border-border py-3 text-sm">
                        <strong className="text-foreground">Custom instructions</strong>
                        <p className="mt-1 max-w-[65ch] text-muted">{detailData.custom_instructions}</p>
                      </div>
                    )}

                    <h3 className="mt-2 text-sm font-semibold text-foreground">Topics overview</h3>
                    {detailData.topics.length === 0 ? (
                      <p className="text-sm text-muted">No topics created yet.</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-border">
                        {detailData.topics.map((t) => (
                          <li key={t.id} className="py-3 first:pt-0">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-foreground">{t.name}</span>
                              <span className="shrink-0 rounded bg-background px-2 py-0.5 text-xs uppercase text-muted">
                                {t.status}
                              </span>
                            </div>
                            {t.summary && <p className="mt-1 max-w-[65ch] text-sm text-muted">{t.summary}</p>}
                            {t.subtopics.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {t.subtopics.map((st) => (
                                  <span key={st.id} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted">
                                    {st.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Failed to load subject details.</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border bg-background p-4">
                <button
                  type="button"
                  onClick={closePreview}
                  className="text-sm text-muted hover:underline"
                >
                  Close preview
                </button>
                <Link
                  href={`${basePath}/${selectedSubject.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  Full subject manager <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
