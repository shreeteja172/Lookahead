"use client";

import * as React from "react";
import { BookOpen, Check, ChevronDown, CircleAlert, CircleCheck, Copy, Info, ListTree, Sparkles, TriangleAlert, X } from "lucide-react";
import { analyzeGrammar, grammarToText, METHODS, SAMPLES, type Diagnostic } from "@/lib/engine";
import { useStudio } from "@/lib/studio/store";
import { Badge, Button, Panel, PanelHeader, Select } from "@/components/ui/primitives";
import { PageHeader } from "@/components/studio/page-header";
import { METHOD_META, ProductionText, Sym } from "@/components/studio/symbols";
import { cn, copyText } from "@/lib/utils";
import { GrammarEditor } from "./grammar-editor";

export function GrammarView() {
  const projectId = useStudio((s) => s.projectId);
  return (
    <>
      <PageHeader
        title="Grammar Workbench"
        description="Write a context-free grammar. It is validated and analysed as you type — all other modules update automatically."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <EditorPanel key={projectId} />
          <NotationHelp />
        </div>
        <div className="grid content-start gap-4">
          <ParsedGrammar />
          <Samples />
        </div>
      </div>
    </>
  );
}

function EditorPanel() {
  const source = useStudio((s) => s.source);
  const setSource = useStudio((s) => s.setSource);
  const result = useStudio((s) => s.result);
  const startOverride = useStudio((s) => s.startOverride);
  const setStartOverride = useStudio((s) => s.setStartOverride);
  const [text, setText] = React.useState(source);
  const [focusLine, setFocusLine] = React.useState<{ line: number; nonce: number } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const onChange = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSource(v), 250);
  };
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const pending = text !== source;

  const diagnostics = result.parse.diagnostics;
  const errors = diagnostics.filter((d) => d.severity === "error");
  const nts = result.analysis?.grammar.nonterminals.slice(1) ?? [];
  const lhsCandidates = React.useMemo(() => {
    const s = new Set<string>();
    for (const l of source.split("\n")) {
      const m = l.match(/^\s*([^\s|%#][^\s]*)\s*(::=|->|→)/);
      if (m) s.add(m[1]);
    }
    return [...s];
  }, [source]);

  return (
    <Panel>
      <PanelHeader
        title="Grammar"
        description={
          <>
            One rule per line · <span className="font-mono">|</span> separates alternatives · <span className="font-mono text-fg-subtle">ε</span> for empty ·{" "}
            <kbd className="font-mono">Ctrl+Enter</kbd> to analyse now
          </>
        }
        actions={
          <>
            <label className="flex items-center gap-1.5 text-xs text-fg-muted">
              Start
              <Select value={startOverride} onChange={(e) => setStartOverride(e.target.value)} className="h-7 text-xs">
                <option value="">auto ({result.analysis?.grammar.start ?? lhsCandidates[0] ?? "—"})</option>
                {(nts.length ? nts : lhsCandidates).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (await copyText(text)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }
              }}
              title="Copy grammar"
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
          </>
        }
      />
      <div className="p-3">
        <GrammarEditor
          value={text}
          onChange={onChange}
          onCommit={() => {
            clearTimeout(timer.current);
            setSource(text);
          }}
          diagnostics={pending ? [] : diagnostics}
          focusLine={focusLine}
        />
        <div className="mt-2 flex items-center gap-2 text-xs">
          {pending ? (
            <span className="text-fg-subtle">Analysing…</span>
          ) : errors.length ? (
            <span className="flex items-center gap-1.5 text-danger">
              <CircleAlert className="size-3.5" /> {errors.length} error{errors.length > 1 ? "s" : ""} — parsers cannot be generated
            </span>
          ) : result.error ? (
            <span className="flex items-center gap-1.5 text-danger">
              <CircleAlert className="size-3.5" /> {result.error}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-success">
              <CircleCheck className="size-3.5" /> Valid grammar — SLR, CLR and LALR parsers generated
            </span>
          )}
        </div>
      </div>
      {!pending && diagnostics.length > 0 && (
        <ul className="max-h-64 divide-y divide-border overflow-y-auto border-t border-border">
          {diagnostics.map((d, i) => (
            <DiagnosticRow key={i} d={d} onJump={() => d.line && setFocusLine({ line: d.line, nonce: Date.now() })} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DiagnosticRow({ d, onJump }: { d: Diagnostic; onJump: () => void }) {
  const Icon = d.severity === "error" ? CircleAlert : d.severity === "warning" ? TriangleAlert : Info;
  return (
    <li>
      <button type="button" onClick={onJump} className="flex w-full gap-2.5 px-4 py-2 text-left hover:bg-panel-2 cursor-pointer">
        <Icon
          className={cn(
            "mt-0.5 size-3.5 shrink-0",
            d.severity === "error" ? "text-danger" : d.severity === "warning" ? "text-warning" : "text-accent",
          )}
        />
        <div className="min-w-0 text-xs">
          <div className="text-fg">
            {d.line > 0 && <span className="mr-1.5 font-mono text-fg-subtle">L{d.line}</span>}
            {d.message}
          </div>
          {d.hint && <div className="mt-0.5 text-fg-muted">{d.hint}</div>}
        </div>
      </button>
    </li>
  );
}

function ParsedGrammar() {
  const analysis = useStudio((s) => s.result.analysis);
  const grammar = useStudio((s) => s.result.parse.grammar);
  if (!grammar) {
    return (
      <Panel>
        <PanelHeader icon={<ListTree />} title="Augmented grammar" />
        <div className="p-6 text-center text-sm text-fg-muted">Fix the errors on the left to see the parsed grammar.</div>
      </Panel>
    );
  }
  const nullable = analysis?.ff.nullable ?? new Set<string>();
  const unreachable = new Set(analysis?.unreachable ?? []);
  const unproductive = new Set(analysis?.unproductive ?? []);
  return (
    <Panel>
      <PanelHeader
        icon={<ListTree />}
        title="Augmented grammar"
        description="Production numbers are shared by every table, trace and explanation (r3 = reduce by production 3)."
        actions={
          <Button size="sm" variant="ghost" title="Copy normalised grammar" onClick={() => copyText(grammarToText(grammar))}>
            <Copy />
          </Button>
        }
      />
      <div className="grid max-h-72 gap-0.5 overflow-y-auto px-4 py-3">
        {grammar.productions.map((p) => (
          <div key={p.id} className={cn("flex items-baseline justify-between gap-3 rounded px-1", p.id === 0 && "text-fg-muted")}>
            <ProductionText p={p} numbered />
            <span className="text-[0.6875rem] text-fg-subtle">{p.id === 0 ? "augmented" : `line ${p.line}`}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 border-t border-border px-4 py-3 sm:grid-cols-2">
        <div>
          <div className="font-medium mb-2 text-xs text-fg-muted">Nonterminals ({grammar.nonterminals.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {grammar.nonterminals.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded-md border border-border bg-panel-2 px-1.5 py-0.5">
                <Sym s={n} className="text-[0.8125rem]" />
                {n === grammar.start && <Badge tone="accent">start</Badge>}
                {n === grammar.augmentedStart && <Badge>S′</Badge>}
                {nullable.has(n) && <Badge tone="info">nullable</Badge>}
                {unreachable.has(n) && <Badge tone="warning">unreachable</Badge>}
                {unproductive.has(n) && <Badge tone="danger">unproductive</Badge>}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="font-medium mb-2 text-xs text-fg-muted">Terminals ({grammar.terminals.length} + $)</div>
          <div className="flex flex-wrap gap-1.5">
            {[...grammar.terminals, "$"].map((t) => (
              <span key={t} className="rounded-md border border-border bg-panel-2 px-1.5 py-0.5">
                <Sym s={t} className="text-[0.8125rem]" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Samples() {
  const loadProject = useStudio((s) => s.loadProject);
  const current = useStudio((s) => s.source);
  // Classification badges are computed from the real tables, never from the sample metadata.
  const computed = React.useMemo(
    () =>
      SAMPLES.map((s) => {
        const r = analyzeGrammar(s.source);
        return Object.fromEntries(METHODS.map((m) => [m, r.analysis ? r.analysis.tables[m].conflicts.length === 0 : false]));
      }),
    [],
  );
  return (
    <Panel>
      <PanelHeader icon={<Sparkles />} title="Sample grammars" description="Verified by the automated test-suite. Badges show the computed result." />
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {SAMPLES.map((s, i) => {
          const active = s.source === current;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => loadProject({ name: s.title, source: s.source, input: s.inputs[0]?.text ?? "", start: "" })}
              className={cn(
                "group flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                active ? "border-accent/60 bg-highlight-bg" : "border-border hover:border-border-strong hover:bg-panel-2",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.title}</span>
                {active && <Badge tone="accent">loaded</Badge>}
              </div>
              <p className="line-clamp-2 text-xs text-fg-muted">{s.description}</p>
              <div className="mt-auto flex flex-wrap gap-1 pt-1">
                {METHODS.map((m) => (
                  <Badge key={m} tone={computed[i][m] ? METHOD_META[m].tone : "danger"}>
                    {computed[i][m] ? <Check /> : <X />}
                    {m}
                  </Badge>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function NotationHelp() {
  const [open, setOpen] = React.useState(false);
  return (
    <Panel>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left cursor-pointer">
        <BookOpen className="size-4 text-fg-subtle" />
        <span className="text-sm font-semibold">Grammar notation reference</span>
        <ChevronDown className={cn("ml-auto size-4 text-fg-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border p-4 text-xs text-fg-muted md:grid-cols-2">
          <pre className="rounded-lg border border-border bg-bg-elevated p-3 font-mono text-[0.75rem] leading-5 text-fg">{`// comments start with // or #
%token id num          // optional terminal declarations
%start S               // optional start symbol

S  -> id = E ;         // ->, → and ::= are all arrows
E  -> E + T
    | T                // continuation line
T  -> '(' E ')' | id   // quotes force a terminal
L  -> ε                // ε, eps, epsilon or λ`}</pre>
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Symbols are separated by <b>whitespace</b>. <span className="font-mono">cC</span> is one symbol; write <span className="font-mono">c C</span>.</li>
            <li>A symbol is a <span className="text-nonterminal">nonterminal</span> iff it appears on the left of an arrow; all others are <span className="text-terminal">terminals</span>.</li>
            <li>The first rule&apos;s left side is the start symbol unless <span className="font-mono">%start</span> or the selector overrides it.</li>
            <li>The grammar is augmented with a fresh <span className="font-mono">S′ → S</span> as production 0.</li>
            <li><span className="font-mono text-fg-subtle">$</span> is reserved for end of input.</li>
            <li>Duplicate productions are removed (with a warning); unreachable and non-generating symbols are reported.</li>
          </ul>
        </div>
      )}
    </Panel>
  );
}
