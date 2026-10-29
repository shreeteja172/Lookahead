import type { FirstFollowResult, Grammar, SetStep } from "./types";
import { END, EPS } from "./types";
import { formatProduction } from "./grammar-parser";

/**
 * Computes NULLABLE, FIRST and FOLLOW with the classic fixed-point iteration,
 * logging every change together with the production that caused it so that the
 * UI can replay the computation step by step.
 */
export function computeFirstFollow(g: Grammar): FirstFollowResult {
  const isNT = new Set(g.nonterminals);
  const steps: SetStep[] = [];
  const log = (s: Omit<SetStep, "index">) => steps.push({ ...s, index: steps.length });
  const prodText = new Map(g.productions.map((p) => [p.id, formatProduction(p)]));

  /* ---------------- NULLABLE ---------------- */
  const nullable = new Set<string>();
  let nullablePasses = 0;
  for (let changed = true; changed; ) {
    changed = false;
    nullablePasses++;
    for (const p of g.productions) {
      if (nullable.has(p.lhs)) continue;
      if (p.rhs.every((s) => nullable.has(s))) {
        nullable.add(p.lhs);
        changed = true;
        log({
          pass: nullablePasses,
          kind: "NULLABLE",
          target: p.lhs,
          added: [EPS],
          productionId: p.id,
          reason:
            p.rhs.length === 0
              ? `${p.lhs} → ε is an ε-production, so ${p.lhs} is nullable.`
              : `Every symbol of ${prodText.get(p.id)} is nullable (${p.rhs.join(", ")}), so ${p.lhs} is nullable.`,
          source: p.rhs.length === 0 ? { type: "epsilon" } : { type: "first", symbols: p.rhs },
        });
      }
    }
  }

  /* ---------------- FIRST ---------------- */
  const first = new Map<string, Set<string>>();
  for (const t of g.terminals) first.set(t, new Set([t]));
  first.set(END, new Set([END]));
  for (const nt of g.nonterminals) first.set(nt, new Set());

  let firstPasses = 0;
  for (let changed = true; changed; ) {
    changed = false;
    firstPasses++;
    for (const p of g.productions) {
      const target = first.get(p.lhs)!;
      let allNullable = true;
      for (let i = 0; i < p.rhs.length; i++) {
        const x = p.rhs[i];
        const added: string[] = [];
        for (const a of first.get(x)!) {
          if (a !== EPS && !target.has(a)) {
            target.add(a);
            added.push(a);
          }
        }
        if (added.length) {
          changed = true;
          const prefix = p.rhs.slice(0, i);
          log({
            pass: firstPasses,
            kind: "FIRST",
            target: p.lhs,
            added,
            productionId: p.id,
            reason: !isNT.has(x)
              ? `In ${prodText.get(p.id)}, terminal ${x} can begin ${p.lhs}${prefix.length ? ` (after the nullable prefix ${prefix.join(" ")})` : ""}.`
              : `In ${prodText.get(p.id)}, FIRST(${x}) ∖ {ε} ⊆ FIRST(${p.lhs})${prefix.length ? ` because ${prefix.join(" ")} ${prefix.length > 1 ? "are" : "is"} nullable` : ` because ${x} is the first symbol`}.`,
            source: isNT.has(x) ? { type: "first", symbols: [x] } : { type: "terminal", symbol: x },
          });
        }
        if (!nullable.has(x)) {
          allNullable = false;
          break;
        }
      }
      if (allNullable && !target.has(EPS)) {
        target.add(EPS);
        changed = true;
        log({
          pass: firstPasses,
          kind: "FIRST",
          target: p.lhs,
          added: [EPS],
          productionId: p.id,
          reason:
            p.rhs.length === 0
              ? `${prodText.get(p.id)} derives the empty string, so ε ∈ FIRST(${p.lhs}).`
              : `Every symbol in ${prodText.get(p.id)} is nullable, so ε ∈ FIRST(${p.lhs}).`,
          source: { type: "epsilon" },
        });
      }
    }
  }

  /* ---------------- FOLLOW ---------------- */
  const follow = new Map<string, Set<string>>();
  for (const nt of g.nonterminals) follow.set(nt, new Set());
  follow.get(g.augmentedStart)!.add(END);
  log({
    pass: 0,
    kind: "FOLLOW",
    target: g.augmentedStart,
    added: [END],
    productionId: 0,
    reason: `${END} ∈ FOLLOW(${g.augmentedStart}) because ${g.augmentedStart} is the augmented start symbol and input ends with ${END}.`,
    source: { type: "end" },
  });

  let followPasses = 0;
  for (let changed = true; changed; ) {
    changed = false;
    followPasses++;
    for (const p of g.productions) {
      for (let i = 0; i < p.rhs.length; i++) {
        const b = p.rhs[i];
        if (!isNT.has(b)) continue;
        const beta = p.rhs.slice(i + 1);
        const target = follow.get(b)!;
        const fb = firstOfSequence(beta, first, nullable);

        const added: string[] = [];
        for (const a of fb) {
          if (a !== EPS && !target.has(a)) {
            target.add(a);
            added.push(a);
          }
        }
        if (added.length) {
          changed = true;
          log({
            pass: followPasses,
            kind: "FOLLOW",
            target: b,
            added,
            productionId: p.id,
            reason: `In ${prodText.get(p.id)}, ${b} is followed by ${beta.join(" ")}, so FIRST(${beta.join(" ")}) ∖ {ε} ⊆ FOLLOW(${b}).`,
            source: { type: "first", symbols: beta },
          });
        }

        if (fb.has(EPS) && p.lhs !== b) {
          const addedF: string[] = [];
          for (const a of follow.get(p.lhs)!) {
            if (!target.has(a)) {
              target.add(a);
              addedF.push(a);
            }
          }
          if (addedF.length) {
            changed = true;
            log({
              pass: followPasses,
              kind: "FOLLOW",
              target: b,
              added: addedF,
              productionId: p.id,
              reason:
                beta.length === 0
                  ? `In ${prodText.get(p.id)}, ${b} is at the right end, so FOLLOW(${p.lhs}) ⊆ FOLLOW(${b}).`
                  : `In ${prodText.get(p.id)}, everything after ${b} (${beta.join(" ")}) is nullable, so FOLLOW(${p.lhs}) ⊆ FOLLOW(${b}).`,
              source: { type: "follow", symbol: p.lhs },
            });
          }
        }
      }
    }
  }

  return {
    nullable,
    first,
    follow,
    steps,
    passes: { nullable: nullablePasses, first: firstPasses, follow: followPasses },
  };
}

/** FIRST of a symbol string; contains ε iff every symbol is nullable (or the string is empty). */
export function firstOfSequence(
  symbols: string[],
  first: Map<string, Set<string>>,
  nullable: Set<string>,
): Set<string> {
  const out = new Set<string>();
  for (const s of symbols) {
    const fs = first.get(s);
    if (!fs) {
      // Unknown symbol (e.g. a lookahead terminal `$`): treat as a terminal.
      out.add(s);
      return out;
    }
    for (const a of fs) if (a !== EPS) out.add(a);
    if (!nullable.has(s)) return out;
  }
  out.add(EPS);
  return out;
}

/** Deterministic display ordering: grammar terminal order, then `$`, then ε. */
export function sortSymbols(set: Iterable<string>, terminalOrder: string[]): string[] {
  const rank = new Map(terminalOrder.map((t, i) => [t, i]));
  return [...set].sort((a, b) => {
    const ra = a === EPS ? 1e9 + 1 : a === END ? 1e9 : (rank.get(a) ?? 1e8);
    const rb = b === EPS ? 1e9 + 1 : b === END ? 1e9 : (rank.get(b) ?? 1e8);
    return ra - rb || a.localeCompare(b);
  });
}
