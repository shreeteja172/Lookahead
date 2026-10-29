import { describe, expect, it } from "vitest";
import { parseGrammar } from "../grammar-parser";
import { computeFirstFollow, firstOfSequence, sortSymbols } from "../first-follow";
import { EPS } from "../types";

function ff(src: string) {
  const g = parseGrammar(src).grammar!;
  const r = computeFirstFollow(g);
  const fmt = (m: Map<string, Set<string>>, k: string) => sortSymbols(m.get(k)!, g.terminals).join(" ");
  return { g, r, first: (k: string) => fmt(r.first, k), follow: (k: string) => fmt(r.follow, k) };
}

describe("FIRST and FOLLOW", () => {
  it("matches the Dragon book for the LL expression grammar (Example 4.30)", () => {
    const { first, follow, r } = ff(`E -> T E'
E' -> + T E' | ε
T -> F T'
T' -> * F T' | ε
F -> ( E ) | id`);
    expect(first("E")).toBe("( id");
    expect(first("T")).toBe("( id");
    expect(first("F")).toBe("( id");
    expect(first("E'")).toBe(`+ ${EPS}`);
    expect(first("T'")).toBe(`* ${EPS}`);
    expect(follow("E")).toBe(") $");
    expect(follow("E'")).toBe(") $");
    expect(follow("T")).toBe("+ ) $");
    expect(follow("T'")).toBe("+ ) $");
    expect(follow("F")).toBe("+ * ) $");
    expect([...r.nullable].sort()).toEqual(["E'", "T'"]);
  });

  it("handles left recursion (LR expression grammar)", () => {
    const { first, follow } = ff("E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id");
    expect(first("E")).toBe("( id");
    expect(follow("E")).toBe("+ ) $");
    expect(follow("T")).toBe("+ * ) $");
    expect(follow("F")).toBe("+ * ) $");
  });

  it("propagates through chains of nullable symbols", () => {
    const { first, follow, r } = ff("S -> A B C d\nA -> a | ε\nB -> b | ε\nC -> c | ε");
    // Display order follows first appearance in the grammar (d appears first).
    expect(first("S")).toBe("d a b c");
    expect(follow("A")).toBe("d b c");
    expect(follow("B")).toBe("d c");
    expect(follow("C")).toBe("d");
    expect(r.nullable.has("S")).toBe(false);
  });

  it("marks a nonterminal nullable only through all-nullable bodies", () => {
    const { r, first } = ff("S -> A B\nA -> ε\nB -> A A");
    expect([...r.nullable].sort()).toEqual(["A", "B", "S", "S'"]);
    expect(first("S")).toBe(EPS);
  });

  it("FIRST of a sequence includes ε only when every symbol is nullable", () => {
    const { r } = ff("S -> A B\nA -> a | ε\nB -> b | ε");
    expect([...firstOfSequence(["A", "B"], r.first, r.nullable)].sort()).toEqual(["a", "b", EPS].sort());
    expect([...firstOfSequence(["A", "b"], r.first, r.nullable)].sort()).toEqual(["a", "b"]);
    expect([...firstOfSequence([], r.first, r.nullable)]).toEqual([EPS]);
  });

  it("records a justification for every addition", () => {
    const { r } = ff("E -> E + T | T\nT -> id");
    expect(r.steps.length).toBeGreaterThan(0);
    for (const s of r.steps) {
      expect(s.reason.length).toBeGreaterThan(10);
      expect(s.added.length).toBeGreaterThan(0);
    }
    const plusInFollowE = r.steps.find((s) => s.kind === "FOLLOW" && s.target === "E" && s.added.includes("+"));
    expect(plusInFollowE?.productionId).toBe(1);
  });
});
