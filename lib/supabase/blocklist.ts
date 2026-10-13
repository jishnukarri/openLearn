import "server-only";
import { db } from "./database-client";
import { isBlocked, type BlockEntry, type BlockKind } from "@/lib/blocklist";

export type BlocklistEntry = {
  id: string;
  kind: BlockKind;
  pattern: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  kind: BlockKind;
  pattern: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

let warned = false;
function warnOnce(error: unknown) {
  if (warned) return;
  warned = true;
  console.warn("[blocklist] could not read blocklist_entries, treating as empty:", error);
}

function toEntry(r: Row): BlocklistEntry {
  return {
    id: r.id,
    kind: r.kind,
    pattern: r.pattern,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

/** Admin list. Throws on failure so the admin sees a real error. */
export async function listBlocklist(): Promise<BlocklistEntry[]> {
  const { data, error } = await db
    .from("blocklist_entries")
    .select("id, kind, pattern, note, created_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toEntry);
}

export async function addBlocklistEntry(input: {
  kind: BlockKind;
  pattern: string;
  note?: string | null;
  createdBy?: string | null;
}): Promise<BlocklistEntry> {
  const { data, error } = await db
    .from("blocklist_entries")
    .insert({
      kind: input.kind,
      pattern: input.pattern,
      note: input.note || null,
      created_by: input.createdBy ?? null,
    })
    .select("id, kind, pattern, note, created_by, created_at")
    .single();
  if (error) throw error;
  return toEntry(data as Row);
}

export async function removeBlocklistEntry(id: string): Promise<void> {
  const { error } = await db.from("blocklist_entries").delete().eq("id", id);
  if (error) throw error;
}

async function loadEntries(kind: BlockKind): Promise<BlockEntry[]> {
  try {
    const { data, error } = await db
      .from("blocklist_entries")
      .select("id, kind, pattern")
      .eq("kind", kind);
    if (error) {
      warnOnce(error);
      return [];
    }
    return (data ?? []) as BlockEntry[];
  } catch (err) {
    warnOnce(err);
    return [];
  }
}

/** Matching entry, or null. A missing table means nothing is blocked. */
export async function getBlockMatch(kind: BlockKind, value: string): Promise<BlockEntry | null> {
  return isBlocked(kind, value, await loadEntries(kind));
}
