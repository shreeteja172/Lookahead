"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  analyzeGrammar,
  DEFAULT_SAMPLE,
  type AnalyzeResult,
  type ConflictPolicy,
  type ParserMethod,
} from "@/lib/engine";

export interface SavedProject {
  id: string;
  name: string;
  source: string;
  input: string;
  start: string;
  updatedAt: number;
}

/** Cross-view focus: lets one view ask another to reveal a state or cell. */
export interface Focus {
  method: ParserMethod;
  state?: number;
  symbol?: string;
  nonce: number;
}

interface StudioState {
  projectId: string;
  projectName: string;
  source: string;
  startOverride: string;
  input: string;
  policy: ConflictPolicy;
  method: ParserMethod;
  theme: "dark" | "light";
  tutorialSeen: boolean;
  projects: SavedProject[];

  /** Derived; never persisted. Recomputed from `source` + `startOverride`. */
  result: AnalyzeResult;
  focus: Focus | null;

  setSource: (source: string) => void;
  setStartOverride: (start: string) => void;
  setInput: (input: string) => void;
  setPolicy: (p: ConflictPolicy) => void;
  setMethod: (m: ParserMethod) => void;
  setProjectName: (name: string) => void;
  setTheme: (t: "dark" | "light") => void;
  setTutorialSeen: (v: boolean) => void;
  loadProject: (p: Omit<SavedProject, "id" | "updatedAt"> & { id?: string; policy?: ConflictPolicy }) => void;
  newProject: () => void;
  deleteProject: (id: string) => void;
  saveCurrent: () => void;
  reveal: (f: Omit<Focus, "nonce">) => void;
}

const run = (source: string, start: string): AnalyzeResult =>
  analyzeGrammar(source, { startOverride: start || undefined });

const newId = () => Math.random().toString(36).slice(2, 10);

const MAX_PROJECTS = 12;

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      projectId: newId(),
      projectName: DEFAULT_SAMPLE.title,
      source: DEFAULT_SAMPLE.source,
      startOverride: "",
      input: DEFAULT_SAMPLE.inputs[0].text,
      policy: "halt",
      method: "LALR",
      theme: "dark",
      tutorialSeen: false,
      projects: [],
      result: run(DEFAULT_SAMPLE.source, ""),
      focus: null,

      setSource: (source) => {
        const { startOverride } = get();
        let result = run(source, startOverride);
        // Drop a start override that no longer names a nonterminal.
        if (startOverride && !result.parse.grammar && result.parse.diagnostics.some((d) => d.code === "bad-start" && d.line === 0)) {
          result = run(source, "");
          set({ source, result, startOverride: "" });
          return;
        }
        set({ source, result });
      },
      setStartOverride: (startOverride) => set({ startOverride, result: run(get().source, startOverride) }),
      setInput: (input) => set({ input }),
      setPolicy: (policy) => set({ policy }),
      setMethod: (method) => set({ method }),
      setProjectName: (projectName) => set({ projectName }),
      setTheme: (theme) => set({ theme }),
      setTutorialSeen: (tutorialSeen) => set({ tutorialSeen }),
      loadProject: (p) => {
        get().saveCurrent();
        set({
          projectId: p.id ?? newId(),
          projectName: p.name,
          source: p.source,
          input: p.input,
          startOverride: p.start,
          policy: p.policy ?? get().policy,
          result: run(p.source, p.start),
          focus: null,
        });
      },
      newProject: () =>
        get().loadProject({ name: "Untitled grammar", source: "S -> a S b | ε", input: "a a b b", start: "" }),
      deleteProject: (id) => set({ projects: get().projects.filter((p) => p.id !== id) }),
      saveCurrent: () => {
        const s = get();
        const entry: SavedProject = {
          id: s.projectId,
          name: s.projectName,
          source: s.source,
          input: s.input,
          start: s.startOverride,
          updatedAt: Date.now(),
        };
        const rest = s.projects.filter((p) => p.id !== s.projectId);
        set({ projects: [entry, ...rest].slice(0, MAX_PROJECTS) });
      },
      reveal: (f) => set({ focus: { ...f, nonce: Date.now() }, method: f.method }),
    }),
    {
      name: "lookahead-studio",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only user inputs persist; every parser artefact is recomputed from them.
      partialize: (s) => ({
        projectId: s.projectId,
        projectName: s.projectName,
        source: s.source,
        startOverride: s.startOverride,
        input: s.input,
        policy: s.policy,
        method: s.method,
        theme: s.theme,
        tutorialSeen: s.tutorialSeen,
        projects: s.projects,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>;
        const merged = { ...current, ...p };
        if (typeof merged.source !== "string") merged.source = current.source;
        merged.result = run(merged.source, typeof merged.startOverride === "string" ? merged.startOverride : "");
        return merged;
      },
    },
  ),
);

export const useAnalysis = () => useStudio((s) => s.result.analysis);
