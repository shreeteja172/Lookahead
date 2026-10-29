import { describe, expect, it } from "vitest";
import { lexRuleBody, parseGrammar } from "../grammar-parser";
import { findUnproductive, findUnreachable } from "../grammar-validator";

const codes = (src: string) => parseGrammar(src).diagnostics.map((d) => d.code);

describe("grammar tokenization", () => {
  it("splits on whitespace and bare bars, honouring quotes", () => {
    const { tokens } = lexRuleBody(" E '+' T|'|' x");
    expect(tokens.map((t) => (t.bar ? "|" : t.quoted ? `q:${t.text}` : t.text))).toEqual(["E", "q:+", "T", "|", "q:|", "x"]);
  });

  it("keeps primes in symbol names", () => {
    const { tokens } = lexRuleBody("T E' | ε");
    expect(tokens.map((t) => t.text)).toEqual(["T", "E'", "|", "ε"]);
  });
});

describe("parseGrammar", () => {
  it("parses the expression grammar with augmented production 0", () => {
    const { grammar, diagnostics } = parseGrammar("E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id");
    expect(diagnostics).toEqual([]);
    expect(grammar!.start).toBe("E");
    expect(grammar!.augmentedStart).toBe("E'");
    expect(grammar!.productions.map((p) => `${p.id}:${p.lhs}->${p.rhs.join(" ")}`)).toEqual([
      "0:E'->E",
      "1:E->E + T",
      "2:E->T",
      "3:T->T * F",
      "4:T->F",
      "5:F->( E )",
      "6:F->id",
    ]);
    expect(grammar!.terminals).toEqual(["+", "*", "(", ")", "id"]);
    expect(grammar!.nonterminals).toEqual(["E'", "E", "T", "F"]);
  });

  it("accepts all arrow spellings, continuation lines, comments and epsilon spellings", () => {
    const { grammar, diagnostics } = parseGrammar(`
      # comment line
      S ::= A b   // trailing comment
          | ε
      A → a | eps
      B -> epsilon`.replace("B -> epsilon", "A -> λ"));
    expect(diagnostics.filter((d) => d.severity !== "info").map((d) => d.code)).toEqual(["duplicate-production"]);
    expect(grammar!.productions.slice(1).map((p) => `${p.lhs}->${p.rhs.join(" ") || "ε"}`)).toEqual([
      "S->A b",
      "S->ε",
      "A->a",
      "A->ε",
    ]);
  });

  it("picks a fresh augmented start symbol when S' is taken", () => {
    const { grammar } = parseGrammar("E -> T E'\nE' -> + T E' | ε\nT -> id");
    expect(grammar!.augmentedStart).toBe("E''");
  });

  it("supports start override and %start", () => {
    expect(parseGrammar("S -> A\nA -> a", { startOverride: "A" }).grammar!.start).toBe("A");
    expect(parseGrammar("%start A\nS -> A\nA -> a").grammar!.start).toBe("A");
    expect(codes("S -> a")).toEqual([]);
    expect(parseGrammar("S -> a", { startOverride: "X" }).grammar).toBeNull();
  });

  it("reports malformed rules with line numbers", () => {
    const r = parseGrammar("S -> a\nthis is wrong\nA B -> c\n| d");
    expect(r.grammar).toBeNull();
    const byLine = r.diagnostics.filter((d) => d.severity === "error").map((d) => [d.line, d.code]);
    expect(byLine).toEqual([
      [2, "missing-arrow"],
      [3, "bad-lhs"],
      [4, "orphan-alternative"],
    ]);
  });

  it("rejects empty alternatives, $ and empty grammars", () => {
    expect(codes("S -> a | | b")).toContain("empty-alternative");
    expect(codes("S -> a $")).toContain("reserved-symbol");
    expect(codes("   \n // nothing")).toContain("empty-grammar");
  });

  it("warns about duplicate productions and drops them", () => {
    const r = parseGrammar("S -> a | a");
    expect(r.diagnostics.map((d) => d.code)).toEqual(["duplicate-production"]);
    expect(r.grammar!.productions).toHaveLength(2);
  });

  it("warns about symbols written without spaces", () => {
    const r = parseGrammar("S -> CC\nC -> cC | d");
    const d = r.diagnostics.filter((x) => x.code === "concatenated-symbols");
    expect(d.map((x) => x.message)).toEqual([
      expect.stringContaining("C C"),
      expect.stringContaining("c C"),
    ]);
  });

  it("warns about undefined capitalised symbols but respects %token", () => {
    expect(codes("S -> X a")).toContain("undefined-nonterminal");
    expect(codes("%token X\nS -> X a")).not.toContain("undefined-nonterminal");
    expect(codes("%token S\nS -> a")).toContain("terminal-redefined");
  });

  it("detects unreachable and non-generating nonterminals", () => {
    const { grammar, diagnostics } = parseGrammar("S -> a | B\nB -> b B\nC -> c");
    expect(findUnreachable(grammar!)).toEqual(["C"]);
    expect(findUnproductive(grammar!)).toEqual(["B"]);
    expect(diagnostics.map((d) => d.code).sort()).toEqual(["unproductive", "unreachable"]);
  });

  it("warns when ε is mixed with other symbols", () => {
    const r = parseGrammar("S -> a ε b");
    expect(r.diagnostics.map((d) => d.code)).toEqual(["epsilon-mixed"]);
    expect(r.grammar!.productions[1].rhs).toEqual(["a", "b"]);
  });
});
