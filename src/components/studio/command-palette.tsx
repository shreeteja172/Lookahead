"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Circle, FileCode2, Search, Table2 } from "lucide-react";
import { formatAction, formatItem, formatProduction, METHODS, SAMPLES } from "@/lib/engine";
import { useStudio } from "@/lib/studio/store";
import { Modal } from "@/components/ui/overlay";
import { Kbd } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { METHOD_META } from "./symbols";

interface Entry {
  id: string;
  group: string;
  label: string;
  detail?: string;
  haystack: string;
  icon: React.ReactNode;
  run: () => void;
}

const MAX_RESULTS = 60;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const analysis = useStudio((s) => s.result.analysis);
  const reveal = useStudio((s) => s.reveal);
  const loadProject = useStudio((s) => s.loadProject);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const entries = React.useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const n of NAV) {
      const Icon = n.icon;
      out.push({
        id: `nav:${n.href}`,
        group: "Go to",
        label: n.label,
        detail: n.description,
        haystack: `${n.label} ${n.description}`.toLowerCase(),
        icon: <Icon />,
        run: () => router.push(n.href),
      });
    }
    for (const s of SAMPLES) {
      out.push({
        id: `sample:${s.id}`,
        group: "Sample grammars",
        label: `Load sample: ${s.title}`,
        detail: s.tag,
        haystack: `sample ${s.title} ${s.tag}`.toLowerCase(),
        icon: <BookOpen />,
        run: () => {
          loadProject({ name: s.title, source: s.source, input: s.inputs[0]?.text ?? "", start: "" });
          router.push("/grammar");
        },
      });
    }
    if (analysis) {
      const g = analysis.grammar;
      for (const p of g.productions) {
        const text = formatProduction(p);
        out.push({
          id: `prod:${p.id}`,
          group: "Productions",
          label: `${p.id}. ${text}`,
          haystack: `production p${p.id} r${p.id} ${text}`.toLowerCase(),
          icon: <FileCode2 />,
          run: () => router.push("/grammar"),
        });
      }
      for (const m of METHODS) {
        const t = analysis.tables[m];
        for (const st of t.automaton.states) {
          const kernel = st.items.filter((i) => i.kernel).map((i) => formatItem(g, i));
          const all = st.items.map((i) => formatItem(g, i)).join(" ");
          out.push({
            id: `state:${m}:${st.id}`,
            group: `${METHOD_META[m].label} states`,
            label: `${m} I${st.id}`,
            detail: kernel.join("   "),
            haystack: `${m} state i${st.id} ${st.id} ${all}`.toLowerCase(),
            icon: <Circle />,
            run: () => {
              reveal({ method: m, state: st.id });
              router.push("/automaton");
            },
          });
          for (const [sym, es] of t.action[st.id]) {
            const acts = es.map((e) => formatAction(e.action)).join("/");
            out.push({
              id: `cell:${m}:${st.id}:${sym}`,
              group: `${METHOD_META[m].label} table cells`,
              label: `${m} ACTION[${st.id}, ${sym}] = ${acts}`,
              haystack: `${m} action ${st.id} ${sym} ${acts} ${es.length > 1 ? "conflict" : ""}`.toLowerCase(),
              icon: <Table2 />,
              run: () => {
                reveal({ method: m, state: st.id, symbol: sym });
                router.push("/tables");
              },
            });
          }
        }
      }
    }
    return out;
  }, [analysis, router, reveal, loadProject]);

  const results = React.useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = terms.length === 0 ? entries.filter((e) => e.group === "Go to" || e.group === "Sample grammars") : entries.filter((e) => terms.every((t) => e.haystack.includes(t)));
    return filtered.slice(0, MAX_RESULTS);
  }, [entries, query]);

  const close = () => {
    setQuery("");
    setActive(0);
    onClose();
  };
  const choose = (e: Entry | undefined) => {
    if (!e) return;
    close();
    e.run();
  };

  return (
    <Modal open={open} onClose={close} align="top" className="max-w-2xl">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-fg-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[active]);
            }
          }}
          placeholder="Search pages, productions, states (e.g. “LALR I4”), table cells (“r3”, “conflict”)…"
          className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-1.5">
        {results.length === 0 && <div className="px-3 py-8 text-center text-sm text-fg-muted">No matches.</div>}
        {results.map((r, i) => {
          const header = i === 0 || results[i - 1].group !== r.group ? r.group : null;
          return (
            <React.Fragment key={r.id}>
              {header && <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{header}</div>}
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left cursor-pointer [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle",
                  i === active ? "bg-highlight-bg" : "hover:bg-panel-2",
                )}
              >
                {r.icon}
                <span className="truncate font-mono text-[13px] text-fg">{r.label}</span>
                {r.detail && <span className="ml-auto truncate pl-4 text-xs text-fg-subtle">{r.detail}</span>}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </Modal>
  );
}
