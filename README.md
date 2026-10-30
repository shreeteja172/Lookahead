# Lookahead — SLR · CLR · LALR Parser Studio

**Development of an SLR, CLR and LALR Parsing Table Generation & Simulation Tool** — Compiler Design Lab project.

Lookahead takes any context-free grammar, builds **SLR(1)**, **canonical LR(1)** and **LALR(1)** parsers from scratch, and shows every step: FIRST/FOLLOW derivations, item-set automata, table construction, conflicts, and step-by-step shift-reduce parsing. Nothing is hardcoded. Every set, state, table cell and trace is computed by the engine in `src/lib/engine`, which has its own test-suite checked against textbook results.

## Quick start

Requires Node.js 20+ (developed on Node 24).

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Engine and studio test-suite (Vitest) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run build && npm start` | Production build and server |

## Pages

The sidebar follows the order in which the topic is usually taught. Each step page opens with a short, collapsible concept note and ends with links to the previous and next step.

| Page | What it shows |
|---|---|
| **Overview** | The loaded grammar, one plain-language classification (SLR(1) / LALR(1) / LR(1) / not LR(1)) with a small comparison table, and the five steps with each step's live result |
| **Concepts guide** | A short course on CFGs, derivations, ambiguity, bottom-up parsing, FIRST/FOLLOW, LR(0) and LR(1) items, the three methods and conflicts. Every example is computed from the loaded grammar |
| **1 · Grammar** | Syntax-highlighted editor with line-level diagnostics, start-symbol override, augmented and numbered grammar, symbol table, and sample grammars grouped by their computed class |
| **2 · FIRST & FOLLOW** | Final sets with a per-set derivation ("why is `)` in FOLLOW(T)?"), plus a step-by-step replay of the fixed-point iteration |
| **3 · LR automaton** | Interactive graph of the real LR(0), LR(1) and LALR(1) state machines, with kernel and closure items, lookaheads, start/accept/conflict markers, search, zoom/fit and a state inspector |
| **4 · Parsing table** | ACTION/GOTO for each method; click any cell to see the item and rule that produced it; filter, sort, CSV/JSON export |
| **5 · Parse an input** | Shift-reduce parsing with play/pause/step/reset, the stack and input tape, highlighted table lookups, a bottom-up parse tree, and the **rightmost derivation**, which fills in as reductions happen |
| **Compare parsers** | One input through all three parsers. Separates *grammar is conflict-free* from *this input is accepted*, aligns the traces, and diffs SLR↔LALR and CLR↔LALR tables |
| **Conflicts** | Every conflict with its competing items, why the lookahead is present, which methods share it, and whether **LALR merging introduced it** |
| **Step-through algorithms** | Replays FIRST/FOLLOW, LR(0) and LR(1) closure/GOTO/state creation, table insertion and CLR→LALR merging |

**For the classroom:** the light theme is the default because it projects well, and the text-size button in the top bar (Normal, Large, Projector) scales the whole interface. Concept notes can be collapsed once the class has seen them.

Also included: dark theme, command palette (`Ctrl+K`) that searches pages, productions, states and table cells, keyboard shortcuts (`?`), a short first-run tour, recent projects saved in the browser, project import/export, shareable links (`Share` copies a link whose URL fragment encodes the grammar as validated JSON), and a downloadable Markdown report.

## Grammar notation

```
// comments start with // or #
%token id num          // optional: declare terminals explicitly
%start S               // optional: choose the start symbol

S  -> id = E ;         // ->, → and ::= are all accepted
E  -> E + T
    | T                // a line starting with | continues the previous rule
F  -> '(' E ')' | id   // quotes force a terminal (needed for | or ->)
L  -> ε                // ε, eps, epsilon or λ denote the empty string
```

* Symbols are separated by **whitespace**: `cC` is one symbol, while `c C` is two. The validator warns when a token looks like several symbols written without spaces.
* A symbol is a **nonterminal** iff it appears on the left of an arrow. Every other symbol is a **terminal**.
* The start symbol is the first rule's left-hand side unless `%start` or the start selector overrides it.
* The grammar is augmented with a fresh `S' → S` as **production 0**. Production numbers are shared by all three tables, the simulator and every explanation (`r3` always means production 3).
* `$` is reserved for end of input. Duplicate productions are removed with a warning. Unreachable and non-generating symbols are reported.
* Simulator input is a sequence of terminals. `id + id * id` and `id+id*id` both work, because unspaced input is split by longest match.

## Architecture

