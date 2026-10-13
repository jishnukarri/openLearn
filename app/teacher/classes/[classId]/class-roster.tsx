"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ATTENTION_LABEL, daysSince } from "@/lib/student-analytics";
import type { ClassRow } from "@/lib/supabase/student-analytics";

type SortKey = "attention" | "active" | "mastery" | "name";

const field =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

const nameOf = (r: ClassRow) => r.fullName ?? r.email;

function lastActiveText(iso: string | null) {
  const d = daysSince(iso);
  if (d === null) return "Never";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

function Mastery({ value }: { value: number | null }) {
  if (value === null) return <span className="text-sm text-muted">No data yet</span>;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Mastery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 w-24 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 font-[family-name:var(--font-mono)] text-sm text-foreground">{pct}%</span>
    </div>
  );
}

function StudentRow({ r, showReasons }: { r: ClassRow; showReasons?: boolean }) {
  return (
    <li>
      <Link
        href={`/teacher/students/${r.profileId}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 py-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary md:grid-cols-[minmax(0,1.5fr)_9rem_6rem_6rem_10rem]"
      >
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-foreground">{nameOf(r)}</p>
          {showReasons && r.attention.length > 0 && (
            <p className="text-sm text-muted">{r.attention.map((a) => ATTENTION_LABEL[a]).join(". ")}</p>
          )}
        </div>
        <p className="text-sm text-muted md:text-foreground">{lastActiveText(r.lastActive)}</p>
        <p className="text-sm text-muted">
          {r.streak} {r.streak === 1 ? "day" : "days"} streak
        </p>
        <p className="font-[family-name:var(--font-mono)] text-sm text-muted">{r.xp} XP</p>
        <Mastery value={r.avgScore} />
      </Link>
    </li>
  );
}

export function ClassRoster({ rows }: { rows: ClassRow[] }) {
  const [sort, setSort] = useState<SortKey>("attention");
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const active = rows.filter((r) => {
      const d = daysSince(r.lastActive);
      return d !== null && d < 7;
    }).length;
    const scored = rows.filter((r) => r.avgScore !== null);
    const avg = scored.length ? Math.round((scored.reduce((s, r) => s + (r.avgScore ?? 0), 0) / scored.length) * 100) : null;
    return { active, attention: rows.filter((r) => r.attention.length > 0).length, avg };
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => !q || nameOf(r).toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    const idle = (r: ClassRow) => daysSince(r.lastActive) ?? Infinity;
    const cmp: Record<SortKey, (a: ClassRow, b: ClassRow) => number> = {
      attention: (a, b) => b.attention.length - a.attention.length || nameOf(a).localeCompare(nameOf(b)),
      active: (a, b) => idle(a) - idle(b) || nameOf(a).localeCompare(nameOf(b)),
      mastery: (a, b) => (a.avgScore ?? -1) - (b.avgScore ?? -1) || nameOf(a).localeCompare(nameOf(b)),
      name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, query, sort]);

  const needs = rows.filter((r) => r.attention.length > 0);
  const summary: [string, string][] = [
    ["Students", String(rows.length)],
    ["Active this week", String(stats.active)],
    ["Need attention", String(stats.attention)],
    ["Class average mastery", stats.avg === null ? "No data yet" : `${stats.avg}%`],
  ];

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-6 border-y border-border py-5 lg:grid-cols-4">
        {summary.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="needs-heading" className="flex flex-col gap-2">
        <h2 id="needs-heading" className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          Needs attention
        </h2>
        {needs.length === 0 ? (
          <p className="text-base text-muted">Everyone is on track right now.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {needs.map((r) => (
              <StudentRow key={r.profileId} r={r} showReasons />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="roster-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="roster-heading" className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            All students
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="roster-search" className="text-sm font-medium text-foreground">
                Find a student
              </label>
              <input
                id="roster-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a name"
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="roster-sort" className="text-sm font-medium text-foreground">
                Sort by
              </label>
              <select id="roster-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={field}>
                <option value="attention">Needs attention first</option>
                <option value="active">Last active</option>
                <option value="mastery">Mastery (lowest first)</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>
        <p className="sr-only" role="status">
          {shown.length} {shown.length === 1 ? "student" : "students"} shown
        </p>
        {shown.length === 0 ? (
          <p className="text-base text-muted">No students match that name.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {shown.map((r) => (
              <StudentRow key={r.profileId} r={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
