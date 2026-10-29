import type { Diagnostic, Grammar, GrammarParseResult, Production } from "./types";
import { END, EPS } from "./types";
import { validateGrammar } from "./grammar-validator";

/**
 * Grammar notation
 * ----------------
 *   E  -> E + T | T          one or more alternatives separated by `|`
 *   T  →  T * F              `->`, `→` and `::=` are all accepted arrows
 *      |  F                  a line starting with `|` continues the previous rule
 *   A  -> ε                  ε, eps, epsilon or λ denote the empty string
 *   F  -> '(' E ')' | id     quotes force a terminal (useful for `|` or `->`)
 *   %token id num            optional: declare terminals explicitly
 *   %start S                 optional: choose the start symbol
 *   // comment, or a line starting with `#`
 *
 * Symbols are separated by whitespace. Every symbol that appears on the left
 * of an arrow is a nonterminal; every other symbol is a terminal. The first
 * rule's left-hand side is the start symbol unless overridden.
 */

export const EPSILON_SPELLINGS = new Set(["ε", "eps", "epsilon", "λ", "Ɛ"]);
const ARROWS = ["::=", "->", "→"];

export interface ParseOptions {
  /** Manually chosen start symbol; falls back to `%start` then the first LHS. */
  startOverride?: string;
}

interface RawToken {
  text: string;
  quoted: boolean;
  /** `|` separator (unquoted). */
  bar: boolean;
}

interface RawAlternative {
  line: number;
  symbols: RawToken[];
}

/** Splits a rule body into tokens, honouring quotes and bare `|` separators. */
export function lexRuleBody(body: string): { tokens: RawToken[]; error?: string } {
  const tokens: RawToken[] = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "|") {
      tokens.push({ text: "|", quoted: false, bar: true });
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const close = body.indexOf(ch, i + 1);
      // A lone quote character (e.g. the symbol E') is not a quoted literal.
      if (close > i + 1) {
        tokens.push({ text: body.slice(i + 1, close), quoted: true, bar: false });
        i = close + 1;
        continue;
      }
      if (close === -1 && (i + 1 >= body.length || /\s/.test(body[i + 1]))) {
        tokens.push({ text: ch, quoted: false, bar: false });
        i++;
        continue;
      }
      if (close === -1) return { tokens, error: `Unterminated quote ${ch}…` };
    }
    let j = i;
    while (j < body.length && !/\s/.test(body[j]) && body[j] !== "|") j++;
    tokens.push({ text: body.slice(i, j), quoted: false, bar: false });
    i = j;
  }
  return { tokens };
}

function findArrow(line: string): { index: number; arrow: string } | null {
  let best: { index: number; arrow: string } | null = null;
  for (const arrow of ARROWS) {
    const index = line.indexOf(arrow);
    if (index !== -1 && (best === null || index < best.index)) best = { index, arrow };
  }
  return best;
}

function stripComment(line: string): string {
  if (line.trimStart().startsWith("#")) return "";
  // `//` starts a comment unless it is inside quotes.
  let quote: string | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if ((c === "'" || c === '"') && line.indexOf(c, i + 1) > i + 1) {
      quote = c;
    } else if (c === "/" && line[i + 1] === "/") {
      return line.slice(0, i);
    }
  }
  return line;
}

