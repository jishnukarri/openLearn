// Pure blocklist matching. No I/O, so it is safe to import anywhere and easy
// to test. Entries come from the blocklist_entries table.

export type BlockKind = "email" | "name";

export type BlockEntry = {
  id?: string;
  kind: BlockKind;
  pattern: string;
};

const INVISIBLE = /[​-‍⁠﻿­]/g;
const MARKS = /\p{M}/gu;
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

function base(value: string): string {
  return value
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .normalize("NFD")
    .replace(MARKS, "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

/** Canonical address: lowercase, no +tag, gmail dots ignored. */
export function normalizeEmail(value: string): string {
  const v = base(value).replace(/\s+/g, "");
  const at = v.lastIndexOf("@");
  if (at < 0) return v;
  let local = v.slice(0, at);
  let domain = v.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

/** Canonical name: lowercase, letters/digits separated by single spaces. */
export function normalizeName(value: string): string {
  return base(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };

// Only applied to tokens that already contain a letter, so plain numbers
// ("2024", "1234") are never rewritten.
function deLeet(token: string): string {
  if (!/\p{L}/u.test(token)) return token;
  return token.replace(/[013457]/g, (c) => LEET[c]);
}

function nameVariants(normalized: string): string[] {
  const tokens = normalized.split(" ").filter(Boolean);
  const variants = new Set<string>([tokens.join(" ")]);
  variants.add(tokens.map(deLeet).join(" "));

  // "b a d" -> "bad": join runs of 3+ single-character tokens.
  const joined: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) joined.push(run.join(""));
    else joined.push(...run);
    run = [];
  };
  for (const t of tokens) {
    if (t.length === 1) run.push(t);
    else {
      flush();
      joined.push(t);
    }
  }
  flush();
  variants.add(joined.join(" "));
  variants.add(joined.map(deLeet).join(" "));
  return [...variants];
}

function matchesName(value: string, pattern: string): boolean {
  const target = normalizeName(value);
  const pat = normalizeName(pattern);
  if (!target || !pat) return false;
  const patVariants = new Set([pat, pat.split(" ").map(deLeet).join(" ")]);
  for (const v of nameVariants(target)) {
    const padded = ` ${v} `;
    for (const p of patVariants) {
      if (padded.includes(` ${p} `)) return true;
    }
  }
  return false;
}

function matchesEmail(value: string, pattern: string): boolean {
  const addr = normalizeEmail(value);
  const at = addr.lastIndexOf("@");
  if (at < 1) return false;
  const domain = addr.slice(at + 1);

  const p = base(pattern).replace(/\s+/g, "");
  if (!p) return false;
  if (p.startsWith("@") || !p.includes("@")) {
    const blockedDomain = p.replace(/^@/, "");
    if (!blockedDomain) return false;
    const d = GMAIL_DOMAINS.has(blockedDomain) ? "gmail.com" : blockedDomain;
    // The domain itself or any subdomain of it.
    return domain === d || domain.endsWith(`.${d}`);
  }
  return normalizeEmail(p) === addr;
}

/** Returns the first matching entry of the given kind, or null. */
export function isBlocked(
  kind: BlockKind,
  value: string,
  entries: readonly BlockEntry[]
): BlockEntry | null {
  if (!value) return null;
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    const hit =
      kind === "email"
        ? matchesEmail(value, entry.pattern)
        : matchesName(value, entry.pattern);
    if (hit) return entry;
  }
  return null;
}
