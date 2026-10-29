import {
  formatAction,
  formatItem,
  formatProduction,
  METHODS,
  sortSymbols,
  tableStats,
  type Analysis,
  type Diagnostic,
  type ParseTable,
  type SimResult,
} from "@/lib/engine";
import { SITE } from "@/lib/site";

const csvCell = (s: string | number) => {
  const v = String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const csvRow = (cells: (string | number)[]) => cells.map(csvCell).join(",");

export function cellText(t: ParseTable, state: number, sym: string): string {
  const e = t.action[state]?.get(sym);
  if (e) return e.map((x) => formatAction(x.action)).join("/");
  const g = t.goto[state]?.get(sym);
  return g === undefined ? "" : String(g);
}

export function tableToCSV(t: ParseTable): string {
  const header = ["State", ...t.terminals.map((x) => `ACTION ${x}`), ...t.nonterminals.map((x) => `GOTO ${x}`)];
  const rows = t.automaton.states.map((s) =>
    csvRow([s.id, ...t.terminals.map((x) => cellText(t, s.id, x)), ...t.nonterminals.map((x) => cellText(t, s.id, x))]),
  );
  return [csvRow(header), ...rows].join("\n");
}

export function tableToJSON(a: Analysis, t: ParseTable) {
  return {
    generator: SITE.name,
    method: t.method,
    productions: a.grammar.productions.map((p) => ({ id: p.id, lhs: p.lhs, rhs: p.rhs, text: formatProduction(p) })),
    terminals: t.terminals,
    nonterminals: t.nonterminals,
    states: t.automaton.states.map((s) => ({
      id: s.id,
      mergedFrom: s.mergedFrom,
      items: s.items.map((it) => ({ text: formatItem(a.grammar, it), kernel: it.kernel, lookaheads: it.lookaheads })),
      action: Object.fromEntries(
        [...t.action[s.id]].map(([sym, es]) => [sym, es.map((e) => ({ action: e.action, text: formatAction(e.action), reason: e.reason }))]),
      ),
      goto: Object.fromEntries(t.goto[s.id]),
    })),
    conflicts: t.conflicts.map((c) => ({
      state: c.state,
      terminal: c.terminal,
      type: c.type,
      actions: c.entries.map((e) => formatAction(e.action)),
    })),
    stats: tableStats(t),
  };
}

export function traceToCSV(r: SimResult): string {
  const header = ["Step", "Stack", "Input", "Action", "Explanation"];
  const rows = r.steps.map((s) =>
    csvRow([
      s.index + 1,
      s.stack.map((e) => (e.symbol ? `${e.symbol} ${e.state}` : e.state)).join(" "),
      s.remaining.join(" "),
      s.kind === "conflict" ? s.actions.map(formatAction).join("/") : s.actions[0] ? formatAction(s.actions[0]) : s.kind,
      s.description,
    ]),
  );
  return [csvRow(header), ...rows, "", csvRow(["Outcome", r.outcome, r.message])].join("\n");
}

export function traceToText(r: SimResult): string {
  const rows = r.steps.map((s) => {
    const stack = s.stack.map((e) => (e.symbol ? `${e.symbol} ${e.state}` : `${e.state}`)).join(" ");
    const act = s.actions.map(formatAction).join("/") || s.kind;
    return `${String(s.index + 1).padStart(3)}  ${stack.padEnd(36)} ${s.remaining.join(" ").padStart(28)}   ${act}`;
  });
  return [`${r.method} trace for: ${r.tokens.join(" ") || "(empty input)"}`, ...rows, `Outcome: ${r.outcome} — ${r.message}`].join("\n");
}

const mdTable = (head: string[], rows: string[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`)].join("\n");

export function buildReport(a: Analysis, opts: { name: string; source: string; diagnostics: Diagnostic[] }): string {
  const g = a.grammar;
  const out: string[] = [];
  out.push(`# ${opts.name} — ${SITE.name} parser report`, "");
  out.push(`Generated ${new Date().toISOString()} by ${SITE.name} (${SITE.tagline}).`, "");
  out.push("## Grammar", "", "```", opts.source.trim(), "```", "");
  out.push("### Numbered productions (augmented)", "");
  out.push(...g.productions.map((p) => `${p.id}. ${formatProduction(p)}`), "");
  if (opts.diagnostics.length) {
    out.push("### Diagnostics", "");
    out.push(...opts.diagnostics.map((d) => `- **${d.severity}**${d.line ? ` (line ${d.line})` : ""}: ${d.message}`), "");
  }

  out.push("## Parser capability", "");
  out.push(
    mdTable(
      ["Method", "States", "ACTION entries", "GOTO entries", "S/R", "R/R", "Conflict-free"],
      METHODS.map((m) => {
        const s = tableStats(a.tables[m]);
        return [m, String(s.states), String(s.actionEntries), String(s.gotoEntries), String(s.shiftReduce), String(s.reduceReduce), s.conflictFree ? "yes" : "no"];
      }),
    ),
    "",
    "_A conflict-free table shows the grammar is in the class handled by that construction; it does not by itself prove the grammar is unambiguous for other methods, and a conflict does not identify which of several possible causes applies._",
    "",
  );

  out.push("## FIRST and FOLLOW", "");
  out.push(
    mdTable(
      ["Nonterminal", "Nullable", "FIRST", "FOLLOW"],
      g.nonterminals.map((nt) => [
        nt,
        a.ff.nullable.has(nt) ? "yes" : "no",
        `{ ${sortSymbols(a.ff.first.get(nt)!, g.terminals).join(", ")} }`,
        `{ ${sortSymbols(a.ff.follow.get(nt)!, g.terminals).join(", ")} }`,
      ]),
    ),
    "",
  );

  for (const m of METHODS) {
    const t = a.tables[m];
    out.push(`## ${m} parsing table`, "");
    out.push(
      mdTable(
        ["State", ...t.terminals, ...t.nonterminals],
        t.automaton.states.map((s) => [
          m === "LALR" && s.mergedFrom && s.mergedFrom.length > 1 ? `${s.id} (${s.mergedFrom.join(",")})` : String(s.id),
          ...t.terminals.map((x) => cellText(t, s.id, x)),
          ...t.nonterminals.map((x) => cellText(t, s.id, x)),
        ]),
      ),
      "",
    );
  }

  out.push("## Conflicts", "");
  if (a.diagnoses.length === 0) out.push("No conflicts in any construction.", "");
  for (const d of a.diagnoses) {
    out.push(`### ${d.conflict.method} state ${d.conflict.state} on \`${d.conflict.terminal}\` — ${d.conflict.type}`, "");
    out.push(...d.items.map((i) => `- \`${i.action}\` from \`${i.text}\``), "");
    out.push(...d.explanation, "");
    if (d.likelyCause) out.push(`**Likely cause:** ${d.likelyCause}`, "");
  }
  return out.join("\n");
}
