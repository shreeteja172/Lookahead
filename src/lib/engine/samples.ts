import type { ParserMethod } from "./types";

export interface SampleInput {
  text: string;
  /** Expected outcome under a parser that has no conflict for this grammar. */
  accept: boolean;
  note?: string;
}

export interface SampleGrammar {
  id: string;
  title: string;
  tag: string;
  description: string;
  source: string;
  inputs: SampleInput[];
  /**
   * Which constructions are conflict-free. These claims are not displayed
   * as-is: the UI always shows the classification computed from the actual
   * tables, and the test-suite asserts that the engine agrees with every claim.
   */
  conflictFree: Record<ParserMethod, boolean>;
  /** State counts verified by tests, where they are textbook facts. */
  states?: Partial<Record<"LR0" | "LR1" | "LALR1", number>>;
}

export const SAMPLES: SampleGrammar[] = [
  {
    id: "expr-precedence",
    title: "Arithmetic with precedence",
    tag: "SLR(1)",
    description:
      "Four precedence levels encoded by stratification: + − (left-assoc), * / (left-assoc), ^ (right-assoc) and unary minus. Precedence lives in the grammar's structure, so no conflicts arise.",
    source: `// Lowest precedence first
E -> E + T | E - T | T
T -> T * F | T / F | F
F -> P ^ F | P          // right-associative power
P -> ( E ) | - P | id | num`,
    inputs: [
      { text: "id + id * id", accept: true },
      { text: "( id + num ) * id ^ id ^ num", accept: true },
      { text: "- id - - num", accept: true, note: "binary minus and unary minus together" },
      { text: "id + * id", accept: false },
    ],
    conflictFree: { SLR: true, CLR: true, LALR: true },
  },
  {
    id: "dragon-expr",
    title: "Parenthesized expressions",
    tag: "SLR(1)",
    description:
      "The classic expression grammar from Aho, Lam, Sethi & Ullman (Dragon book, Fig. 4.37). Its SLR automaton has the textbook 12 states I0–I11, while canonical LR(1) needs many more.",
    source: `E -> E + T | T
T -> T * F | F
F -> ( E ) | id`,
    inputs: [
      { text: "id * id + id", accept: true },
      { text: "( ( id + id ) * id )", accept: true },
      { text: "( id + id", accept: false, note: "missing )" },
      { text: "", accept: false, note: "empty input" },
    ],
    conflictFree: { SLR: true, CLR: true, LALR: true },
    states: { LR0: 12, LALR1: 12 },
  },
  {
    id: "assignment",
    title: "Assignment statements",
    tag: "SLR(1)",
    description:
      "A small statement language: a program is a non-empty list of assignments terminated by semicolons, with arithmetic on the right-hand side.",
    source: `%token id num
P -> P S | S
S -> id = E ;
E -> E + T | E - T | T
T -> T * F | F
F -> ( E ) | id | num`,
    inputs: [
      { text: "id = id + num * id ;", accept: true },
      { text: "id = ( id - num ) ; id = id * id ;", accept: true },
      { text: "id = id + ;", accept: false },
      { text: "id = num", accept: false, note: "missing ;" },
    ],
    conflictFree: { SLR: true, CLR: true, LALR: true },
  },
  {
    id: "epsilon-expr",
    title: "ε-productions (LL-style expressions)",
    tag: "nullable",
    description:
      "Left recursion removed with ε-productions (Dragon book 4.28). E' and T' are nullable, which exercises ε in FIRST and the FOLLOW(A) ⊆ FOLLOW(B) rule. LR parsers reduce E' → ε when the lookahead is in its lookahead set.",
    source: `E  -> T E'
E' -> + T E' | ε
T  -> F T'
T' -> * F T' | ε
F  -> ( E ) | id`,
    inputs: [
      { text: "id + id * id", accept: true },
      { text: "( id )", accept: true },
      { text: "id *", accept: false },
    ],
    conflictFree: { SLR: true, CLR: true, LALR: true },
  },
  {
    id: "balanced",
    title: "Balanced parentheses (ε)",
    tag: "nullable",
    description:
      "S → ( S ) S | ε generates every balanced string of parentheses, including the empty string — try simulating empty input.",
    source: `S -> ( S ) S | ε`,
    inputs: [
      { text: "", accept: true, note: "empty string is balanced" },
      { text: "( ( ) ) ( )", accept: true },
      { text: "( ( )", accept: false },
    ],
    conflictFree: { SLR: true, CLR: true, LALR: true },
  },
  {
    id: "lvalue",
    title: "LR(1) but not SLR(1)",
    tag: "LALR(1)",
    description:
      "Pointer assignments (Dragon book Ex. 4.48). SLR has a shift-reduce conflict on '=' because '=' ∈ FOLLOW(R), even though an R can never be followed by '=' in the state where L has just been recognised. Canonical LR(1) and LALR(1) both track the exact lookahead.",
    source: `S -> L = R | R
L -> * R | id
R -> L`,
    inputs: [
      { text: "id = * id", accept: true },
      { text: "* * id = id", accept: true },
      { text: "id = = id", accept: false },
    ],
    conflictFree: { SLR: false, CLR: true, LALR: true },
    states: { LR0: 10, LR1: 14, LALR1: 10 },
  },
  {
    id: "lr1-not-lalr",
    title: "LR(1) but not LALR(1)",
    tag: "CLR(1)",
    description:
      "After 'a c' the parser must reduce c to A if d follows and to B if e follows; after 'b c' it is the other way round. Canonical LR(1) keeps the two contexts in separate states. LALR merges them (same core), which unites the lookaheads and creates a reduce-reduce conflict.",
    source: `S -> a A d | b B d | a B e | b A e
A -> c
B -> c`,
    inputs: [
      { text: "a c d", accept: true },
      { text: "b c d", accept: true },
      { text: "a c e", accept: true },
      { text: "a c c", accept: false },
    ],
    conflictFree: { SLR: false, CLR: true, LALR: false },
  },
  {
    id: "cc",
    title: "S → C C (CLR vs LALR states)",
    tag: "LALR(1)",
    description:
      "Dragon book grammar 4.55. Canonical LR(1) has 10 states; LALR merges the pairs (3,6), (4,7) and (8,9) down to 7 states with an identical language and no new conflicts.",
    source: `S -> C C
C -> c C | d`,
    inputs: [
      { text: "c d d", accept: true },
      { text: "c c d c d", accept: true },
      { text: "c d", accept: false },
    ],
    conflictFree: { SLR: true, CLR: true, LALR: true },
    states: { LR0: 7, LR1: 10, LALR1: 7 },
  },
  {
    id: "dangling-else",
    title: "Dangling else (ambiguous)",
    tag: "ambiguous",
    description:
      "The if-then-else grammar is ambiguous, so every LR construction reports a shift-reduce conflict on else. Switch the simulator's conflict policy to 'prefer shift' to see the conventional resolution: else binds to the nearest if.",
    source: `S -> if C then S else S | if C then S | other
C -> cond`,
    inputs: [
      { text: "if cond then if cond then other else other", accept: true, note: "needs prefer-shift" },
      { text: "if cond then other", accept: true },
    ],
    conflictFree: { SLR: false, CLR: false, LALR: false },
  },
  {
    id: "ambiguous-expr",
    title: "Ambiguous expressions",
    tag: "ambiguous",
    description:
      "E → E + E | E * E | ( E ) | id leaves precedence and associativity unspecified. All three constructions report shift-reduce conflicts on + and *. Compare with the stratified grammar above.",
    source: `E -> E + E | E * E | ( E ) | id`,
    inputs: [
      { text: "id + id * id", accept: true, note: "needs prefer-shift" },
      { text: "id + ", accept: false },
    ],
    conflictFree: { SLR: false, CLR: false, LALR: false },
  },
];

export const DEFAULT_SAMPLE = SAMPLES[1];
