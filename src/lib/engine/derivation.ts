import type { Grammar, SimResult } from "./types";

export interface DerivationStep {
  /** Sentential form (sequence of grammar symbols). */
  form: string[];
  /** Index of the nonterminal rewritten to obtain the next form (absent on the last line). */
  rewrite?: number;
  /** Production used for that rewrite. */
  prod?: number;
}

/**
 * Recovers the rightmost derivation S ⇒* w from an accepted LR parse.
 *
 * Each reduction by A → β replaces the handle β (on top of the stack) with A.
 * Read backwards, the reductions are exactly the steps of a rightmost
 * derivation: an LR parser discovers a rightmost derivation in reverse.
 * Before a reduction the right sentential form is (stack symbols)(remaining
 * input), and the handle is the last |β| stack symbols.
 */
export function rightmostDerivation(g: Grammar, sim: SimResult): DerivationStep[] | null {
  if (sim.outcome !== "accepted") return null;
  const reductions: { before: string[]; at: number; prod: number }[] = [];
  for (const st of sim.steps) {
    const a = st.actions[0];
    if (st.kind !== "reduce" || a?.type !== "reduce") continue;
    const stackSyms = st.stack.slice(1).map((e) => e.symbol!);
    const rest = st.remaining.slice(0, -1); // drop $
    const n = g.productions[a.prod].rhs.length;
    reductions.push({ before: [...stackSyms, ...rest], at: stackSyms.length - n, prod: a.prod });
  }
  const out: DerivationStep[] = [];
  for (let i = reductions.length - 1; i >= 0; i--) {
    const r = reductions[i];
    const p = g.productions[r.prod];
    out.push({ form: [...r.before.slice(0, r.at), p.lhs, ...r.before.slice(r.at + p.rhs.length)], rewrite: r.at, prod: r.prod });
  }
  out.push({ form: reductions.length ? reductions[0].before : sim.tokens.slice() });
  return out;
}
