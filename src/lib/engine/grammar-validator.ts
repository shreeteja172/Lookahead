import type { Diagnostic, Grammar } from "./types";

/** Nonterminals not reachable from the augmented start symbol. */
export function findUnreachable(g: Grammar): string[] {
  const reachable = new Set<string>([g.augmentedStart]);
  const queue = [g.augmentedStart];
  const isNT = new Set(g.nonterminals);
  while (queue.length) {
    const nt = queue.shift()!;
    for (const p of g.productions) {
      if (p.lhs !== nt) continue;
      for (const s of p.rhs) {
        if (!reachable.has(s)) {
          reachable.add(s);
          if (isNT.has(s)) queue.push(s);
        }
      }
    }
  }
  return g.nonterminals.filter((nt) => !reachable.has(nt));
}

/** Terminals that never occur in a production reachable from the start symbol. */
export function findUnreachableTerminals(g: Grammar): string[] {
  const unreachable = new Set(findUnreachable(g));
  const used = new Set<string>();
  for (const p of g.productions) if (!unreachable.has(p.lhs)) p.rhs.forEach((s) => used.add(s));
  return g.terminals.filter((t) => !used.has(t));
}

/**
 * Nonterminals that cannot derive any terminal string (non-generating).
 * Standard fixed point: A is generating if some A → α has every symbol of α
 * either a terminal or an already-generating nonterminal.
 */
export function findUnproductive(g: Grammar): string[] {
  const isNT = new Set(g.nonterminals);
  const generating = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.productions) {
      if (generating.has(p.lhs)) continue;
      if (p.rhs.every((s) => !isNT.has(s) || generating.has(s))) {
        generating.add(p.lhs);
        changed = true;
      }
    }
  }
  return g.nonterminals.filter((nt) => !generating.has(nt));
}

/**
 * Tries to split `token` into a sequence of other known symbols or single
 * characters. Returns the split if it contains at least one nonterminal (a
 * strong sign the user forgot spaces, e.g. `cC` instead of `c C`). Longer
 * unknown fragments are not allowed, so tokens like `TIMES` are not flagged
 * just because a nonterminal `T` exists.
 */
export function splitConcatenated(token: string, nonterminals: Set<string>, terminals: Set<string>): string[] | null {
  const known = [...nonterminals, ...terminals].filter((s) => s !== token && s.length > 0);
  const memo = new Map<number, string[] | null>();
  const solve = (i: number): string[] | null => {
    if (i === token.length) return [];
    if (memo.has(i)) return memo.get(i)!;
    let best: string[] | null = null;
    for (const s of [...known, token[i]]) {
      if (token.startsWith(s, i)) {
        const rest = solve(i + s.length);
        if (rest) {
          const cand = [s, ...rest];
          if (!best || cand.length < best.length) best = cand;
        }
      }
    }
    memo.set(i, best);
    return best;
  };
  const split = solve(0);
  if (!split || split.length < 2) return null;
  return split.some((s) => nonterminals.has(s)) ? split : null;
}

export function validateGrammar(
  g: Grammar,
  ctx: { declaredTerminals: string[]; quotedTerminals: Set<string> },
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const userNT = new Set(g.nonterminals.filter((n) => n !== g.augmentedStart));
  const declared = new Set(ctx.declaredTerminals);
  const termSet = new Set(g.terminals);

  const firstLine = (sym: string) => g.productions.find((p) => p.id !== 0 && p.rhs.includes(sym))?.line ?? 0;
  const defLine = (nt: string) => g.productions.find((p) => p.lhs === nt)?.line ?? 0;

  for (const t of g.terminals) {
    if (declared.has(t) || ctx.quotedTerminals.has(t)) continue;
    const split = splitConcatenated(t, userNT, termSet);
    if (split) {
      out.push({
        severity: "warning",
        line: firstLine(t),
        code: "concatenated-symbols",
        message: `"${t}" is treated as a single terminal, but it looks like the symbols ${split.join(" ")} written without spaces.`,
        hint: `Separate symbols with spaces: ${split.join(" ")}. Quote it ('${t}') or declare %token ${t} if it really is one terminal.`,
      });
    } else if (/^[A-Z]/.test(t)) {
      out.push({
        severity: "warning",
        line: firstLine(t),
        code: "undefined-nonterminal",
        message: `"${t}" looks like a nonterminal but has no productions, so it is treated as a terminal.`,
        hint: `Add a rule for ${t}, or declare it with %token ${t} to silence this warning.`,
      });
    }
  }

  for (const t of ctx.declaredTerminals) {
    if (!termSet.has(t) && !userNT.has(t)) {
      out.push({
        severity: "info",
        line: 0,
        code: "unused-token",
        message: `Declared token "${t}" is never used in a production.`,
      });
    }
  }

  const unreachable = findUnreachable(g);
  for (const nt of unreachable) {
    out.push({
      severity: "warning",
      line: defLine(nt),
      code: "unreachable",
      message: `Nonterminal ${nt} is unreachable from the start symbol ${g.start}.`,
      hint: "Its productions never enter any LR item set, so they cannot affect parsing. Remove them or reference the symbol.",
    });
  }

  const unproductive = findUnproductive(g);
  for (const nt of unproductive) {
    if (nt === g.augmentedStart) continue;
    out.push({
      severity: "warning",
      line: defLine(nt),
      code: "unproductive",
      message:
        nt === g.start
          ? `The start symbol ${nt} cannot derive any terminal string, so the language is empty.`
          : `Nonterminal ${nt} is non-generating: it can never derive a string of terminals.`,
      hint: "Every derivation through it is infinite; add a base-case alternative.",
    });
  }

  return out;
}
