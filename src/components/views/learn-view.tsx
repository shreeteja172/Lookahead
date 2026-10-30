"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  END,
  rightmostDerivation,
  simulate,
  sortSymbols,
  tokenizeInput,
  type Analysis,
  type DerivationStep,
} from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { ItemText, ProductionText, Sym, SymSet } from "@/components/studio/symbols";
import { Notation } from "@/components/studio/concept-note";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "cfg", title: "Context-free grammars" },
  { id: "derivations", title: "Derivations and parse trees" },
  { id: "ambiguity", title: "Ambiguity" },
  { id: "bottom-up", title: "Bottom-up parsing" },
  { id: "first-follow", title: "FIRST and FOLLOW" },
  { id: "lr0", title: "LR(0) items, CLOSURE and GOTO" },
  { id: "lr1", title: "LR(1) items and lookaheads" },
  { id: "methods", title: "SLR, CLR and LALR compared" },
  { id: "conflicts", title: "Conflicts" },
];

export function LearnView() {
  const a = useAnalysis();
  return (
    <>
      <PageHeader
        title="Concepts guide"
        description="A short course on context-free grammars and LR parsing. Every example on this page is computed from the grammar currently loaded, so it changes when you load another grammar."
      />
      {!a ? (
        <NeedsGrammar />
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Sections" className="hidden lg:block">
            <ol className="sticky top-0 space-y-1 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 rounded px-2 py-1 text-fg-muted hover:bg-panel-2 hover:text-fg">
                    <span className="w-4 text-right font-mono text-xs leading-5">{i + 1}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="max-w-3xl space-y-12 pb-12 text-[0.9375rem] leading-relaxed">
            <Content a={a} />
          </article>
        </div>
      )}
    </>
  );
}

