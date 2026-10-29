import type {
  Conflict,
  FirstFollowResult,
  Grammar,
  LRItem,
  MergeGroup,
  ParseTable,
  ParserMethod,
} from "./types";
import { formatItem } from "./items";
import { formatProduction } from "./grammar-parser";
import { formatAction } from "./table-builder";

export interface ConflictItem {
  itemIndex: number;
  item: LRItem;
  text: string;
  role: "shift" | "reduce" | "accept";
  action: string;
}

export interface ConflictDiagnosis {
  conflict: Conflict;
  items: ConflictItem[];
  /** Ordered explanation paragraphs. */
  explanation: string[];
  /** Short structural hint about the grammar (never claims a fix). */
  likelyCause: string | null;
  /** Equivalent conflicts (same terminal, same competing item cores) in other methods. */
  alsoIn: { method: ParserMethod; state: number }[];
  /** LALR only: true when no merged CLR state had this conflict on its own. */
  introducedByMerge?: boolean;
  /** LALR only: which CLR states contributed the terminal as a lookahead for each reduce item. */
  mergeOrigins?: { text: string; byState: { state: number; hasTerminal: boolean }[] }[];
  signature: string;
}

/** Identity of a conflict independent of state numbering. */
export function conflictSignature(t: ParseTable, c: Conflict): string {
  const st = t.automaton.states[c.state];
  const cores = c.entries.map((e) => `${st.items[e.itemIndex].prod}.${st.items[e.itemIndex].dot}`).sort();
  return `${c.type}|${c.terminal}|${cores.join(",")}`;
}

export function diagnoseConflicts(
  g: Grammar,
  ff: FirstFollowResult,
  tables: Record<ParserMethod, ParseTable>,
  mergeGroups: MergeGroup[],
): ConflictDiagnosis[] {
  const sigIndex = new Map<string, { method: ParserMethod; state: number }[]>();
  for (const method of ["SLR", "CLR", "LALR"] as ParserMethod[]) {
    for (const c of tables[method].conflicts) {
      const sig = conflictSignature(tables[method], c);
      const arr = sigIndex.get(sig) ?? [];
      arr.push({ method, state: c.state });
      sigIndex.set(sig, arr);
    }
  }

  const out: ConflictDiagnosis[] = [];
  for (const method of ["SLR", "CLR", "LALR"] as ParserMethod[]) {
    const table = tables[method];
    for (const c of table.conflicts) {
      const st = table.automaton.states[c.state];
      const items: ConflictItem[] = c.entries.map((e) => ({
        itemIndex: e.itemIndex,
        item: st.items[e.itemIndex],
        text: formatItem(g, st.items[e.itemIndex]),
        role: e.action.type,
        action: formatAction(e.action),
      }));
      const signature = conflictSignature(table, c);
      const alsoIn = (sigIndex.get(signature) ?? []).filter((x) => x.method !== method);
      const explanation: string[] = [];
      const shiftItems = items.filter((i) => i.role === "shift");
      const reduceItems = items.filter((i) => i.role !== "shift");

      if (c.type === "shift-reduce") {
        explanation.push(
          `In state ${c.state} with lookahead ${c.terminal}, the parser could shift (${shiftItems.map((i) => i.text).join("; ")}) or reduce (${reduceItems.map((i) => i.text).join("; ")}). A deterministic parser must choose exactly one.`,
        );
      } else {
        explanation.push(
          `In state ${c.state} with lookahead ${c.terminal}, ${reduceItems.length} different reductions are possible: ${reduceItems.map((i) => `${i.action} (${i.text})`).join(", ")}. The parser cannot tell which handle is on top of the stack.`,
        );
      }

      for (const r of reduceItems) {
        if (r.role === "accept") continue;
        const p = g.productions[r.item.prod];
        if (method === "SLR") {
          const why = ff.steps.find((s) => s.kind === "FOLLOW" && s.target === p.lhs && s.added.includes(c.terminal));
          explanation.push(
            `SLR reduces ${formatProduction(p)} on every terminal in FOLLOW(${p.lhs}), and ${c.terminal} ∈ FOLLOW(${p.lhs})${why ? ` — ${why.reason}` : "."}`,
          );
        } else {
          explanation.push(
            `${method} reduces ${formatProduction(p)} only on the item's own lookaheads {${r.item.lookaheads.join(", ")}}, which include ${c.terminal}.`,
          );
        }
      }

      let introducedByMerge: boolean | undefined;
      let mergeOrigins: ConflictDiagnosis["mergeOrigins"];
      if (method === "LALR") {
        const group = mergeGroups[c.state];
        const clr = tables.CLR;
        const clrConflictStates = group.clrStates.filter((s) =>
          clr.conflicts.some((x) => x.state === s && x.terminal === c.terminal),
        );
        introducedByMerge = clrConflictStates.length === 0;
        mergeOrigins = reduceItems
          .filter((r) => r.role === "reduce")
          .map((r) => {
            const origin = group.lookaheadOrigins.find((o) => o.prod === r.item.prod && o.dot === r.item.dot);
            return {
              text: formatItem(g, { ...r.item, lookaheads: [] }),
              byState: group.clrStates.map((s) => ({
                state: s,
                hasTerminal: origin?.byState[s]?.includes(c.terminal) ?? false,
              })),
            };
          });
        if (group.clrStates.length > 1) {
          explanation.push(
            introducedByMerge
              ? `LALR state ${c.state} merges CLR states ${group.clrStates.join(", ")} (identical LR(0) cores). None of those CLR states conflicts on ${c.terminal} by itself; the conflict was introduced when their lookahead sets were united.`
              : `LALR state ${c.state} merges CLR states ${group.clrStates.join(", ")}; CLR state${clrConflictStates.length > 1 ? "s" : ""} ${clrConflictStates.join(", ")} already ha${clrConflictStates.length > 1 ? "ve" : "s"} this conflict, so merging did not cause it.`,
          );
        } else if (!introducedByMerge) {
          explanation.push(`LALR state ${c.state} is identical to CLR state ${group.clrStates[0]}, which has the same conflict.`);
        }
      }

      out.push({
        conflict: c,
        items,
        explanation,
        likelyCause: likelyCause(g, method, c, items, alsoIn, introducedByMerge),
        alsoIn,
        introducedByMerge,
        mergeOrigins,
        signature,
      });
    }
  }
  return out;
}

