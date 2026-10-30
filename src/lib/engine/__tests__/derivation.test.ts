import { describe, expect, it } from "vitest";
import { rightmostDerivation } from "../derivation";
import { analyze, run } from "./helpers";

const fmt = (forms: { form: string[] }[]) => forms.map((f) => f.form.join(" ") || "ε");

describe("rightmost derivation from an LR parse", () => {
  it("reverses the reductions of id * id + id (Dragon book)", () => {
    const a = analyze("E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id");
    const d = rightmostDerivation(a.grammar, run(a, "LALR", "id * id + id"))!;
    expect(fmt(d)).toEqual([
      "E",
      "E + T",
      "E + F",
      "E + id",
      "T + id",
      "T * F + id",
      "T * id + id",
      "F * id + id",
      "id * id + id",
    ]);
    // Each line rewrites its rightmost nonterminal.
    for (const step of d.slice(0, -1)) {
      const nts = step.form.map((s, i) => (a.grammar.nonterminals.includes(s) ? i : -1)).filter((i) => i >= 0);
      expect(step.rewrite).toBe(nts[nts.length - 1]);
    }
  });

  it("handles ε-productions and empty input", () => {
    const a = analyze("S -> ( S ) S | ε");
    expect(fmt(rightmostDerivation(a.grammar, run(a, "SLR", ""))!)).toEqual(["S", "ε"]);
    expect(fmt(rightmostDerivation(a.grammar, run(a, "CLR", "( )"))!)).toEqual(["S", "( S ) S", "( S )", "( )"]);
  });

  it("returns null for rejected input", () => {
    const a = analyze("S -> a");
    expect(rightmostDerivation(a.grammar, run(a, "SLR", "a a"))).toBeNull();
  });
});
