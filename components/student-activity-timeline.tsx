import Link from "next/link";
import {
  BookCheck,
  BookOpen,
  ClipboardCheck,
  Dumbbell,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  ACTIVITY_FILTERS,
  groupByDay,
  type ActivityEvent,
  type ActivityFilter,
  type ActivityKind,
} from "@/lib/student-activity";

const ICONS: Record<ActivityKind, LucideIcon> = {
  account: UserPlus,
  subjects: BookOpen,
  "diagnostic-started": ClipboardCheck,
  "diagnostic-completed": ClipboardCheck,
  lesson: BookCheck,
  "practice-started": Dumbbell,
  "practice-completed": Sparkles,
  answer: MessageSquareText,
  class: Users,
  paper: FileText,
  admin: ShieldCheck,
};

function href(basePath: string, filter: ActivityFilter, before?: string | null) {
  const p = new URLSearchParams();
  if (filter !== "all") p.set("activity", filter);
  if (before) p.set("before", before);
  const q = p.toString();
  return q ? `${basePath}?${q}#activity` : `${basePath}#activity`;
}

function timeText(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function StudentActivityTimeline({
  events,
  nextBefore,
  filter,
  basePath,
  isFirstPage,
}: {
  events: ActivityEvent[];
  nextBefore: string | null;
  filter: ActivityFilter;
  /** Path of the page this renders on, used for filter and Load more links. */
  basePath: string;
  isFirstPage: boolean;
}) {
  const groups = groupByDay(events);
  return (
    <section id="activity" aria-labelledby="activity-heading" className="flex flex-col gap-4">
      <h2 id="activity-heading" className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        Activity timeline
      </h2>
      <nav aria-label="Filter activity" className="flex flex-wrap gap-2">
        {ACTIVITY_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(basePath, f.value)}
            scroll={false}
            aria-current={f.value === filter ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition-colors motion-reduce:transition-none ${
              f.value === filter ? "border-foreground bg-surface text-foreground" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <p className="text-base text-muted">
          {isFirstPage ? "Nothing to show here yet. Activity appears as the student uses the app." : "No older activity."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted">{g.label}</h3>
              <ol className="flex flex-col divide-y divide-border border-y border-border">
                {g.events.map((e) => {
                  const Icon = ICONS[e.kind];
                  return (
                    <li key={e.id} className="flex items-start gap-3 py-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-base text-foreground">{e.text}</p>
                        {e.detail ? <p className="break-words text-sm text-muted">{e.detail}</p> : null}
                        {e.answer ? (
                          <details className="group mt-2">
                            <summary className="w-fit cursor-pointer list-none rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                              <span className="group-open:hidden">Show answer</span>
                              <span className="hidden group-open:inline">Hide answer</span>
                            </summary>
                            <dl className="mt-3 flex max-w-[65ch] flex-col gap-3 text-sm">
                              {e.answer.question ? (
                                <div>
                                  <dt className="font-medium text-muted">Question</dt>
                                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{e.answer.question}</dd>
                                </div>
                              ) : null}
                              <div>
                                <dt className="font-medium text-muted">Student&apos;s answer</dt>
                                <dd className="mt-0.5 whitespace-pre-wrap break-words text-foreground">
                                  {e.answer.written?.trim() ? e.answer.written : "No written answer (marked from a photo or a multiple-choice pick)."}
                                </dd>
                              </div>
                              {e.answer.feedback.length > 0 ? (
                                <div>
                                  <dt className="font-medium text-muted">Feedback they received</dt>
                                  <dd className="mt-1">
                                    <ul className="flex flex-col gap-2">
                                      {e.answer.feedback.map((f, i) => (
                                        <li key={i} className="whitespace-pre-wrap break-words text-foreground">
                                          {f.met !== null ? (
                                            <span className={f.met ? "font-medium text-success-ink" : "font-medium text-error-ink"}>
                                              {f.met ? "Got it" : "Missed"}
                                              {f.point ? ": " : ""}
                                            </span>
                                          ) : null}
                                          {f.point ? <span className="font-medium">{f.point}. </span> : null}
                                          {f.comment}
                                        </li>
                                      ))}
                                    </ul>
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                          </details>
                        ) : null}
                      </div>
                      <time dateTime={e.at} className="shrink-0 text-sm text-muted">
                        {timeText(e.at)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 text-sm">
        {!isFirstPage ? (
          <Link href={href(basePath, filter)} scroll={false} className="text-muted underline underline-offset-4 hover:text-foreground">
            Back to newest
          </Link>
        ) : null}
        {nextBefore ? (
          <Link href={href(basePath, filter, nextBefore)} scroll={false} className="text-foreground underline underline-offset-4">
            Load more
          </Link>
        ) : null}
      </div>
    </section>
  );
}
