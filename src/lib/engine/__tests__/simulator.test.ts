import { describe, expect, it } from "vitest";
import { simulate, tokenizeInput } from "../parser-simulator";
import { compareParsers } from "../comparison-engine";
import { SAMPLES } from "../samples";
import { METHODS } from "../analysis";
import { analyze, run } from "./helpers";

const EXPR = "E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id";

describe("tokenizer", () => {
  const terms = ["id", "+", "*", "(", ")", "num", "=="];
  it("accepts spaced and unspaced input with longest match", () => {
    expect(tokenizeInput("id + id * id", terms).tokens).toEqual(["id", "+", "id", "*", "id"]);
    expect(tokenizeInput("(id+num)*id", terms).tokens).toEqual(["(", "id", "+", "num", ")", "*", "id"]);
    expect(tokenizeInput("id==id", terms).tokens).toEqual(["id", "==", "id"]);
    expect(tokenizeInput("id $", terms).tokens).toEqual(["id"]);
  });
  it("reports invalid tokens with their position", () => {
    const r = tokenizeInput("id + x", terms);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ token: "x", position: 5 });
  });
});

describe("shift-reduce simulation", () => {
  const a = analyze(EXPR);

  it("parses id * id + id exactly like Dragon book Fig. 4.38", () => {
    const r = run(a, "SLR", "id * id + id");
    expect(r.outcome).toBe("accepted");
    const fmt = r.steps.map(
      (s) =>
        `${s.stack.map((e) => (e.symbol ? `${e.symbol} ${e.state}` : `${e.state}`)).join(" ")} | ${s.remaining.join(" ")} | ${s.kind === "shift" ? `s${(s.actions[0] as { state: number }).state}` : s.kind === "reduce" ? `r${(s.actions[0] as { prod: number }).prod}` : s.kind}`,
    );
    expect(fmt).toEqual([
      "0 | id * id + id $ | s5",
      "0 id 5 | * id + id $ | r6",
      "0 F 3 | * id + id $ | r4",
      "0 T 2 | * id + id $ | s7",
      "0 T 2 * 7 | id + id $ | s5",
      "0 T 2 * 7 id 5 | + id $ | r6",
      "0 T 2 * 7 F 10 | + id $ | r3",
      "0 T 2 | + id $ | r2",
      "0 E 1 | + id $ | s6",
      "0 E 1 + 6 | id $ | s5",
      "0 E 1 + 6 id 5 | $ | r6",
      "0 E 1 + 6 F 3 | $ | r4",
      "0 E 1 + 6 T 9 | $ | r1",
      "0 E 1 | $ | accept",
    ]);
    expect(r.tree?.symbol).toBe("E");
    expect(r.tree?.children.map((c) => c.symbol)).toEqual(["E", "+", "T"]);
  });

  it("rejects malformed input with the expected terminals", () => {
    const r = run(a, "LALR", "id + * id");
    expect(r.outcome).toBe("rejected");
    expect(r.steps[r.steps.length - 1].kind).toBe("error");
    expect(r.message).toMatch(/expects \(, id/);
  });

  it("rejects empty input for a non-nullable start symbol, accepts it for a nullable one", () => {
    expect(run(a, "CLR", "").outcome).toBe("rejected");
    const b = analyze("S -> ( S ) S | ε");
    expect(run(b, "SLR", "").outcome).toBe("accepted");
    expect(run(b, "CLR", "( ( ) ) ( )").outcome).toBe("accepted");
  });

  it("refuses tokens that are not terminals", () => {
    const r = simulate(a.grammar, a.tables.SLR, ["id", "+", "x"]);
    expect(r.outcome).toBe("invalid-input");
    expect(r.steps).toEqual([]);
  });

  it("halts on conflicts by default and resolves them with prefer-shift", () => {
    const d = analyze("S -> if C then S else S | if C then S | other\nC -> cond");
    const input = "if cond then if cond then other else other";
    expect(run(d, "LALR", input).outcome).toBe("conflict");
    const r = run(d, "LALR", input, "prefer-shift");
    expect(r.outcome).toBe("accepted");
    // else binds to the inner if: the root is the short form `if C then S`.
    expect(r.tree!.children.map((c) => c.symbol)).toEqual(["if", "C", "then", "S"]);
  });

  it("guards against non-terminating parses with a step limit", () => {
    // S → S is cyclic: reduce S → S on $ forever unless the step limit stops it.
    const c = analyze("S -> S | a");
    const r = simulate(c.grammar, c.tables.SLR, ["a"], { policy: "prefer-shift", maxSteps: 50 });
    expect(["step-limit", "accepted"]).toContain(r.outcome);
    expect(r.steps.length).toBeLessThanOrEqual(50);
  });

  it("CLR detects errors no later than LALR/SLR, which may perform extra reductions", () => {
    const b = analyze("S -> C C\nC -> c C | d");
    const cmp = compareParsers(b, ["c", "d"]);
    for (const m of METHODS) expect(cmp.sims![m].outcome).toBe("rejected");
    expect(cmp.sims!.CLR.steps.length).toBeLessThanOrEqual(cmp.sims!.LALR.steps.length);
  });
});

describe("comparison engine", () => {
  it("finds the SLR cells that LALR does not have for L = R", () => {
    const a = analyze("S -> L = R | R\nL -> * R | id\nR -> L");
    const cmp = compareParsers(a, ["id", "=", "id"]);
    expect(cmp.stats.SLR.shiftReduce).toBe(1);
    expect(cmp.stats.LALR.conflictFree).toBe(true);
    expect(cmp.slrVsLalr.some((d) => d.symbol === "=" && d.left.length === 2 && d.right.length === 1)).toBe(true);
    for (const m of ["CLR", "LALR"] as const) expect(cmp.sims![m].outcome).toBe("accepted");
    expect(cmp.sims!.SLR.outcome).toBe("conflict");
  });

  it("maps CLR states onto LALR states (S → C C has no semantic differences besides lookahead unions)", () => {
    const a = analyze("S -> C C\nC -> c C | d");
    const cmp = compareParsers(a, null);
    expect(cmp.clrVsLalr.length).toBeGreaterThan(0);
    // Every difference is an extra reduce in LALR coming from a merged sibling.
    expect(cmp.clrVsLalr.every((d) => d.left.length === 0 && d.right[0].startsWith("r"))).toBe(true);
  });
});

describe("sample grammars are verified against the implementation", () => {
  for (const s of SAMPLES) {
    describe(s.title, () => {
      const a = analyze(s.source);
      it("has the claimed conflict-freedom for each construction", () => {
        for (const m of METHODS) expect({ m, free: a.tables[m].conflicts.length === 0 }).toEqual({ m, free: s.conflictFree[m] });
      });
      if (s.states) {
        it("has the claimed state counts", () => {
          if (s.states!.LR0 !== undefined) expect(a.lr0.states).toHaveLength(s.states!.LR0);
          if (s.states!.LR1 !== undefined) expect(a.lr1.states).toHaveLength(s.states!.LR1);
          if (s.states!.LALR1 !== undefined) expect(a.lalr.states).toHaveLength(s.states!.LALR1);
        });
      }
      it("accepts and rejects the sample inputs as documented", () => {
        for (const input of s.inputs) {
          for (const m of METHODS) {
            if (!s.conflictFree[m] && !input.note?.includes("prefer-shift")) continue;
            const r = run(a, m, input.text, s.conflictFree[m] ? "halt" : "prefer-shift");
            expect({ input: input.text, m, outcome: r.outcome }).toEqual({
              input: input.text,
              m,
              outcome: input.accept ? "accepted" : "rejected",
            });
          }
        }
      });
    });
  }
});
