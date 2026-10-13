import { AsideBlock, PageHeader, PageShell } from "@/components/page-shell";
import { Rise, Stagger } from "@/components/motion";
import { ScoreBar } from "@/components/results-motion";
import { ATTENTION_LABEL, daysSince } from "@/lib/student-analytics";
import type { StudentOverview } from "@/lib/supabase/student-analytics";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Admin",
  pending_teacher: "Teacher (waiting for approval)",
};

function lastActiveText(iso: string | null): string {
  const d = daysSince(iso);
  if (d === null) return "Not active yet";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

function toneFor(score: number): "success" | "highlight" | "error" {
  return score >= 0.7 ? "success" : score >= 0.5 ? "highlight" : "error";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">{children}</h2>
  );
}

function ActivityChart({ activity }: { activity: StudentOverview["activity"] }) {
  const total = activity.reduce((s, p) => s + p.attempts, 0);
  const activeDays = activity.filter((p) => p.attempts > 0).length;
  const max = Math.max(1, ...activity.map((p) => p.attempts));
  if (total === 0) {
    return <p className="text-base text-muted">No answers in the last 30 days.</p>;
  }
  const w = 300;
  const h = 80;
  const step = w / activity.length;
  return (
    <div className="flex flex-col gap-2">
      <p className="sr-only">
        {total} answers over the last 30 days, on {activeDays} different days. Busiest day had {max}.
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full text-coral" aria-hidden="true" preserveAspectRatio="none">
        <line x1="0" y1={h - 0.5} x2={w} y2={h - 0.5} className="stroke-border" strokeWidth="1" />
        {activity.map((p, i) => {
          const bh = p.attempts === 0 ? 0 : Math.max(3, (p.attempts / max) * (h - 4));
          return (
            <rect key={p.day} x={i * step + 1} y={h - bh} width={Math.max(1, step - 2)} height={bh} rx="1.5" fill="currentColor" />
          );
        })}
      </svg>
      <div className="flex justify-between text-sm text-muted" aria-hidden="true">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
      <p className="text-sm text-muted" aria-hidden="true">
        {total} answers on {activeDays} {activeDays === 1 ? "day" : "days"}.
      </p>
    </div>
  );
}

export function StudentProgress({
  overview,
  supportPanel,
}: {
  overview: StudentOverview;
  /** Slot for the admin support-actions panel. Left empty on the teacher page. */
  supportPanel?: React.ReactNode;
}) {
  const { profile } = overview;
  const weakest = [...overview.mastery].sort((a, b) => a.score - b.score);
  const weakest3 = weakest.filter((m) => m.score < 0.7).slice(0, 3);

  const bySubject = new Map<string, { name: string; topics: typeof weakest }>();
  for (const m of weakest) {
    const g = bySubject.get(m.subjectId) ?? { name: m.subjectName, topics: [] };
    g.topics.push(m);
    bySubject.set(m.subjectId, g);
  }
  const subjects = [...bySubject.values()].sort(
    (a, b) => a.topics[0].score - b.topics[0].score
  );

  const hasNeeds = overview.attention.length > 0 || weakest3.length > 0;

  const aside = (
    <>
      {supportPanel}
      <AsideBlock title="Classes">
        {overview.classes.length === 0 ? (
          <p>Not in any class yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {overview.classes.map((c) => (
              <li key={c.id} className="text-foreground">{c.name}</li>
            ))}
          </ul>
        )}
      </AsideBlock>
      <AsideBlock title="Diagnostic tests">
        {overview.diagnostics.length === 0 ? (
          <p>No diagnostic tests taken yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {overview.diagnostics.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <span className="text-foreground">
                  {d.mode.replace(/[-_]/g, " ")}
                  {d.status ? `, ${d.status.replace(/[-_]/g, " ")}` : ""}
                </span>
                <time dateTime={d.createdAt}>{new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time>
              </li>
            ))}
          </ul>
        )}
      </AsideBlock>
    </>
  );

  return (
    <PageShell size="fluid" aside={aside}>
      <PageHeader
        title={profile.full_name || profile.email}
        description={`${profile.email} · ${ROLE_LABEL[profile.role] ?? profile.role}`}
      />
      <Stagger className="flex flex-col gap-10">
        <Rise>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-5 sm:grid-cols-4 lg:grid-cols-6">
            <Stat label="Last active" value={lastActiveText(overview.lastActive)} />
            <Stat label="Day streak" value={String(profile.streak_count)} />
            <Stat label="XP" value={profile.xp.toLocaleString("en-GB")} />
            <Stat label="Lessons completed" value={String(overview.lessonsCompleted)} />
            <Stat label="Answers given" value={String(overview.totalAnswers)} />
            <Stat
              label="Accuracy"
              value={overview.accuracyPercent === null ? "No data" : `${Math.round(overview.accuracyPercent)}%`}
            />
          </dl>
        </Rise>

        <Rise className="flex flex-col gap-3">
          <Heading>Needs attention</Heading>
          {hasNeeds ? (
            <ul className="flex flex-col gap-1.5 text-base text-foreground">
              {overview.attention.map((r) => (
                <li key={r} className="border-l-2 border-error pl-3">{ATTENTION_LABEL[r]}</li>
              ))}
              {weakest3.map((m) => (
                <li key={`${m.subjectId}-${m.topicName}`} className="border-l-2 border-highlight pl-3">
                  Weak topic: {m.topicName}{" "}
                  <span className="text-muted">
                    ({m.subjectName}, {Math.round(m.score * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted">Nothing to flag. This student is on track.</p>
          )}
        </Rise>

        <Rise className="flex flex-col gap-4">
          <Heading>How well they know each topic</Heading>
          {subjects.length === 0 ? (
            <p className="text-base text-muted">
              No topic scores yet. They appear once the student answers some questions.
            </p>
          ) : (
            subjects.map((s) => (
              <section key={s.name} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">{s.name}</h3>
                <ul className="flex flex-col gap-3">
                  {s.topics.map((t, i) => (
                    <li key={t.topicName} className="grid gap-1.5 sm:grid-cols-[minmax(0,14rem)_1fr_3rem] sm:items-center sm:gap-4">
                      <span className="text-base text-foreground">{t.topicName}</span>
                      <ScoreBar score={t.score} tone={toneFor(t.score)} delay={i * 0.05} />
                      <span className="text-sm text-muted sm:text-right">{Math.round(t.score * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </Rise>

        <Rise className="flex flex-col gap-3">
          <Heading>Answers in the last 30 days</Heading>
          <ActivityChart activity={overview.activity} />
        </Rise>
      </Stagger>
    </PageShell>
  );
}
