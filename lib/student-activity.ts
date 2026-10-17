export type ActivityFilter = "all" | "lessons" | "practice" | "diagnostics" | "classes";

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lessons", label: "Lessons" },
  { value: "practice", label: "Practice" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "classes", label: "Classes" },
];

export type ActivityKind =
  | "account"
  | "subjects"
  | "diagnostic-started"
  | "diagnostic-completed"
  | "lesson"
  | "practice-started"
  | "practice-completed"
  | "answer"
  | "class"
  | "paper"
  | "admin";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  /** ISO timestamp. */
  at: string;
  text: string;
  detail?: string;
};

export const PAGE_SIZE = 50;

export function parseFilter(value: string | string[] | undefined): ActivityFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return ACTIVITY_FILTERS.some((f) => f.value === v) ? (v as ActivityFilter) : "all";
}

/** Which event kinds each filter chip shows. "all" shows everything. */
export const FILTER_KINDS: Record<Exclude<ActivityFilter, "all">, ActivityKind[]> = {
  lessons: ["lesson"],
  practice: ["practice-started", "practice-completed", "answer"],
  diagnostics: ["diagnostic-started", "diagnostic-completed"],
  classes: ["class", "paper"],
};

export function matchesFilter(kind: ActivityKind, filter: ActivityFilter): boolean {
  return filter === "all" || FILTER_KINDS[filter].includes(kind);
}

/** Merge lists, drop duplicate ids, and sort newest first (id breaks ties so order is stable). */
export function mergeEvents(...lists: ActivityEvent[][]): ActivityEvent[] {
  const seen = new Map<string, ActivityEvent>();
  for (const list of lists) for (const e of list) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()].sort((a, b) => {
    const d = Date.parse(b.at) - Date.parse(a.at);
    return d !== 0 ? d : a.id < b.id ? 1 : -1;
  });
}

/** Cut a merged list to one page and report the cursor for the next one. */
export function paginate(events: ActivityEvent[], limit: number): { events: ActivityEvent[]; nextBefore: string | null } {
  if (events.length <= limit) return { events, nextBefore: null };
  const page = events.slice(0, limit);
  return { events: page, nextBefore: page[page.length - 1].at };
}

export function truncateSnippet(text: string | null | undefined, max = 120): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const k = dayKey(d);
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export type DayGroup = { key: string; label: string; events: ActivityEvent[] };

/** Group an already-sorted list into consecutive UTC days. */
export function groupByDay(events: ActivityEvent[], now: Date = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of events) {
    const key = e.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(e);
    else groups.push({ key, label: dayLabel(e.at, now), events: [e] });
  }
  return groups;
}
