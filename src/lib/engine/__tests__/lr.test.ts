import { describe, expect, it } from "vitest";
import { parseGrammar } from "../grammar-parser";
import { computeFirstFollow } from "../first-follow";
import { closureLR0, gotoKernel } from "../lr0-items";
import { closureLR1 } from "../lr1-items";
import { formatItem } from "../items";
import { buildCanonicalCollection, StateExplosionError } from "../automaton";
import { analyzeGrammar } from "../analysis";
import { tableStats } from "../table-builder";
import { analyze, row } from "./helpers";
import { END } from "../types";

const EXPR = "E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id";
const CC = "S -> C C\nC -> c C | d";
const LVALUE = "S -> L = R | R\nL -> * R | id\nR -> L";
const NOT_LALR = "S -> a A d | b B d | a B e | b A e\nA -> c\nB -> c";

describe("LR(0) closure and goto", () => {
  const g = parseGrammar(EXPR).grammar!;

  it("CLOSURE({E' → ·E}) is the textbook I0 in textbook order", () => {
    const { items } = closureLR0(g, [{ prod: 0, dot: 0, lookaheads: [], kernel: true }]);
    expect(items.map((i) => formatItem(g, i))).toEqual([
      "E' → · E",
      "E → · E + T",
      "E → · T",
      "T → · T * F",
      "T → · F",
      "F → · ( E )",
      "F → · id",
    ]);
  });

  it("GOTO(I0, E) has the two kernel items of I1", () => {
    const { items } = closureLR0(g, [{ prod: 0, dot: 0, lookaheads: [], kernel: true }]);
    expect(gotoKernel(g, items, "E").map((i) => formatItem(g, i))).toEqual(["E' → E ·", "E → E · + T"]);
  });
});

describe("LR(1) closure", () => {
  it("computes lookaheads with FIRST(βa) (Dragon book I0 for S → CC)", () => {
    const g = parseGrammar(CC).grammar!;
    const ff = computeFirstFollow(g);
    const { items } = closureLR1(g, [{ prod: 0, dot: 0, lookaheads: [END], kernel: true }], ff);
    expect(items.map((i) => formatItem(g, i))).toEqual([
      "S' → · S, $",
      "S → · C C, $",
      "C → · c C, c / d",
      "C → · d, c / d",
    ]);
  });

  it("propagates lookaheads that arrive later to existing cores", () => {
    // A → ·A a gets lookahead `a` from itself (left recursion) and `$` from S → ·A.
    const g = parseGrammar("S -> A\nA -> A a | b").grammar!;
    const ff = computeFirstFollow(g);
    const { items } = closureLR1(g, [{ prod: 0, dot: 0, lookaheads: [END], kernel: true }], ff);
    expect(items.map((i) => formatItem(g, i))).toEqual(["S' → · S, $", "S → · A, $", "A → · A a, a / $", "A → · b, a / $"]);
  });

  it("passes the parent's lookahead through nullable suffixes", () => {
    const g = parseGrammar("S -> A B\nA -> a\nB -> b | ε").grammar!;
    const ff = computeFirstFollow(g);
    const { items } = closureLR1(g, [{ prod: 0, dot: 0, lookaheads: [END], kernel: true }], ff);
    expect(items.map((i) => formatItem(g, i))).toContain("A → · a, b / $");
  });
});

describe("SLR(1) — Dragon book Fig. 4.37", () => {
  const a = analyze(EXPR);
  const t = a.tables.SLR;

  it("has 12 states and no conflicts", () => {
    expect(a.lr0.states).toHaveLength(12);
    expect(t.conflicts).toEqual([]);
  });

  it("reproduces the textbook ACTION/GOTO table exactly", () => {
    expect([...Array(12).keys()].map((s) => row(t, s))).toEqual([
      "(:s4 id:s5 E:1 T:2 F:3",
      "+:s6 $:acc",
      "+:r2 *:s7 ):r2 $:r2",
      "+:r4 *:r4 ):r4 $:r4",
      "(:s4 id:s5 E:8 T:2 F:3",
      "+:r6 *:r6 ):r6 $:r6",
      "(:s4 id:s5 T:9 F:3",
      "(:s4 id:s5 F:10",
      "+:s6 ):s11",
      "+:r1 *:s7 ):r1 $:r1",
      "+:r3 *:r3 ):r3 $:r3",
      "+:r5 *:r5 ):r5 $:r5",
    ]);
  });
});

describe("CLR(1) and LALR(1) — Dragon book S → C C", () => {
  const a = analyze(CC);

  it("canonical LR(1) has the textbook 10 states I0–I9", () => {
    expect(a.lr1.states).toHaveLength(10);
    expect([...Array(10).keys()].map((s) => row(a.tables.CLR, s))).toEqual([
      "c:s3 d:s4 S:1 C:2",
      "$:acc",
      "c:s6 d:s7 C:5",
      "c:s3 d:s4 C:8",
      "c:r3 d:r3",
      "$:r1",
      "c:s6 d:s7 C:9",
      "$:r3",
      "c:r2 d:r2",
      "$:r2",
    ]);
  });

  it("LALR merges (3,6), (4,7), (8,9) into 7 states with united lookaheads", () => {
    expect(a.lalr.states).toHaveLength(7);
    expect(a.mergeGroups.map((g) => g.clrStates)).toEqual([[0], [1], [2], [3, 6], [4, 7], [5], [8, 9]]);
    expect([...Array(7).keys()].map((s) => row(a.tables.LALR, s))).toEqual([
      "c:s3 d:s4 S:1 C:2",
      "$:acc",
      "c:s3 d:s4 C:5",
      "c:s3 d:s4 C:6",
      "c:r3 d:r3 $:r3",
      "$:r1",
      "c:r2 d:r2 $:r2",
    ]);
  });

  it("LALR cores coincide with the LR(0) states", () => {
    const lr0Cores = new Set(a.lr0.states.map((s) => s.coreKey));
    expect(new Set(a.lalr.states.map((s) => s.coreKey))).toEqual(lr0Cores);
  });
});

