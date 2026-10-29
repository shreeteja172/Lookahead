import type { Automaton, Grammar, LRItem, LRState, MergeGroup, Transition } from "./types";
import { coreKey } from "./items";
import { sortSymbols } from "./first-follow";

/**
 * LALR(1) by merging canonical LR(1) states with identical LR(0) cores.
 *
 *  1. Partition the CLR states by core (the set of items without lookaheads).
 *  2. Each partition becomes one LALR state; the lookahead set of every item is
 *     the union of that item's lookaheads over the partition.
 *  3. Transitions are inherited: if a CLR state in the partition goes to J on
 *     X, the merged state goes to the partition containing J on X. (All members
 *     agree, because GOTO preserves cores.)
 *
 * LALR states are numbered in order of the smallest CLR state they contain.
 */
export function buildLALRFromCLR(g: Grammar, clr: Automaton): { automaton: Automaton; groups: MergeGroup[] } {
  const order = [...g.terminals];
  const groupOf = new Map<number, number>();
  const groupsByCore = new Map<string, number[]>();
  for (const st of clr.states) {
    const members = groupsByCore.get(st.coreKey);
    if (members) members.push(st.id);
    else groupsByCore.set(st.coreKey, [st.id]);
  }
  const partitions = [...groupsByCore.values()].sort((a, b) => a[0] - b[0]);
  partitions.forEach((members, gi) => members.forEach((m) => groupOf.set(m, gi)));

  const states: LRState[] = [];
  const groups: MergeGroup[] = [];
  partitions.forEach((members, gi) => {
    const base = clr.states[members[0]];
    const origins: MergeGroup["lookaheadOrigins"] = [];
    const items: LRItem[] = base.items.map((it) => {
      const key = coreKey(it);
      const union = new Set<string>();
      const byState: Record<number, string[]> = {};
      for (const m of members) {
        const match = clr.states[m].items.find((x) => coreKey(x) === key);
        if (!match) throw new Error(`Internal error: CLR state ${m} lacks core ${key} of its partition.`);
        byState[m] = match.lookaheads.slice();
        match.lookaheads.forEach((a) => union.add(a));
      }
      origins.push({ prod: it.prod, dot: it.dot, byState });
      return { prod: it.prod, dot: it.dot, kernel: it.kernel, lookaheads: sortSymbols(union, order) };
    });
    const transitionsMap = new Map<string, number>();
    for (const [sym, to] of base.transitions) transitionsMap.set(sym, groupOf.get(to)!);
    states.push({ id: gi, items, transitions: transitionsMap, mergedFrom: members.slice(), coreKey: base.coreKey });
    groups.push({ lalrState: gi, clrStates: members.slice(), coreKey: base.coreKey, lookaheadOrigins: origins });
  });

  const transitions: Transition[] = [];
  for (const st of states) for (const [symbol, to] of st.transitions) transitions.push({ from: st.id, symbol, to });

  return { automaton: { kind: "LALR1", states, transitions, events: [] }, groups };
}
