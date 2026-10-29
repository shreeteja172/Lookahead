import type { Action, ConflictPolicy, ParseTable, ParserMethod, SimResult } from "./types";
import type { Analysis } from "./analysis";
import { METHODS } from "./analysis";
import { simulate } from "./parser-simulator";
import { formatAction, tableStats, type TableStats } from "./table-builder";
import { formatProduction } from "./grammar-parser";

export interface CellDiff {
  /** State in the left table. */
  leftState: number;
  /** Corresponding state in the right table. */
  rightState: number;
  symbol: string;
  left: string[];
  right: string[];
}

export interface TraceDiff {
  /** Index of the first step whose action differs between the two traces (ignoring state numbers), or null. */
  firstDivergence: number | null;
  /** Number of input tokens consumed when each parser stopped. */
  consumed: Record<ParserMethod, number>;
}

export interface Comparison {
  stats: Record<ParserMethod, TableStats>;
  sims: Record<ParserMethod, SimResult> | null;
  /** SLR vs LALR: same LR(0) cores, so cells map one-to-one. */
  slrVsLalr: CellDiff[];
  /** CLR vs LALR: every CLR state maps to the LALR state that absorbed it. */
  clrVsLalr: CellDiff[];
  trace: TraceDiff | null;
}

/** Action text with shift targets translated into another automaton's numbering. */
function normalized(actions: Action[] | undefined, mapState: (s: number) => number): string[] {
  return (actions ?? [])
    .map((a) => (a.type === "shift" ? formatAction({ type: "shift", state: mapState(a.state) }) : formatAction(a)))
    .sort();
}

const cellActions = (t: ParseTable, s: number, sym: string) => t.action[s]?.get(sym)?.map((e) => e.action);

export function compareParsers(
  analysis: Analysis,
  tokens: string[] | null,
  policy: ConflictPolicy = "halt",
): Comparison {
  const { tables, lr0, lalr, mergeGroups } = analysis;
  const stats = Object.fromEntries(METHODS.map((m) => [m, tableStats(tables[m])])) as Record<ParserMethod, TableStats>;

  // SLR (LR(0) automaton) ↔ LALR: match states by LR(0) core.
  const lalrByCore = new Map(lalr.states.map((s) => [s.coreKey, s.id]));
  const slrToLalr = (s: number) => lalrByCore.get(lr0.states[s].coreKey) ?? -1;
  const slrVsLalr: CellDiff[] = [];
  for (const st of lr0.states) {
    const l = slrToLalr(st.id);
    for (const sym of tables.SLR.terminals) {
      const left = normalized(cellActions(tables.SLR, st.id, sym), slrToLalr);
      const right = normalized(cellActions(tables.LALR, l, sym), (x) => x);
      if (left.join() !== right.join()) slrVsLalr.push({ leftState: st.id, rightState: l, symbol: sym, left, right });
    }
  }

  // CLR ↔ LALR: each CLR state belongs to exactly one merge group.
  const clrToLalr = new Map<number, number>();
  for (const g of mergeGroups) for (const c of g.clrStates) clrToLalr.set(c, g.lalrState);
  const mapClr = (s: number) => clrToLalr.get(s) ?? -1;
  const clrVsLalr: CellDiff[] = [];
  for (const st of analysis.lr1.states) {
    const l = mapClr(st.id);
    for (const sym of tables.CLR.terminals) {
      const left = normalized(cellActions(tables.CLR, st.id, sym), mapClr);
      const right = normalized(cellActions(tables.LALR, l, sym), (x) => x);
      if (left.join() !== right.join()) clrVsLalr.push({ leftState: st.id, rightState: l, symbol: sym, left, right });
    }
  }

  let sims: Comparison["sims"] = null;
  let trace: TraceDiff | null = null;
  if (tokens) {
    sims = Object.fromEntries(
      METHODS.map((m) => [m, simulate(analysis.grammar, tables[m], tokens, { policy })]),
    ) as Record<ParserMethod, SimResult>;
    const sig = (r: SimResult) =>
      r.steps.map((s) => {
        const a = s.actions[0];
        return `${s.kind}:${a?.type === "reduce" ? formatProduction(analysis.grammar.productions[a.prod]) : ""}:${s.remaining.length}`;
      });
    const sigs = METHODS.map((m) => sig(sims![m]));
    const len = Math.max(...sigs.map((s) => s.length));
    let firstDivergence: number | null = null;
    for (let i = 0; i < len; i++) {
      if (sigs.some((s) => s[i] !== sigs[0][i])) {
        firstDivergence = i;
        break;
      }
    }
    const consumed = Object.fromEntries(
      METHODS.map((m) => {
        const last = sims![m].steps[sims![m].steps.length - 1];
        return [m, last ? tokens.length + 1 - last.remaining.length : 0];
      }),
    ) as Record<ParserMethod, number>;
    trace = { firstDivergence, consumed };
  }

  return { stats, sims, slrVsLalr, clrVsLalr, trace };
}