function Section({ id, n, children, see }: { id: string; n: number; children: React.ReactNode; see?: { href: string; label: string }[] }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-3 flex items-baseline gap-3 text-xl font-semibold tracking-tight">
        <span className="font-mono text-base text-fg-muted">{n}</span>
        {title}
      </h2>
      <div className="space-y-3 text-fg">{children}</div>
      {see && (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-fg-muted">See it in:</span>
          {see.map((s) => (
            <Link key={s.href} href={s.href} className="inline-flex items-center gap-1 text-accent hover:underline">
              {s.label} <ArrowRight className="size-3.5" />
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-lg border border-border bg-panel-2 px-4 py-3">
      <figcaption className="mb-2 text-xs font-medium text-fg-muted">{title}</figcaption>
      <div className="text-sm">{children}</div>
    </figure>
  );
}

function Content({ a }: { a: Analysis }) {
  const g = a.grammar;
  const input = useStudio((s) => s.input);
  const derivation = React.useMemo<DerivationStep[] | null>(() => {
    const tok = tokenizeInput(input, g.terminals);
    if (tok.errors.length) return null;
    return rightmostDerivation(g, simulate(g, a.tables.CLR, tok.tokens));
  }, [input, g, a]);
  const nts = new Set(g.nonterminals);
  const firstNT = g.nonterminals[1];

  return (
    <>
      <Section id="cfg" n={1} see={[{ href: "/grammar", label: "Grammar" }]}>
        <p>
          A <b>context-free grammar</b> is a 4-tuple <Notation>G = (N, T, P, S)</Notation>: a set of <b>nonterminals</b> N (syntactic variables), a set
          of <b>terminals</b> T (the tokens), a set of <b>productions</b> P of the form <Notation>A → α</Notation> with A ∈ N and α a string over N ∪ T,
          and a <b>start symbol</b> S ∈ N. It is <i>context-free</i> because A can be replaced by α wherever A appears.
        </p>
        <Example title="The loaded grammar">
          <div className="grid gap-1 font-mono">
            <div>
              N = {"{ "}
              {g.nonterminals.slice(1).map((n, i) => (
                <React.Fragment key={n}>
                  {i > 0 && ", "}
                  <Sym s={n} />
                </React.Fragment>
              ))}
              {" }"}
            </div>
            <div>
              T = {"{ "}
              {g.terminals.map((t, i) => (
                <React.Fragment key={t}>
                  {i > 0 && ", "}
                  <Sym s={t} />
                </React.Fragment>
              ))}
              {" }"}
            </div>
            <div>
              S = <Sym s={g.start} />, and P has {g.productions.length - 1} productions:
            </div>
            <div className="mt-1 grid gap-0.5 pl-4">
              {g.productions.slice(1).map((p) => (
                <ProductionText key={p.id} p={p} numbered />
              ))}
            </div>
          </div>
        </Example>
        <p>
          In this studio a symbol is a nonterminal exactly when it has productions. Throughout the studio nonterminals look like{" "}
          <span className="font-mono text-nonterminal">{g.start}</span> and terminals look like{" "}
          <span className="font-mono text-terminal">{g.terminals[0] ?? "a"}</span>.
        </p>
      </Section>

      <Section id="derivations" n={2} see={[{ href: "/simulate", label: "Parse an input" }]}>
        <p>
          A <b>derivation</b> rewrites one nonterminal at a time, starting from S, until only terminals remain. If we always rewrite the{" "}
          <b>rightmost</b> nonterminal we get a <b>rightmost derivation</b>, written <Notation>S ⇒*rm w</Notation>. Every intermediate string is a{" "}
          <b>sentential form</b>. A <b>parse tree</b> records which production expanded each nonterminal, without the order.
        </p>
        {derivation ? (
          <Example title={`Rightmost derivation of “${input.trim() || "ε"}” (the current simulator input)`}>
            <DerivationList steps={derivation} nonterminals={nts} />
          </Example>
        ) : (
          <Example title="Rightmost derivation">
            <p className="text-fg-muted">
              The current input “{input}” is not in the language of this grammar. Enter a sentence in{" "}
              <Link href="/simulate" className="text-accent hover:underline">
                Parse an input
              </Link>{" "}
              to see its derivation here.
            </p>
          </Example>
        )}
      </Section>

      <Section id="ambiguity" n={3} see={[{ href: "/conflicts", label: "Conflicts" }]}>
        <p>
          A grammar is <b>ambiguous</b> if some sentence has two different parse trees (equivalently, two different rightmost derivations). The
          classic example is <Notation>E → E + E | E * E | id</Notation>: <Notation>id + id * id</Notation> can be grouped as{" "}
          <Notation>(id + id) * id</Notation> or <Notation>id + (id * id)</Notation>.
        </p>
        <p>
          Ambiguity is undecidable in general, so no tool can always detect it. But an ambiguous grammar is never LR(1): if the canonical LR(1)
          table has no conflicts, the grammar is unambiguous. Precedence is usually encoded by layering the grammar (E, T, F), as in the
          “Arithmetic with precedence” sample.
        </p>
      </Section>

      <Section id="bottom-up" n={4} see={[{ href: "/simulate", label: "Parse an input" }, { href: "/tables", label: "Parsing table" }]}>
        <p>
          A <b>bottom-up</b> (shift-reduce) parser builds the parse tree from the leaves up. It keeps a stack and repeatedly chooses one of four
          actions:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <b>shift</b> — move the next input token onto the stack;
          </li>
          <li>
            <b>reduce</b> by <Notation>A → β</Notation> — the top of the stack is β; replace it with A;
          </li>
          <li>
            <b>accept</b> — the stack holds the start symbol and the input is exhausted;
          </li>
          <li>
            <b>error</b> — no action applies.
          </li>
        </ul>
        <p>
          The substring reduced at each step is the <b>handle</b>. Reading the reductions backwards gives exactly the rightmost derivation from
          section 2, which is why LR parsers are said to trace out a <i>rightmost derivation in reverse</i>. An LR parser decides between shift and
          reduce by looking at its current <b>state</b> and the next input token (the <b>lookahead</b>) in a precomputed table.
        </p>
        <p>
          Before building the table, the grammar is <b>augmented</b> with a new start production <ProductionText p={g.productions[0]} />, so that
          “reduce by production 0” unambiguously means the parse is complete.
        </p>
      </Section>

      <Section id="first-follow" n={5} see={[{ href: "/first-follow", label: "FIRST & FOLLOW" }]}>
        <p>
          <Notation>FIRST(α)</Notation> is the set of terminals that can begin a string derived from α (plus ε if α can derive the empty string).{" "}
          <Notation>FOLLOW(A)</Notation> is the set of terminals that can appear immediately after A in some sentential form, with{" "}
          <Notation>{END}</Notation> if A can end the input. Both are computed by repeating simple rules until nothing changes.
        </p>
        {firstNT && (
          <Example title="From the loaded grammar">
            <div className="grid gap-1 font-mono">
              {g.nonterminals.slice(1, 4).map((n) => (
                <div key={n}>
                  FIRST(<Sym s={n} />) = <SymSet symbols={sortSymbols(a.ff.first.get(n)!, g.terminals)} />
                  <span className="mx-3 text-fg-subtle">·</span>
                  FOLLOW(<Sym s={n} />) = <SymSet symbols={sortSymbols(a.ff.follow.get(n)!, g.terminals)} />
                </div>
              ))}
            </div>
          </Example>
        )}
        <p>SLR uses FOLLOW to decide where to reduce: it reduces by A → β whenever the lookahead is in FOLLOW(A).</p>
      </Section>

      <Section id="lr0" n={6} see={[{ href: "/automaton", label: "LR automaton" }, { href: "/algorithms", label: "Step-through algorithms" }]}>
        <p>
          An <b>LR(0) item</b> is a production with a dot in its body, such as <Notation>E → E • + T</Notation>. The dot marks how much of the body
          has already been recognised. A <b>state</b> of the parser is a set of items.
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <b>CLOSURE(I)</b>: if <Notation>A → α • B β</Notation> is in I, add <Notation>B → • γ</Notation> for every production of B — we might be
            about to see a B.
          </li>
          <li>
            <b>GOTO(I, X)</b>: move the dot over X in every item of I that has X after the dot, then take the closure.
          </li>
        </ul>
        <p>
          Starting from <Notation>CLOSURE({`{ ${g.augmentedStart} → • ${g.start} }`})</Notation> and applying GOTO on every symbol gives the
          canonical collection — here {a.lr0.states.length} states.
        </p>
        <Example title="State I0 of the loaded grammar (LR(0))">
          <div className="grid">
            {a.lr0.states[0].items.map((it, i) => (
              <ItemText key={i} grammar={g} item={it} className={cn(!it.kernel && "text-fg-muted")} />
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-muted">The first item is the kernel; the rest were added by CLOSURE.</p>
        </Example>
      </Section>

      <Section id="lr1" n={7} see={[{ href: "/automaton", label: "LR automaton (CLR)" }]}>
        <p>
          An <b>LR(1) item</b> <Notation>[A → α • β, a]</Notation> also carries a lookahead terminal a: the reduction <Notation>A → αβ</Notation> is
          valid only if the next token is a. CLOSURE now computes lookaheads too: from <Notation>[A → α • B β, a]</Notation> it adds{" "}
          <Notation>[B → • γ, b]</Notation> for every b in <Notation>FIRST(β a)</Notation>.
        </p>
        <Example title="State I0 of the loaded grammar (LR(1))">
          <div className="grid">
            {a.lr1.states[0].items.map((it, i) => (
              <ItemText key={i} grammar={g} item={it} className={cn(!it.kernel && "text-fg-muted")} />
            ))}
          </div>
        </Example>
        <p>
          Because items with different lookaheads are different states, the canonical LR(1) collection is usually larger: here{" "}
          {a.lr1.states.length} states versus {a.lr0.states.length} for LR(0).
        </p>
      </Section>

      <Section id="methods" n={8} see={[{ href: "/compare", label: "Compare parsers" }, { href: "/tables", label: "Parsing table" }]}>
        <p>All three methods fill the table the same way for shifts and GOTOs. They differ in which lookaheads trigger a reduction.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left">
                <th className="py-2 pr-4 font-semibold">Method</th>
                <th className="py-2 pr-4 font-semibold">States from</th>
                <th className="py-2 pr-4 font-semibold">Reduce A → β on</th>
                <th className="py-2 pr-4 text-right font-semibold">States here</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-medium">SLR(1)</td>
                <td className="py-2 pr-4">LR(0) items</td>
                <td className="py-2 pr-4">every terminal in FOLLOW(A)</td>
                <td className="py-2 pr-4 text-right font-mono">{a.lr0.states.length}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-medium">Canonical LR(1)</td>
                <td className="py-2 pr-4">LR(1) items</td>
                <td className="py-2 pr-4">the item&apos;s own lookaheads</td>
                <td className="py-2 pr-4 text-right font-mono">{a.lr1.states.length}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">LALR(1)</td>
                <td className="py-2 pr-4">LR(1) states with equal cores merged</td>
                <td className="py-2 pr-4">the union of the merged lookaheads</td>
                <td className="py-2 pr-4 text-right font-mono">{a.lalr.states.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          In power, SLR(1) ⊂ LALR(1) ⊂ LR(1). LALR has as few states as SLR but almost the precision of canonical LR(1), which is why parser
          generators such as Yacc and Bison use it.
        </p>
      </Section>

      <Section id="conflicts" n={9} see={[{ href: "/conflicts", label: "Conflicts" }]}>
        <p>
          A <b>conflict</b> is a table cell that would need two actions. In a <b>shift-reduce</b> conflict the parser cannot tell whether the handle
          is complete; in a <b>reduce-reduce</b> conflict it cannot tell which production the handle belongs to. Common causes:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>an ambiguous grammar (every method conflicts);</li>
          <li>FOLLOW sets that are too coarse (SLR conflicts, CLR does not);</li>
          <li>merging LR(1) states unites lookaheads that were kept apart (LALR conflicts, CLR does not);</li>
          <li>a language that needs more than one token of lookahead.</li>
        </ul>
        <p>
          {a.diagnoses.length === 0
            ? "The loaded grammar has no conflicts in any method. Load the “Dangling else” or “LR(1) but not LALR(1)” sample to see each kind."
            : `The loaded grammar has ${a.diagnoses.length} conflicting cell${a.diagnoses.length > 1 ? "s" : ""} across the three tables; the Conflicts page explains each one.`}
        </p>
      </Section>
    </>
  );
}

/** Rightmost derivation with the rewritten nonterminal underlined on each line. */
export function DerivationList({
  steps,
  nonterminals,
  activeFrom,
}: {
  steps: DerivationStep[];
  nonterminals: Set<string>;
  /** Lines with index ≥ activeFrom are emphasised (used by the simulator to show progress). */
  activeFrom?: number;
}) {
  return (
    <ol className="grid gap-0.5 font-mono text-sm">
      {steps.map((s, i) => (
        <li key={i} className={cn("flex gap-2", activeFrom !== undefined && i < activeFrom && "opacity-35")}>
          <span className="w-5 text-right text-fg-subtle">{i === 0 ? "" : "⇒"}</span>
          <span>
            {s.form.length === 0 && <span className="italic text-fg-subtle">ε</span>}
            {s.form.map((sym, k) => (
              <React.Fragment key={k}>
                {k > 0 && " "}
                <span
                  className={cn(
                    nonterminals.has(sym) ? "text-nonterminal" : "text-terminal",
                    k === s.rewrite && "underline decoration-2 underline-offset-4",
                  )}
                >
                  {sym}
                </span>
              </React.Fragment>
            ))}
          </span>
          {s.prod !== undefined && <span className="ml-auto pl-4 text-xs text-fg-subtle">by {s.prod}</span>}
        </li>
      ))}
    </ol>
  );
}
