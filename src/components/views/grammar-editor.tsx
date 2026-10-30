"use client";

import * as React from "react";
import type { Diagnostic } from "@/lib/engine";
import { EPSILON_SPELLINGS } from "@/lib/engine";
import { cn } from "@/lib/utils";

const ARROW_RE = /(::=|->|→)/;

interface Span {
  text: string;
  cls?: string;
}

/** Lightweight syntax highlighter for the grammar notation (mirrors the engine's lexer rules). */
function highlightLine(line: string, nonterminals: Set<string>): Span[] {
  const spans: Span[] = [];
  let code = line;
  let comment = "";
  if (line.trimStart().startsWith("#")) {
    return [{ text: line, cls: "text-fg-subtle italic" }];
  }
  const ci = line.indexOf("//");
  if (ci !== -1) {
    code = line.slice(0, ci);
    comment = line.slice(ci);
  }
  if (code.trimStart().startsWith("%")) {
    const m = code.match(/^(\s*)(%\S+)(.*)$/);
    if (m) {
      spans.push({ text: m[1] }, { text: m[2], cls: "text-fg" });
      for (const part of m[3].split(/(\s+)/)) spans.push({ text: part, cls: /\S/.test(part) ? "text-terminal" : undefined });
    } else spans.push({ text: code });
  } else {
    let head = "";
    let arrow = "";
    let body = code;
    const am = code.match(ARROW_RE);
    if (am && am.index !== undefined && !code.trimStart().startsWith("|")) {
      head = code.slice(0, am.index);
      arrow = am[0];
      body = code.slice(am.index + arrow.length);
    }
    if (head) spans.push({ text: head, cls: "text-nonterminal font-semibold" });
    if (arrow) spans.push({ text: arrow, cls: "text-fg-subtle" });
    const re = /('[^']+'|"[^"]+"|\||\s+|[^\s|]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const t = m[0];
      if (/^\s+$/.test(t)) spans.push({ text: t });
      else if (t === "|") spans.push({ text: t, cls: "text-accent font-semibold" });
      else if (/^['"]/.test(t)) spans.push({ text: t, cls: "text-terminal" });
      else if (EPSILON_SPELLINGS.has(t)) spans.push({ text: t, cls: "text-fg-subtle italic" });
      else if (nonterminals.has(t)) spans.push({ text: t, cls: "text-nonterminal" });
      else spans.push({ text: t, cls: "text-terminal" });
    }
  }
  if (comment) spans.push({ text: comment, cls: "text-fg-subtle italic" });
  return spans;
}

export function GrammarEditor({
  value,
  onChange,
  onCommit,
  diagnostics,
  focusLine,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  diagnostics: Diagnostic[];
  focusLine: { line: number; nonce: number } | null;
}) {
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const preRef = React.useRef<HTMLPreElement>(null);
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const lines = value.split("\n");

  const nonterminals = React.useMemo(() => {
    const s = new Set<string>();
    for (const l of value.split("\n")) {
      const m = l.match(/^\s*([^\s|%#][^\s]*)\s*(::=|->|→)/);
      if (m) s.add(m[1]);
    }
    return s;
  }, [value]);

  const lineSeverity = React.useMemo(() => {
    const map = new Map<number, Diagnostic["severity"]>();
    for (const d of diagnostics) {
      if (!d.line) continue;
      const prev = map.get(d.line);
      if (!prev || d.severity === "error" || (d.severity === "warning" && prev === "info")) map.set(d.line, d.severity);
    }
    return map;
  }, [diagnostics]);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) preRef.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
  };

  React.useEffect(() => {
    if (!focusLine || !taRef.current) return;
    const ta = taRef.current;
    const offs = value.split("\n").slice(0, focusLine.line - 1).join("\n").length + (focusLine.line > 1 ? 1 : 0);
    ta.focus();
    ta.setSelectionRange(offs, offs + (lines[focusLine.line - 1]?.length ?? 0));
    ta.scrollTop = Math.max(0, (focusLine.line - 4) * 24);
    syncScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLine]);

  return (
    <div className="relative flex h-[300px] overflow-hidden rounded-lg sm:h-[420px] border border-border bg-bg-elevated font-mono text-[0.8125rem] leading-6 focus-within:border-accent/60">
      <div className="relative w-11 shrink-0 overflow-hidden border-r border-border bg-panel-2 text-right text-fg-subtle select-none">
        <div ref={gutterRef} className="py-3 pr-2">
          {lines.map((_, i) => {
            const sev = lineSeverity.get(i + 1);
            return (
              <div
                key={i}
                className={cn(
                  "relative tabular-nums",
                  sev === "error" && "text-danger",
                  sev === "warning" && "text-warning",
                )}
              >
                {sev && <span className={cn("absolute left-1.5 top-[9px] size-1.5 rounded-full", sev === "error" ? "bg-danger" : sev === "warning" ? "bg-warning" : "bg-info")} />}
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <pre ref={preRef} aria-hidden className="pointer-events-none absolute left-0 top-0 m-0 min-w-full p-3 whitespace-pre">
          {lines.map((l, i) => {
            const sev = lineSeverity.get(i + 1);
            return (
              <div key={i} className={cn("-mx-3 px-3", sev === "error" && "bg-danger-bg", sev === "warning" && "bg-warning-bg")}>
                {highlightLine(l, nonterminals).map((s, k) => (
                  <span key={k} className={s.cls}>
                    {s.text}
                  </span>
                ))}
                {"​"}
              </div>
            );
          })}
        </pre>
        <textarea
          ref={taRef}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          aria-label="Grammar source"
          onScroll={syncScroll}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onCommit();
            } else if (e.key === "Tab") {
              e.preventDefault();
              const ta = e.currentTarget;
              const { selectionStart: a, selectionEnd: b } = ta;
              const next = value.slice(0, a) + "  " + value.slice(b);
              onChange(next);
              requestAnimationFrame(() => ta.setSelectionRange(a + 2, a + 2));
            }
          }}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-3 text-transparent caret-fg whitespace-pre outline-none selection:bg-accent/30"
          style={{ caretColor: "var(--fg)" }}
        />
      </div>
    </div>
  );
}
