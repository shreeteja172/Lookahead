import type {
  Action,
  ConflictPolicy,
  Grammar,
  ParseTable,
  ParseTreeNode,
  SimResult,
  SimStep,
  StackEntry,
  TokenizeResult,
} from "./types";
import { END } from "./types";
import { formatProduction } from "./grammar-parser";
import { formatAction } from "./table-builder";

export const DEFAULT_MAX_STEPS = 10_000;

/**
 * Splits input into grammar terminals. Whitespace-separated tokens that are
 * terminals are used as-is; other chunks are split by longest match against
 * the terminal alphabet, so both `id + id * id` and `id+id*id` work.
 * A trailing `$` is optional.
 */
export function tokenizeInput(text: string, terminals: string[]): TokenizeResult {
  const termSet = new Set(terminals);
  const byLength = [...terminals].sort((a, b) => b.length - a.length);
  const tokens: string[] = [];
  const errors: TokenizeResult["errors"] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const chunk = m[0];
    if (termSet.has(chunk)) {
      tokens.push(chunk);
      continue;
    }
    let i = 0;
    while (i < chunk.length) {
      if (chunk[i] === END && i === chunk.length - 1) {
        i++;
        continue;
      }
      const t = byLength.find((t) => t.length > 0 && chunk.startsWith(t, i));
      if (!t) {
        const rest = chunk.slice(i);
        errors.push({
          token: rest,
          position: m.index + i,
          message: `"${rest}" at position ${m.index + i + 1} is not a terminal of the grammar.`,
        });
        break;
      }
      tokens.push(t);
      i += t.length;
    }
  }
  if (tokens[tokens.length - 1] === END) tokens.pop();
  return { tokens, errors };
}

/**
 * Table-driven shift-reduce parsing (Dragon book Algorithm 4.44), run against
 * a specific generated table. Each recorded step shows the configuration
 * *before* the action is applied, which is the conventional trace layout.
 */
export function simulate(
  grammar: Grammar,
  table: ParseTable,
  tokens: string[],
  options: { maxSteps?: number; policy?: ConflictPolicy } = {},
): SimResult {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const policy = options.policy ?? "halt";
  const productions = grammar.productions;
  const terminalSet = new Set(table.terminals);

  const steps: SimStep[] = [];
  const result = (outcome: SimResult["outcome"], message: string, tree: ParseTreeNode | null = null): SimResult => ({
    method: table.method,
    tokens,
    steps,
    outcome,
    message,
    tree,
  });

  const unknown = tokens.find((t) => !terminalSet.has(t) || t === END);
  if (unknown !== undefined) {
    return result("invalid-input", `Token "${unknown}" is not a terminal of this grammar.`);
  }

  const input = [...tokens, END];
  const stack: StackEntry[] = [{ state: 0 }];
  const nodes: ParseTreeNode[] = [];
  let nodeId = 0;
  let pos = 0;

  for (;;) {
    if (steps.length >= maxSteps) {
      return result(
        "step-limit",
        `Stopped after ${maxSteps} steps. The parser did not terminate — this only happens when a conflict is resolved in a way that loops (e.g. cyclic unit productions).`,
      );
    }
    const top = stack[stack.length - 1].state;
    const a = input[pos];
    const base = {
      index: steps.length,
      stack: stack.map((e) => ({ ...e })),
      remaining: input.slice(pos),
      actionCell: { state: top, terminal: a },
    };
    const entries = table.action[top]?.get(a) ?? [];

    if (entries.length === 0) {
      const expected = table.terminals.filter((t) => (table.action[top]?.get(t)?.length ?? 0) > 0);
      steps.push({
        ...base,
        kind: "error",
        actions: [],
        description: `ACTION[${top}, ${a}] is empty: syntax error. Expected one of: ${expected.join(" ") || "(nothing)"}.`,
      });
      return result(
        "rejected",
        `Syntax error at token ${pos + 1} (${a === END ? "end of input" : `"${a}"`}). In state ${top} the parser expects ${expected.length ? expected.join(", ") : "nothing"}.`,
      );
    }

    let chosen: Action = entries[0].action;
    let note = "";
    if (entries.length > 1) {
      const all = entries.map((e) => e.action);
      if (policy === "halt") {
        steps.push({
          ...base,
          kind: "conflict",
          actions: all,
          description: `ACTION[${top}, ${a}] holds ${all.map(formatAction).join(" and ")}: the table is not deterministic here.`,
        });
        return result(
          "conflict",
          `Parsing stopped in state ${top} on "${a}" because the ${table.method} table has a conflict (${all.map(formatAction).join(" / ")}).`,
        );
      }
      const shift = all.find((x) => x.type === "shift");
      const reduces = all.filter((x) => x.type === "reduce") as Extract<Action, { type: "reduce" }>[];
      chosen = shift ?? reduces.sort((x, y) => x.prod - y.prod)[0] ?? all[0];
      note = ` (conflict ${all.map(formatAction).join("/")} resolved by preferring ${shift ? "shift" : "the earliest production"})`;
    }

    if (chosen.type === "shift") {
      steps.push({
        ...base,
        kind: "shift",
        actions: [chosen],
        description: `Shift ${a} and push state ${chosen.state}${note}.`,
      });
      stack.push({ state: chosen.state, symbol: a });
      nodes.push({ id: nodeId++, symbol: a, token: a, children: [] });
      pos++;
      continue;
    }

    if (chosen.type === "accept") {
      steps.push({ ...base, kind: "accept", actions: [chosen], description: `ACTION[${top}, ${END}] = accept. The input is a sentence of the grammar.` });
      return result("accepted", `Input accepted in ${steps.length} steps.`, nodes[0] ?? null);
    }

    const p = productions[chosen.prod];
    const n = p.rhs.length;
    const popped = n === 0 ? [] : nodes.splice(nodes.length - n, n);
    stack.splice(stack.length - n, n);
    const exposed = stack[stack.length - 1].state;
    const target = table.goto[exposed]?.get(p.lhs);
    steps.push({
      ...base,
      kind: "reduce",
      actions: [chosen],
      gotoCell: { state: exposed, nonterminal: p.lhs, target: target ?? null },
      description: `Reduce by ${p.id}: ${formatProduction(p)} — pop ${n} state${n === 1 ? "" : "s"}, exposing state ${exposed}; GOTO[${exposed}, ${p.lhs}] = ${target ?? "∅"}${note}.`,
    });
    if (target === undefined) {
      return result("rejected", `GOTO[${exposed}, ${p.lhs}] is empty — the table is inconsistent.`);
    }
    stack.push({ state: target, symbol: p.lhs });
    nodes.push({
      id: nodeId++,
      symbol: p.lhs,
      prod: p.id,
      children: n === 0 ? [{ id: nodeId++, symbol: "ε", children: [] }] : popped,
    });
  }
}