export function parseGrammar(source: string, options: ParseOptions = {}): GrammarParseResult {
  const diagnostics: Diagnostic[] = [];
  const err = (line: number, code: string, message: string, hint?: string) =>
    diagnostics.push({ severity: "error", line, code, message, hint });
  const warn = (line: number, code: string, message: string, hint?: string) =>
    diagnostics.push({ severity: "warning", line, code, message, hint });

  const rules: { lhs: string; line: number; alternatives: RawAlternative[] }[] = [];
  const declaredTerminals: string[] = [];
  const declaredTerminalLine = new Map<string, number>();
  const quotedTerminals = new Set<string>();
  let directiveStart: { symbol: string; line: number } | null = null;
  let current: (typeof rules)[number] | null = null;

  const lines = source.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = stripComment(rawLine).trim();
    if (!line) return;

    if (line.startsWith("%")) {
      const [directive, ...args] = line.split(/\s+/);
      if (directive === "%token" || directive === "%term" || directive === "%terminal") {
        if (args.length === 0) warn(lineNo, "empty-directive", "%token declares no symbols.");
        for (const a of args) {
          if (!declaredTerminalLine.has(a)) {
            declaredTerminals.push(a);
            declaredTerminalLine.set(a, lineNo);
          }
        }
      } else if (directive === "%start") {
        if (args.length !== 1) err(lineNo, "bad-start", "%start expects exactly one symbol.");
        else directiveStart = { symbol: args[0], line: lineNo };
      } else {
        err(lineNo, "unknown-directive", `Unknown directive ${directive}.`, "Supported directives: %token, %start.");
      }
      return;
    }

    let lhs: string | null = null;
    let body: string;
    if (line.startsWith("|")) {
      if (!current) {
        err(lineNo, "orphan-alternative", "This line starts with `|` but there is no rule above it to continue.");
        return;
      }
      body = line;
    } else {
      const arrow = findArrow(line);
      if (!arrow) {
        err(
          lineNo,
          "missing-arrow",
          `Expected a production of the form "A -> α", found "${line}".`,
          "Separate the left-hand side from the body with ->, → or ::=",
        );
        current = null;
        return;
      }
      const head = line.slice(0, arrow.index).trim();
      body = line.slice(arrow.index + arrow.arrow.length);
      const headTokens = head.split(/\s+/).filter(Boolean);
      if (headTokens.length !== 1) {
        err(
          lineNo,
          "bad-lhs",
          headTokens.length === 0
            ? "Missing left-hand side before the arrow."
            : `The left-hand side must be a single nonterminal, found "${head}".`,
          "Context-free productions have exactly one nonterminal on the left.",
        );
        current = null;
        return;
      }
      lhs = headTokens[0];
      if (/^['"].*['"]$/.test(lhs) && lhs.length > 2) {
        err(lineNo, "quoted-lhs", `Quoted symbol ${lhs} cannot be a nonterminal.`);
        current = null;
        return;
      }
      if (EPSILON_SPELLINGS.has(lhs)) {
        err(lineNo, "epsilon-lhs", "ε cannot appear on the left-hand side.");
        current = null;
        return;
      }
      if (lhs === END) {
        err(lineNo, "reserved-symbol", "`$` is reserved for the end-of-input marker.");
        current = null;
        return;
      }
      current = { lhs, line: lineNo, alternatives: [] };
      rules.push(current);
    }

    const { tokens, error } = lexRuleBody(body);
    if (error) {
      err(lineNo, "lex-error", error);
      return;
    }
    // Split on bars. A leading bar on continuation lines yields an empty first chunk we skip.
    const chunks: RawToken[][] = [[]];
    for (const t of tokens) {
      if (t.bar) chunks.push([]);
      else chunks[chunks.length - 1].push(t);
    }
    if (line.startsWith("|")) chunks.shift();
    chunks.forEach((chunk, k) => {
      if (chunk.length === 0) {
        err(
          lineNo,
          "empty-alternative",
          k === 0 && chunks.length === 1 ? "The rule has an empty body." : "Empty alternative between `|` separators.",
          "Write ε (or `eps`) explicitly for an empty production.",
        );
        return;
      }
      current!.alternatives.push({ line: lineNo, symbols: chunk });
    });
  });

  if (rules.length === 0) {
    if (!diagnostics.some((d) => d.severity === "error")) {
      err(0, "empty-grammar", "The grammar has no productions.", "Add at least one rule, e.g. S -> a S | b");
    }
    return { grammar: null, diagnostics, declaredTerminals };
  }

  const nonterminalOrder: string[] = [];
  const nonterminalSet = new Set<string>();
  for (const r of rules) {
    if (!nonterminalSet.has(r.lhs)) {
      nonterminalSet.add(r.lhs);
      nonterminalOrder.push(r.lhs);
    }
  }

  for (const t of declaredTerminals) {
    if (nonterminalSet.has(t)) {
      err(
        declaredTerminalLine.get(t) ?? 0,
        "terminal-redefined",
        `"${t}" is declared with %token but also has productions.`,
        "A symbol cannot be both a terminal and a nonterminal.",
      );
    }
    if (t === END || EPSILON_SPELLINGS.has(t)) {
      err(declaredTerminalLine.get(t) ?? 0, "reserved-symbol", `"${t}" is reserved and cannot be declared as a token.`);
    }
  }

  // Build productions.
  const userProductions: Omit<Production, "id">[] = [];
  const seen = new Map<string, number>();
  for (const r of rules) {
    for (const alt of r.alternatives) {
      const rhs: string[] = [];
      let sawEps = false;
      let bad = false;
      for (const tok of alt.symbols) {
        if (!tok.quoted && EPSILON_SPELLINGS.has(tok.text)) {
          sawEps = true;
          continue;
        }
        if (tok.text === END) {
          err(alt.line, "reserved-symbol", "`$` is reserved for the end-of-input marker and cannot be used in a production.");
          bad = true;
          continue;
        }
        if (tok.quoted) {
          if (tok.text.length === 0) {
            err(alt.line, "empty-literal", "Empty quoted literal; use ε for the empty string.");
            bad = true;
            continue;
          }
          if (nonterminalSet.has(tok.text)) {
            err(
              alt.line,
              "literal-collision",
              `Quoted terminal '${tok.text}' has the same name as the nonterminal ${tok.text}.`,
              "Rename the nonterminal or the terminal.",
            );
            bad = true;
            continue;
          }
          quotedTerminals.add(tok.text);
        }
        rhs.push(tok.text);
      }
      if (bad) continue;
      if (sawEps && rhs.length > 0) {
        warn(
          alt.line,
          "epsilon-mixed",
          `ε appears together with other symbols in "${r.lhs} → ${alt.symbols.map((s) => s.text).join(" ")}"; it was ignored.`,
          "ε denotes the empty string and is only meaningful on its own.",
        );
      }
      const key = `${r.lhs}\u0000${rhs.join("\u0001")}`;
      if (seen.has(key)) {
        warn(
          alt.line,
          "duplicate-production",
          `Duplicate production ${r.lhs} → ${rhs.length ? rhs.join(" ") : "ε"} (first defined on line ${seen.get(key)}); the copy was ignored.`,
          "Duplicate productions always cause reduce-reduce conflicts, so they are removed.",
        );
        continue;
      }
      seen.set(key, alt.line);
      userProductions.push({ lhs: r.lhs, rhs, line: alt.line });
    }
  }

  // Start symbol.
  let start = rules[0].lhs;
  const ds = directiveStart as { symbol: string; line: number } | null;
  if (ds) {
    if (!nonterminalSet.has(ds.symbol)) {
      err(ds.line, "bad-start", `%start symbol "${ds.symbol}" has no productions.`);
    } else start = ds.symbol;
  }
  if (options.startOverride) {
    if (!nonterminalSet.has(options.startOverride)) {
      err(0, "bad-start", `Selected start symbol "${options.startOverride}" is not a nonterminal of this grammar.`);
    } else start = options.startOverride;
  }

  // Terminals in first-appearance order.
  const terminals: string[] = [];
  const terminalSet = new Set<string>();
  for (const p of userProductions) {
    for (const s of p.rhs) {
      if (!nonterminalSet.has(s) && !terminalSet.has(s)) {
        terminalSet.add(s);
        terminals.push(s);
      }
    }
  }

  // Fresh augmented start symbol.
  let augmentedStart = `${start}'`;
  while (nonterminalSet.has(augmentedStart) || terminalSet.has(augmentedStart)) augmentedStart += "'";

  const productions: Production[] = [
    { id: 0, lhs: augmentedStart, rhs: [start], line: 0 },
    ...userProductions.map((p, i) => ({ ...p, id: i + 1 })),
  ];

  const grammar: Grammar = {
    productions,
    nonterminals: [augmentedStart, ...nonterminalOrder],
    terminals,
    start,
    augmentedStart,
  };

  if (userProductions.length === 0) {
    err(0, "empty-grammar", "No valid productions remain after removing invalid ones.");
  }

  diagnostics.push(...validateGrammar(grammar, { declaredTerminals, quotedTerminals }));
  diagnostics.sort((a, b) => a.line - b.line || severityRank(a.severity) - severityRank(b.severity));

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  return { grammar: hasErrors ? null : grammar, diagnostics, declaredTerminals };
}

function severityRank(s: Diagnostic["severity"]): number {
  return s === "error" ? 0 : s === "warning" ? 1 : 2;
}

/** Formats a production body; ε for empty right-hand sides. */
export function formatRhs(rhs: string[]): string {
  return rhs.length === 0 ? EPS : rhs.join(" ");
}

export function formatProduction(p: Production): string {
  return `${p.lhs} → ${formatRhs(p.rhs)}`;
}

/** Serialises a grammar back to the editor notation (one line per nonterminal). */
export function grammarToText(g: Grammar): string {
  const lines: string[] = [];
  for (const nt of g.nonterminals) {
    if (nt === g.augmentedStart) continue;
    const alts = g.productions.filter((p) => p.lhs === nt && p.id !== 0).map((p) => formatRhs(p.rhs));
    if (alts.length) lines.push(`${nt} -> ${alts.join(" | ")}`);
  }
  return lines.join("\n");
}
