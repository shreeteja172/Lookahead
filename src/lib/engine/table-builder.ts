import type {
  Action,
  ActionEntry,
  Automaton,
  Conflict,
  FirstFollowResult,
  Grammar,
  ParseTable,
  ParserMethod,
} from "./types";
import { END } from "./types";
import { formatItem, isComplete, symbolAfterDot } from "./items";
import { sortSymbols } from "./first-follow";
import { formatProduction } from "./grammar-parser";

export const sameAction = (a: Action, b: Action): boolean =>
  a.type === b.type &&
  (a.type === "shift" ? a.state === (b as typeof a).state : a.type === "reduce" ? a.prod === (b as typeof a).prod : true);

export function formatAction(a: Action): string {
  return a.type === "shift" ? `s${a.state}` : a.type === "reduce" ? `r${a.prod}` : "acc";
}

/**
 * Fills ACTION and GOTO from an automaton.
 *
 *  - [A → α·aβ] with GOTO(I, a) = J            ⇒ ACTION[I, a] = shift J
 *  - [A → α·]   (A ≠ S')                       ⇒ ACTION[I, b] = reduce A → α
 *        SLR:       for every b ∈ FOLLOW(A)
 *        CLR/LALR:  for every lookahead b of the item
 *  - [S' → S·]                                 ⇒ ACTION[I, $] = accept
 *  - GOTO(I, A) = J for nonterminal A          ⇒ GOTO[I, A] = J
 *
 * Every insertion is kept; a cell with more than one distinct action is a
 * conflict and is reported rather than silently resolved.
 */
export function buildParseTable(
  method: ParserMethod,
  g: Grammar,
  automaton: Automaton,
  ff: FirstFollowResult,
): ParseTable {
  const terminals = [...g.terminals, END];
  const nonterminals = g.nonterminals.filter((n) => n !== g.augmentedStart);
  const isNT = new Set(g.nonterminals);
  const action: Map<string, ActionEntry[]>[] = automaton.states.map(() => new Map());
  const gotoTable: Map<string, number>[] = automaton.states.map(() => new Map());
  const insertions: ParseTable["insertions"] = [];

  const add = (state: number, terminal: string, entry: ActionEntry) => {
    const cell = action[state].get(terminal) ?? [];
    if (!cell.some((e) => sameAction(e.action, entry.action))) {
      cell.push(entry);
      action[state].set(terminal, cell);
      insertions.push({ state, symbol: terminal, entry });
    }
  };

  for (const st of automaton.states) {
    st.items.forEach((item, itemIndex) => {
      const itemText = formatItem(g, item);
      if (isComplete(g, item)) {
        const p = g.productions[item.prod];
        if (p.id === 0) {
          add(st.id, END, {
            action: { type: "accept" },
            itemIndex,
            reason: `State ${st.id} contains ${itemText}: the whole input has been reduced to ${g.start}, so on ${END} the parser accepts.`,
          });
          return;
        }
        const lookaheads =
          method === "SLR" ? sortSymbols(ff.follow.get(p.lhs) ?? [], g.terminals) : item.lookaheads;
        for (const b of lookaheads) {
          add(st.id, b, {
            action: { type: "reduce", prod: p.id },
            itemIndex,
            reason:
              method === "SLR"
                ? `State ${st.id} contains the complete item ${itemText}, and ${b} ∈ FOLLOW(${p.lhs}) = {${lookaheads.join(", ")}}, so reduce by production ${p.id}: ${formatProduction(p)}.`
                : `State ${st.id} contains the complete item ${itemText} whose lookahead set includes ${b}, so reduce by production ${p.id}: ${formatProduction(p)}.`,
          });
        }
        return;
      }
      const x = symbolAfterDot(g, item)!;
      const target = st.transitions.get(x);
      if (target === undefined) return;
      if (isNT.has(x)) {
        if (!gotoTable[st.id].has(x)) {
          gotoTable[st.id].set(x, target);
          insertions.push({ state: st.id, symbol: x, entry: null, gotoTarget: target });
        }
      } else {
        add(st.id, x, {
          action: { type: "shift", state: target },
          itemIndex,
          reason: `State ${st.id} contains ${formatItem(g, item, { lookaheads: false })} with terminal ${x} after the dot, and GOTO(I${st.id}, ${x}) = I${target}, so shift ${x} and go to state ${target}.`,
        });
      }
    });
  }

  const conflicts: Conflict[] = [];
  action.forEach((row, state) => {
    for (const terminal of terminals) {
      const entries = row.get(terminal);
      if (!entries || entries.length < 2) continue;
      conflicts.push({
        id: `${method}-${state}-${terminal}`,
        method,
        state,
        terminal,
        type: entries.some((e) => e.action.type === "shift") ? "shift-reduce" : "reduce-reduce",
        entries,
      });
    }
  });

  return { method, automaton, terminals, nonterminals, action, goto: gotoTable, conflicts, insertions };
}

export interface TableStats {
  states: number;
  actionCells: number;
  actionEntries: number;
  gotoEntries: number;
  shiftReduce: number;
  reduceReduce: number;
  conflictFree: boolean;
}

export function tableStats(t: ParseTable): TableStats {
  let actionCells = 0;
  let actionEntries = 0;
  for (const row of t.action) {
    actionCells += row.size;
    for (const e of row.values()) actionEntries += e.length;
  }
  const gotoEntries = t.goto.reduce((n, row) => n + row.size, 0);
  const shiftReduce = t.conflicts.filter((c) => c.type === "shift-reduce").length;
  const reduceReduce = t.conflicts.length - shiftReduce;
  return {
    states: t.automaton.states.length,
    actionCells,
    actionEntries,
    gotoEntries,
    shiftReduce,
    reduceReduce,
    conflictFree: t.conflicts.length === 0,
  };
}
