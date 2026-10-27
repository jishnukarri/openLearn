// Tiny safe arithmetic evaluator for the in-app calculator (no eval()).
// Supports + - × ÷ ^ ( ) sqrt/√ ans pi, decimals and e-notation, and
// implicit multiplication before "(", sqrt, ans and pi: 2(3+1), 4sqrt(9).

type Tok = { t: "num"; v: number } | { t: "op"; v: string } | { t: "id"; v: string };

function tokenize(src: string): Tok[] | null {
  const s = src
    .replace(/×|✕/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .toLowerCase();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[a-z]+/.exec(s.slice(i));
    if (id) {
      if (!["sqrt", "ans", "pi"].includes(id[0])) return null;
      out.push({ t: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    if ("+-*/^()".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    return null;
  }
  return out;
}

export const MAX_EXPR_LENGTH = 200;
const MAX_TOKENS = 120;
const MAX_DEPTH = 40;

export function evaluateExpression(src: string, ans = 0): number | null {
  if (typeof src !== "string" || src.length > MAX_EXPR_LENGTH) return null;
  const tokens = tokenize(src);
  if (!tokens || tokens.length === 0 || tokens.length > MAX_TOKENS) return null;
  let depth = 0;
  const enter = () => { if (++depth > MAX_DEPTH) throw new Error("depth"); };
  const leave = () => { depth--; };
  const toks: Tok[] = tokens;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as { v: string }).v === v;

  function expr(): number {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: string }).v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function startsFactor(): boolean {
    const t = peek();
    return !!t && (t.t === "id" || (t.t === "op" && t.v === "("));
  }
  function term(): number {
    let v = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (toks[p++] as { v: string }).v;
        const r = unary();
        v = op === "*" ? v * r : v / r;
      } else if (startsFactor()) {
        v *= power(); // implicit multiplication
      } else return v;
    }
  }
  function unary(): number {
    enter();
    try {
      if (isOp("-")) { p++; return -unary(); }
      if (isOp("+")) { p++; return unary(); }
      return power();
    } finally { leave(); }
  }
  function power(): number {
    const base = primary();
    if (isOp("^")) { p++; return Math.pow(base, unary()); }
    return base;
  }
  function primary(): number {
    const t = toks[p++];
    if (!t) throw new Error("end");
    if (t.t === "num") return t.v;
    if (t.t === "id") {
      if (t.v === "ans") return ans;
      if (t.v === "pi") return Math.PI;
      if (!isOp("(")) throw new Error("sqrt(");
      p++;
      enter();
      const v = expr();
      leave();
      if (!isOp(")")) throw new Error(")");
      p++;
      if (v < 0) throw new Error("sqrt<0");
      return Math.sqrt(v);
    }
    if (t.v === "(") {
      enter();
      const v = expr();
      leave();
      if (!isOp(")")) throw new Error(")");
      p++;
      return v;
    }
    throw new Error("unexpected");
  }

  try {
    const v = expr();
    if (p !== toks.length || !Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}

// 10 significant figures, trailing zeros and float noise removed.
export function formatResult(n: number): string {
  return String(Number(n.toPrecision(10)));
}
