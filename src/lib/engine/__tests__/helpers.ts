import { analyzeGrammar, type Analysis } from "../analysis";
import { formatAction } from "../table-builder";
import type { ParseTable } from "../types";
import { simulate, tokenizeInput } from "../parser-simulator";
import type { ConflictPolicy, ParserMethod } from "../types";

export function analyze(source: string): Analysis {
  const r = analyzeGrammar(source);
  if (!r.analysis) {
    throw new Error(
      `Grammar failed to analyse: ${r.error ?? r.parse.diagnostics.map((d) => `${d.line}: ${d.message}`).join("; ")}`,
    );
  }
  return r.analysis;
}

/** Renders a table row as "sym:act sym:act" sorted by column order, for compact assertions. */
export function row(t: ParseTable, state: number): string {
  const parts: string[] = [];
  for (const sym of t.terminals) {
    const e = t.action[state].get(sym);
    if (e) parts.push(`${sym}:${e.map((x) => formatAction(x.action)).join("/")}`);
  }
  for (const nt of t.nonterminals) {
    const g = t.goto[state].get(nt);
    if (g !== undefined) parts.push(`${nt}:${g}`);
  }
  return parts.join(" ");
}

export function run(a: Analysis, method: ParserMethod, input: string, policy: ConflictPolicy = "halt") {
  const { tokens, errors } = tokenizeInput(input, a.grammar.terminals);
  if (errors.length) throw new Error(errors[0].message);
  return simulate(a.grammar, a.tables[method], tokens, { policy });
}
