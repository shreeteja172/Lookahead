import { describe, expect, it } from "vitest";
import { analyzeGrammar, simulate, tokenizeInput } from "@/lib/engine";
import { decodeSnapshot, encodeSnapshot } from "../share";
import { buildReport, tableToCSV, tableToJSON, traceToCSV } from "../export";

const EXPR = "E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id";

describe("shareable snapshots", () => {
  it("round-trips unicode grammars", () => {
    const snap = { name: "Ünïcode ε", source: "S → a S | ε", input: "a a", start: "", policy: "prefer-shift" as const };
    expect(decodeSnapshot(encodeSnapshot(snap))).toEqual({ v: 1, ...snap });
  });

  it("rejects malformed, oversized or wrongly typed payloads", () => {
    expect(decodeSnapshot("not base64!")).toBeNull();
    expect(decodeSnapshot("")).toBeNull();
    expect(decodeSnapshot("a".repeat(70_000))).toBeNull();
    const bad = Buffer.from(JSON.stringify({ v: 1, name: 3, source: "S -> a" })).toString("base64url");
    expect(decodeSnapshot(bad)).toBeNull();
    const wrongVersion = Buffer.from(JSON.stringify({ v: 2, name: "x", source: "S -> a" })).toString("base64url");
    expect(decodeSnapshot(wrongVersion)).toBeNull();
  });

  it("ignores unknown fields and normalises the policy", () => {
    const extra = Buffer.from(JSON.stringify({ v: 1, name: "x", source: "S -> a", policy: "evil", __proto__: { polluted: true }, run: "alert(1)" })).toString(
      "base64url",
    );
    const snap = decodeSnapshot(extra)!;
    expect(snap).toEqual({ v: 1, name: "x", source: "S -> a", input: "", start: "", policy: "halt" });
    expect(Object.keys(snap)).not.toContain("run");
  });
});

describe("exports contain generated data", () => {
  const a = analyzeGrammar(EXPR).analysis!;

  it("CSV has one row per state with the real cells", () => {
    const csv = tableToCSV(a.tables.SLR).split("\n");
    expect(csv).toHaveLength(13);
    expect(csv[0]).toBe("State,ACTION +,ACTION *,ACTION (,ACTION ),ACTION id,ACTION $,GOTO E,GOTO T,GOTO F");
    expect(csv[3]).toBe("2,r2,s7,,r2,,r2,,,");
  });

  it("JSON includes productions, items, actions with reasons and stats", () => {
    const j = tableToJSON(a, a.tables.LALR);
    expect(j.productions).toHaveLength(7);
    expect(j.states).toHaveLength(12);
    expect(j.states[1].action.$[0].text).toBe("acc");
    expect(j.states[2].action["+"][0].reason).toMatch(/reduce by production 2/);
    expect(j.stats.conflictFree).toBe(true);
  });

  it("trace CSV records every step and the outcome", () => {
    const tokens = tokenizeInput("id + id", a.grammar.terminals).tokens;
    const r = simulate(a.grammar, a.tables.CLR, tokens);
    const lines = traceToCSV(r).split("\n");
    expect(lines.length).toBe(r.steps.length + 3);
    expect(lines[lines.length - 1]).toMatch(/^Outcome,accepted/);
  });

  it("the report includes every table and the FIRST/FOLLOW sets", () => {
    const md = buildReport(a, { name: "Expr", source: EXPR, diagnostics: [] });
    for (const h of ["## SLR parsing table", "## CLR parsing table", "## LALR parsing table", "## FIRST and FOLLOW"]) expect(md).toContain(h);
    expect(md).toContain("| E | no | { (, id } | { +, ), $ } |");
  });
});
