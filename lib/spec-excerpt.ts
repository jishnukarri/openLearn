// Finds the part of an exam specification that belongs to one topic or
// subtopic, so a lesson, its exam questions and its flashcards are all written
// against the specification's own wording instead of the model's guess. Pure
// and free: no AI and no database, just splitting the text at its headings and
// ranking the pieces by how well they match the topic's words.

export type SpecSection = { heading: string; text: string };

const MAX_SECTION_CHARS = 2500;
const DEFAULT_MAX_CHARS = 3000;

// A line that opens a new part of a spec: "3.2 Waves", "Topic 4", "Unit 2:",
// "Paper 1", or a short line written in capitals.
const HEADING = /^(\d+(\.\d+)*[.)]?\s+\S.{0,90}|(topic|unit|paper|section|chapter|theme|component|module)\s+\d+.{0,90}|[A-Z][A-Z0-9 ,&'()\-/:]{5,90})$/;

export function splitSpecSections(spec: string): SpecSection[] {
  const sections: SpecSection[] = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    const text = body.join("\n").trim();
    if (heading || text) sections.push({ heading, text });
    body = [];
  };
  for (const raw of spec.split(/\r?\n/)) {
    const line = raw.trim();
    if (line && HEADING.test(line) && line.length <= 100) {
      flush();
      heading = line;
    } else if (line) {
      body.push(line);
    } else if (body.length) {
      body.push("");
    }
  }
  flush();

  // Contents-page lines go first, before short parts are merged: otherwise a run
  // of them would be merged with the first real section into one giant heading.
  const real = sections.filter((s) => !isContentsEntry(s));
  sections.length = 0;
  sections.push(...real);

  // A heading with almost nothing under it belongs with the next part; an
  // overlong part is cut at paragraph breaks so a match stays focused.
  const merged: SpecSection[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.text.length < 40 && i < sections.length - 1) {
      sections[i + 1] = { heading: [s.heading, sections[i + 1].heading].filter(Boolean).join(" · "), text: [s.text, sections[i + 1].text].filter(Boolean).join("\n") };
      continue;
    }
    merged.push(s);
  }
  return merged.flatMap((s) => {
    if (s.text.length <= MAX_SECTION_CHARS) return [s];
    const pieces: SpecSection[] = [];
    let current = "";
    for (const para of s.text.split(/\n{2,}|\n(?=[-•*]\s)/)) {
      if (current && current.length + para.length > MAX_SECTION_CHARS) {
        pieces.push({ heading: s.heading, text: current.trim() });
        current = "";
      }
      current += `${para}\n`;
    }
    if (current.trim()) pieces.push({ heading: s.heading, text: current.trim() });
    return pieces;
  });
}

// A line of a table of contents: a title that ends in a page number
// ("4.7 Magnetism and electromagnetism 94"). A PDF spec opens with pages of
// these, and they name every topic, so without this they outrank the real section.
const PAGE_NUMBER_END = /\s(?:\(page \d{1,3}\)|\d{1,3})$/i;
function isContentsEntry(s: SpecSection): boolean {
  return !!s.heading && PAGE_NUMBER_END.test(s.heading.trim()) && s.text.length < 80;
}

const STOP = new Set(
  ("a an the of to in on at by for with from and or but as is are was were be been it its this that these those " +
    "how what why when which who describe explain state give name use using about into than then so not no can will " +
    "one two key idea ideas topic topics subtopic basics introduction overview").split(" ")
);

// Light stemming so "waves", "wave" and "waved" agree: plural and -ing/-ed
// endings come off only when a real word stem (4+ letters) is left.
function stem(word: string): string {
  let w = word.replace(/'s$/, "");
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(sses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith("ing") && w.length - 3 >= 4) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length - 2 >= 4) return w.slice(0, -2);
  return w;
}

// Lowercase words with filler removed, stemmed.
export function termsOf(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9']+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
}

// "4.7.1 Poles of a magnet" -> "4.7.1"
const sectionNumber = (heading: string): string | null => /^(\d+(?:\.\d+)+)\b/.exec(heading.trim())?.[1] ?? null;

export type ExcerptQuery = {
  name: string; // the topic or subtopic being written
  parentName?: string; // the topic a subtopic belongs to, a weaker signal
};