```
src/lib/engine/            framework-independent parsing engine (no React imports)
  types.ts                 Production, LRItem, LRState, Automaton, ParseTable, Conflict, SimStep…
  grammar-parser.ts        notation → Grammar (augmentation, line-level errors)
  grammar-validator.ts     unreachable / unproductive / suspicious-symbol checks
  first-follow.ts          NULLABLE, FIRST, FOLLOW with a justification log
  items.ts                 item identity and formatting
  lr0-items.ts             LR(0) CLOSURE and GOTO
  lr1-items.ts             LR(1) CLOSURE with lookahead propagation
  automaton.ts             canonical collection (shared by LR(0) and LR(1))
  lalr-generator.ts        CLR → LALR state merging
  table-builder.ts         ACTION/GOTO for SLR, CLR, LALR + conflict detection
  conflict-analyzer.ts     conflict explanations and cross-method matching
  parser-simulator.ts      tokenizer + table-driven shift-reduce parser
  derivation.ts            rightmost derivation recovered from an accepted parse
  comparison-engine.ts     table and trace diffs between methods
  analysis.ts              pipeline: grammar → sets → automata → tables → diagnoses
  samples.ts               sample grammars (claims verified by tests)
src/lib/studio/            UI state (zustand), share links, exports and report
src/components/views/      one view per module
src/components/studio/     shell, navigation, palette, shared compiler widgets
src/app/<module>/page.tsx  routes
```

Only user input (grammar text, start symbol, input string, preferences) is persisted. Every parser artefact is recomputed from it, so local storage is never the source of truth.

## How the algorithms work (and where to find them)

* **FIRST/FOLLOW** (`first-follow.ts`): three fixed-point passes, run in order: nullable, then FIRST, then FOLLOW. Every set change is logged with its production and reason; the FIRST/FOLLOW view and the explorer display these logs.
* **LR(0) items** (`lr0-items.ts`): `CLOSURE(I)` adds `B → ·γ` for every item `A → α·Bβ`. `GOTO(I, X)` advances the dot over `X`. Items are appended in discovery order, which reproduces textbook (Dragon book) item and state numbering.
* **Canonical collection** (`automaton.ts`): breadth-first. For each state, it computes GOTO on every symbol after a dot, in item order. A state's identity is its *kernel*, compared without lookaheads for LR(0) and with lookaheads for LR(1).
* **LR(1) items** (`lr1-items.ts`): `[A → α·Bβ, a]` adds `[B → ·γ, b]` for every `b ∈ FIRST(βa)`. Items with the same core share one lookahead set. When new lookaheads reach a core that is already present, they are pushed back on the worklist, so the closure reaches the true fixed point.
* **SLR(1)** (`table-builder.ts`): a complete item `A → α·` reduces on every `a ∈ FOLLOW(A)`.
* **CLR(1)**: a complete item reduces only on its own lookaheads.
* **LALR(1)** (`lalr-generator.ts`): CLR states are partitioned by LR(0) core. Each partition becomes one state whose item lookaheads are the union across the partition, and transitions are inherited. This is *built from CLR*, not a renamed SLR. The tests check that the resulting cores coincide with the LR(0) states.
* **Conflicts**: every insertion into a cell is kept, so a cell with two different actions *is* the conflict. For each LALR conflict, the analyzer checks whether any of the merged CLR states already had it. If none did, merging introduced it.
* **Simulation** (`parser-simulator.ts`): the standard LR driver loop. Each step records the configuration *before* its action. Conflicts halt by default, or can be resolved yacc-style (prefer shift). A step limit guards against non-terminating resolutions.

A conflict-free table proves the grammar is in that class, and LR(1) grammars are unambiguous. A conflict does **not** by itself prove ambiguity: the grammar may just need more lookahead. The analyzer's "likely cause" recognises common patterns, but it never claims that every conflict can be fixed automatically.

## Testing

`npm test` runs 82 tests, including:

* grammar tokenization, validation, augmentation and error lines;
* FIRST/FOLLOW for Dragon book Example 4.30, left recursion and nullable chains;
* LR(0) `I0` and GOTO, and LR(1) closure with propagated and nullable-suffix lookaheads;
* the **exact SLR table of Dragon Fig. 4.37** (12 states), the **CLR table for `S → C C`** (10 states) and its **LALR merge** into 7 states;
* `S → L = R | R` (SLR conflict on `=`, LR(1) with 14 states, LALR with 10), and `S → a A d | b B d | a B e | b A e` (LR(1), but LALR merging introduces reduce-reduce conflicts);
* ambiguous grammars (`E → E + E`, `S → S S`) and dangling-else detection;
* the **simulation trace of Dragon Fig. 4.38** and the rightmost derivation recovered from it, empty input, invalid tokens, conflict policies and the step limit;
* every sample grammar's conflict-freedom, state counts and sample inputs;
* share-link decoding and every export format.

## Status

Implemented: everything listed above. Not implemented: operator-precedence declarations (`%left`/`%right`) for resolving conflicts automatically, LL(1) parsing, and lexer/regex token definitions. Input tokens must be the grammar's terminals.