describe("grammar classes", () => {
  it("L = R is LR(1) and LALR(1) but not SLR(1)", () => {
    const a = analyze(LVALUE);
    expect(a.lr0.states).toHaveLength(10);
    expect(a.lr1.states).toHaveLength(14);
    expect(a.lalr.states).toHaveLength(10);
    expect(a.tables.SLR.conflicts.map((c) => [c.state, c.terminal, c.type])).toEqual([[2, "=", "shift-reduce"]]);
    expect(a.tables.CLR.conflicts).toEqual([]);
    expect(a.tables.LALR.conflicts).toEqual([]);
  });

  it("the a A d / b B d grammar is LR(1) but LALR merging creates reduce-reduce conflicts", () => {
    const a = analyze(NOT_LALR);
    expect(a.tables.CLR.conflicts).toEqual([]);
    const lalr = a.tables.LALR.conflicts;
    expect(lalr.map((c) => [c.terminal, c.type])).toEqual([
      ["d", "reduce-reduce"],
      ["e", "reduce-reduce"],
    ]);
    expect(a.lalr.states[lalr[0].state].mergedFrom!.length).toBe(2);
    const diag = a.diagnoses.filter((d) => d.conflict.method === "LALR");
    expect(diag.every((d) => d.introducedByMerge)).toBe(true);
    expect(a.lalr.states.length).toBeLessThan(a.lr1.states.length);
  });

  it("ambiguous grammars conflict under every construction", () => {
    const a = analyze("E -> E + E | E * E | ( E ) | id");
    for (const m of ["SLR", "CLR", "LALR"] as const) {
      expect(a.tables[m].conflicts.length).toBeGreaterThan(0);
      expect(a.tables[m].conflicts.every((c) => c.type === "shift-reduce")).toBe(true);
    }
    const d = a.diagnoses.find((x) => x.conflict.method === "CLR")!;
    expect(d.likelyCause).toMatch(/ambiguous/);
  });

  it("recognises ambiguous concatenation A → A A", () => {
    const a = analyze("S -> id ; | S S");
    for (const m of ["SLR", "CLR", "LALR"] as const) expect(a.tables[m].conflicts.length).toBeGreaterThan(0);
    const d = a.diagnoses.find((x) => x.conflict.method === "CLR")!;
    expect(d.likelyCause).toMatch(/\(S S\) S or S \(S S\)/);
  });

  it("detects the dangling-else pattern", () => {
    const a = analyze("S -> i S e S | i S | a");
    const d = a.diagnoses.find((x) => x.conflict.method === "LALR")!;
    expect(d.conflict.terminal).toBe("e");
    expect(d.likelyCause).toMatch(/dangling-else/);
    expect(d.alsoIn.map((x) => x.method).sort()).toEqual(["CLR", "SLR"]);
  });

  it("explains SLR-only conflicts via FOLLOW", () => {
    const a = analyze(LVALUE);
    const d = a.diagnoses.find((x) => x.conflict.method === "SLR")!;
    expect(d.alsoIn).toEqual([]);
    expect(d.explanation.join(" ")).toMatch(/= ∈ FOLLOW\(R\)/);
    expect(d.likelyCause).toMatch(/FOLLOW sets are too coarse/);
  });

  it("uses one production numbering across all three tables", () => {
    const a = analyze(EXPR);
    const prods = (m: "SLR" | "CLR" | "LALR") => {
      const s = new Set<number>();
      a.tables[m].action.forEach((r) => r.forEach((es) => es.forEach((e) => e.action.type === "reduce" && s.add(e.action.prod))));
      return [...s].sort();
    };
    expect(prods("SLR")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(prods("CLR")).toEqual(prods("SLR"));
    expect(prods("LALR")).toEqual(prods("SLR"));
  });

  it("CLR for the expression grammar is larger than LALR, which equals SLR in size", () => {
    const a = analyze(EXPR);
    expect(a.lalr.states).toHaveLength(12);
    expect(a.lr1.states.length).toBeGreaterThan(12);
    expect(tableStats(a.tables.LALR).conflictFree).toBe(true);
  });
});

describe("safeguards", () => {
  it("stops canonical construction above the state limit", () => {
    const g = parseGrammar(EXPR).grammar!;
    expect(() => buildCanonicalCollection(g, "LR1", computeFirstFollow(g), 5)).toThrow(StateExplosionError);
    expect(analyzeGrammar(EXPR, { maxStates: 5 }).error).toMatch(/exceeded 5 states/);
  });
});