function likelyCause(
  g: Grammar,
  method: ParserMethod,
  c: Conflict,
  items: ConflictItem[],
  alsoIn: { method: ParserMethod; state: number }[],
  introducedByMerge: boolean | undefined,
): string | null {
  const reduce = items.filter((i) => i.role === "reduce").map((i) => g.productions[i.item.prod]);
  const shift = items.filter((i) => i.role === "shift").map((i) => ({ p: g.productions[i.item.prod], dot: i.item.dot }));
  const inCLR = method === "CLR" || alsoIn.some((x) => x.method === "CLR");

  if (method === "LALR" && introducedByMerge) {
    return "Merging LR(1) states with the same core combined lookaheads that were kept apart in the canonical LR(1) parser. The grammar is LR(1) here but not LALR(1) at this point.";
  }
  if (method === "SLR" && !inCLR) {
    return `FOLLOW sets are too coarse: ${c.terminal} can follow ${[...new Set(reduce.map((p) => p.lhs))].join("/")} somewhere in the grammar, but not in the context of state ${c.state}. Canonical LR(1) tracks the exact lookahead and has no conflict here.`;
  }
  if (c.type === "shift-reduce") {
    const amb = reduce.find((p) => p.rhs.length >= 3 && p.rhs[0] === p.lhs && p.rhs[p.rhs.length - 1] === p.lhs);
    if (amb && shift.some((s) => s.p.lhs === amb.lhs)) {
      return `The production ${formatProduction(amb)} is ambiguous: an expression like ${amb.lhs} ${amb.rhs[1]} ${amb.lhs} ${c.terminal} ${amb.lhs} can be grouped either way, because operator precedence/associativity is not encoded in the grammar. Stratifying the grammar into precedence levels removes this.`;
    }
    for (const r of reduce) {
      const s = shift.find(
        (s) =>
          s.p.lhs === r.lhs &&
          s.dot === r.rhs.length &&
          s.p.rhs.length > r.rhs.length &&
          r.rhs.every((x, i) => s.p.rhs[i] === x),
      );
      if (s) {
        return `Optional-suffix ambiguity (the dangling-else pattern): after ${formatProduction(r)} the next ${c.terminal} may belong to this ${r.lhs} (${formatProduction(s.p)}) or to an enclosing one. Yacc-style tools resolve this by preferring shift.`;
      }
    }
  }
  if (c.type === "reduce-reduce") {
    const bodies = new Set(reduce.map((p) => p.rhs.join(" ")));
    if (bodies.size === 1 && reduce.length > 1) {
      return `Different nonterminals (${reduce.map((p) => p.lhs).join(", ")}) derive the same string "${reduce[0].rhs.join(" ") || "ε"}" in the same context, and one token of lookahead cannot distinguish them.`;
    }
  }
  if (inCLR) {
    return "The canonical LR(1) table also has this conflict, so the grammar is not LR(1). It is either ambiguous or needs more than one token of lookahead; no LR(1)-family method can parse it without changing the grammar or adding disambiguation rules.";
  }
  return null;
}