// "Space physics (physics only)" -> "Space physics": a tier or paper qualifier is
// not part of the topic's name and would match the whole spec.
const cleanName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/g, "").trim() || name;

// Parts of a spec that name every topic but teach none of them.
const OVERVIEW_HEADING = /^(\d+(\.\d+)*\.?\s+)?(subject content|assessments?|specification at a glance|introduction|contents|scheme of assessment|aims|appendix|glossary|working scientifically)\b/i;

// A section's own title is the last part of its (possibly merged) heading.
const ownTitle = (heading: string) => heading.split(" · ").pop() ?? heading;

export function findSpecExcerpt(spec: string, rawQuery: ExcerptQuery, maxChars = DEFAULT_MAX_CHARS): string {
  const query = { name: cleanName(rawQuery.name), parentName: rawQuery.parentName ? cleanName(rawQuery.parentName) : undefined };
  const sections = splitSpecSections(spec);
  if (!sections.length) return "";

  const nameTerms = [...new Set(termsOf(query.name))];
  const parentTerms = [...new Set(termsOf(query.parentName ?? ""))].filter((t) => !nameTerms.includes(t));
  if (!nameTerms.length && !parentTerms.length) return "";

  const docs = sections.map((s) => ({ s, head: new Set(termsOf(s.heading)), body: termsOf(s.text) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set([...d.head, ...d.body])) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + docs.length / (1 + (df.get(t) ?? 0)));

  const phrase = query.name.trim().toLowerCase();
  const scored = docs.map((d, index) => {
    const tf = new Map<string, number>();
    for (const t of d.body) tf.set(t, (tf.get(t) ?? 0) + 1);
    const score = (terms: string[], weight: number) =>
      terms.reduce((sum, t) => sum + weight * idf(t) * (Math.log(1 + (tf.get(t) ?? 0)) + (d.head.has(t) ? 2.5 : 0)), 0);
    let total = score(nameTerms, 2) + score(parentTerms, 0.7);
    // Real teaching content has substance; a heading with a line or two under it is rarely the answer.
    total *= Math.min(1.3, 0.7 + d.s.text.length / 1500);
    if (phrase.length > 3 && (`${d.s.heading}\n${d.s.text}`).toLowerCase().includes(phrase)) total += 6;
    // The section titled exactly this ("4.5 Forces" for "Forces") is the one.
    const title = ownTitle(d.s.heading).replace(/^\d+(\.\d+)*\.?\s+/, "").trim().toLowerCase();
    if (phrase.length > 2 && title === phrase) total += 14;
    if (OVERVIEW_HEADING.test(ownTitle(d.s.heading))) total *= 0.3;
    return { index, total, section: d.s };
  });

  const best = Math.max(...scored.map((x) => x.total));
  // Nothing matched well enough: better no excerpt than an unrelated one.
  if (best < 1.5) return "";
  // The best match is only a list that names the topic (course overview, assessment
  // plan): the spec has no section teaching it, and a list of topic names is no help.
  if (OVERVIEW_HEADING.test(ownTitle(scored.find((x) => x.total === best)!.section.heading))) return "";

  let picked = scored
    .filter((x) => x.total >= best * 0.45)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  // A topic's requirements live in its numbered sub-sections ("4.7" owns
  // "4.7.1", "4.7.2"): when the best match is numbered, bring those in too.
  const top = picked[0];
  const topId = sectionNumber(top.section.heading);
  if (topId) {
    const kids = scored.filter((x) => !picked.includes(x) && sectionNumber(x.section.heading)?.startsWith(`${topId}.`));
    picked = [...picked, ...kids];
  }

  let used = 0;
  const parts: { index: number; text: string }[] = [];
  for (const p of picked) {
    const block = `${p.section.heading ? `${p.section.heading}\n` : ""}${p.section.text}`.trim();
    const room = maxChars - used;
    if (room < 200) break;
    const text = block.length > room ? `${block.slice(0, room).replace(/\s+\S*$/, "")}…` : block;
    parts.push({ index: p.index, text });
    used += text.length + 2;
  }
  // Back in the order the spec has them, which reads naturally.
  return parts.sort((a, b) => a.index - b.index).map((p) => p.text).join("\n\n");
}
