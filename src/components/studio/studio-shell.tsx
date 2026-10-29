"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CircleAlert,
  CircleHelp,
  Download,
  FileJson,
  FolderOpen,
  History,
  Keyboard,
  Menu,
  Moon,
  Plus,
  Search,
  Share2,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { METHODS } from "@/lib/engine";
import { useStudio } from "@/lib/studio/store";
import { decodeSnapshot, encodeSnapshot, SHARE_PARAM } from "@/lib/studio/share";
import { buildReport } from "@/lib/studio/export";
import { SITE } from "@/lib/site";
import { cn, copyText, downloadText, slugify } from "@/lib/utils";
import { Badge, Button, Kbd } from "@/components/ui/primitives";
import { MenuItem, Popover } from "@/components/ui/overlay";
import { NAV } from "./nav";
import { CommandPalette } from "./command-palette";
import { ShortcutsDialog, Tutorial } from "./help-dialogs";
import { GrammarProvider, METHOD_META } from "./symbols";

const subscribeNoop = () => () => {};
/** False during SSR and hydration, true afterwards — gates persisted client state. */
function useHydrated() {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <ShellSkeleton />;
  return <Shell>{children}</Shell>;
}

function ShellSkeleton() {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg">
      <div className="flex items-center gap-3 text-sm text-fg-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        Loading {SITE.name}…
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useStudio((s) => s.theme);
  const tutorialSeen = useStudio((s) => s.tutorialSeen);
  const setTutorialSeen = useStudio((s) => s.setTutorialSeen);
  const grammar = useStudio((s) => s.result.analysis?.grammar ?? null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(!tutorialSeen);
  const [mobileNav, setMobileNav] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("lookahead-theme", theme);
    } catch {}
  }, [theme]);

  // Load a shared snapshot from the URL fragment (#s=…), then clean the URL.
  React.useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const encoded = hash.get(SHARE_PARAM);
    if (!encoded) return;
    const snap = decodeSnapshot(encoded);
    if (snap) {
      useStudio.getState().loadProject({ name: snap.name, source: snap.source, input: snap.input, start: snap.start, policy: snap.policy });
    }
    history.replaceState(null, "", window.location.pathname);
  }, []);

  // Autosave the current project into the recent-projects list.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStudio.subscribe((s, prev) => {
      if (s.source === prev.source && s.input === prev.input && s.projectName === prev.projectName && s.startOverride === prev.startOverride) return;
      clearTimeout(timer);
      timer = setTimeout(() => useStudio.getState().saveCurrent(), 1500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) {
        const n = NAV[Number(e.code.slice(5)) - 1];
        if (n) {
          e.preventDefault();
          router.push(n.href);
        }
        return;
      }
      if (e.key === "?" && !isTyping(e)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const closeTour = () => {
    setTourOpen(false);
    setTutorialSeen(true);
  };

  return (
    <GrammarProvider grammar={grammar}>
      <div className="flex h-dvh overflow-hidden bg-bg text-fg">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-elevated lg:flex">
          <Sidebar pathname={pathname} />
        </aside>
        <AnimatePresence>
          {mobileNav && (
            <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNav(false)} />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "tween", duration: 0.18 }}
                className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-bg-elevated"
              >
                <Sidebar pathname={pathname} onNavigate={() => setMobileNav(false)} />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <Toolbar
            onMenu={() => setMobileNav(true)}
            onSearch={() => setPaletteOpen(true)}
            onShortcuts={() => setShortcutsOpen(true)}
            onTour={() => setTourOpen(true)}
          />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Tutorial open={tourOpen} onClose={closeTour} />
    </GrammarProvider>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-accent/15 stroke-accent/50" strokeWidth="1" />
      <circle cx="10" cy="16" r="3.2" className="fill-accent" />
      <circle cx="22" cy="10" r="2.6" className="fill-lalr" />
      <circle cx="22" cy="22" r="2.6" className="fill-clr" />
      <path d="M13 15 L19.5 11 M13 17 L19.5 21" className="stroke-fg-muted" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const result = useStudio((s) => s.result);
  const errors = result.parse.diagnostics.filter((d) => d.severity === "error").length;
  const conflicts = result.analysis?.diagnoses.length ?? 0;
  return (
    <>
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <Logo />
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">{SITE.name}</div>
          <div className="truncate text-[11px] text-fg-subtle">{SITE.tagline}</div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} className="ml-auto rounded p-1 text-fg-subtle hover:text-fg cursor-pointer" aria-label="Close menu">
            <X className="size-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV.map((n, i) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={cn(
                "group relative mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active ? "bg-highlight-bg text-fg" : "text-fg-muted hover:bg-panel-2 hover:text-fg",
              )}
            >
              {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />}
              <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} />
              <span className="flex-1 truncate">{n.label}</span>
              {n.href === "/grammar" && errors > 0 && <Badge tone="danger">{errors}</Badge>}
              {n.href === "/conflicts" && conflicts > 0 && <Badge tone="danger">{conflicts}</Badge>}
              <Kbd className="hidden opacity-0 group-hover:opacity-100 xl:inline-flex">{i + 1}</Kbd>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-[11px] leading-relaxed text-fg-subtle">
        <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1">
          <span><span className="text-nonterminal">■</span> nonterminal</span>
          <span><span className="text-terminal">■</span> terminal</span>
          <span><span className="text-state">■</span> state</span>
          <span><span className="text-conflict">■</span> conflict</span>
        </div>
        Compiler Design Lab · <a className="hover:text-fg" href={SITE.repo} target="_blank" rel="noreferrer">source</a>
      </div>
    </>
  );
}

function Toolbar({
  onMenu,
  onSearch,
  onShortcuts,
  onTour,
}: {
  onMenu: () => void;
  onSearch: () => void;
  onShortcuts: () => void;
  onTour: () => void;
}) {
  const s = useStudio();
  const analysis = s.result.analysis;
  const errors = s.result.parse.diagnostics.filter((d) => d.severity === "error").length;
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    const encoded = encodeSnapshot({ name: s.projectName, source: s.source, input: s.input, start: s.startOverride, policy: s.policy });
    const url = `${window.location.origin}${window.location.pathname}#${SHARE_PARAM}=${encoded}`;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } else {
      window.prompt("Copy this link", url);
    }
  };

  const exportReport = () => {
    if (!analysis) return;
    downloadText(
      `${slugify(s.projectName)}-report.md`,
      buildReport(analysis, { name: s.projectName, source: s.source, diagnostics: s.result.parse.diagnostics }),
      "text/markdown",
    );
  };

  const exportProject = () =>
    downloadText(
      `${slugify(s.projectName)}.lookahead.json`,
      JSON.stringify({ v: 1, name: s.projectName, source: s.source, input: s.input, start: s.startOverride, policy: s.policy }, null, 2),
      "application/json",
    );

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg-elevated/80 px-3 backdrop-blur sm:px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <input
        value={s.projectName}
        onChange={(e) => s.setProjectName(e.target.value)}
        aria-label="Project name"
        className="w-28 min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-fg hover:border-border focus:border-accent focus:outline-none sm:w-56"
      />
      <div className="hidden items-center gap-1.5 md:flex">
        {errors > 0 ? (
          <Badge tone="danger">
            <CircleAlert /> {errors} error{errors > 1 ? "s" : ""}
          </Badge>
        ) : s.result.error ? (
          <Badge tone="danger">
            <CircleAlert /> too many states
          </Badge>
        ) : (
          analysis &&
          METHODS.map((m) => {
            const ok = analysis.tables[m].conflicts.length === 0;
            return (
              <Badge key={m} tone={ok ? METHOD_META[m].tone : "danger"} title={ok ? `${m}: conflict-free` : `${m}: ${analysis.tables[m].conflicts.length} conflicts`}>
                {ok ? <Check /> : <X />} {m}
              </Badge>
            );
          })
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onSearch} className="hidden gap-2 text-fg-muted sm:inline-flex">
          <Search /> <span className="hidden md:inline">Search</span> <Kbd>Ctrl K</Kbd>
        </Button>
        <Button variant="ghost" size="icon" onClick={onSearch} className="sm:hidden" aria-label="Search">
          <Search />
        </Button>
        <Popover
          trigger={({ toggle }) => (
            <Button variant="ghost" size="icon" onClick={toggle} title="Projects" aria-label="Projects">
              <FolderOpen />
            </Button>
          )}
        >
          {(close) => <ProjectsMenu close={close} onExport={exportProject} />}
        </Popover>
        <Button variant="ghost" size="icon" onClick={share} title="Copy shareable link" aria-label="Share">
          {copied ? <Check className="text-accept" /> : <Share2 />}
        </Button>
        <Button variant="ghost" size="icon" onClick={exportReport} disabled={!analysis} title="Download Markdown report" aria-label="Download report">
          <Download />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => s.setTheme(s.theme === "dark" ? "light" : "dark")}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {s.theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <Popover
          trigger={({ toggle }) => (
            <Button variant="ghost" size="icon" onClick={toggle} title="Help" aria-label="Help">
              <CircleHelp />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem onClick={() => (close(), onTour())}>
                <CircleHelp /> Guided tour
              </MenuItem>
              <MenuItem onClick={() => (close(), onShortcuts())}>
                <Keyboard /> Keyboard shortcuts <Kbd className="ml-auto">?</Kbd>
              </MenuItem>
            </>
          )}
        </Popover>
      </div>
    </header>
  );
}

function ProjectsMenu({ close, onExport }: { close: () => void; onExport: () => void }) {
  const projects = useStudio((s) => s.projects);
  const projectId = useStudio((s) => s.projectId);
  const loadProject = useStudio((s) => s.loadProject);
  const newProject = useStudio((s) => s.newProject);
  const deleteProject = useStudio((s) => s.deleteProject);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  const importFile = async (f: File) => {
    try {
      const obj = JSON.parse(await f.text());
      if (typeof obj?.source !== "string") throw new Error("missing source");
      loadProject({
        name: typeof obj.name === "string" ? obj.name.slice(0, 120) : f.name,
        source: obj.source.slice(0, 40_000),
        input: typeof obj.input === "string" ? obj.input.slice(0, 4000) : "",
        start: typeof obj.start === "string" ? obj.start : "",
        policy: obj.policy === "prefer-shift" ? "prefer-shift" : "halt",
      });
      close();
      router.push("/grammar");
    } catch {
      alert("That file is not a Lookahead project (expected JSON with a \"source\" field).");
    }
  };

  return (
    <div className="w-72">
      <MenuItem
        onClick={() => {
          newProject();
          close();
          router.push("/grammar");
        }}
      >
        <Plus /> New grammar
      </MenuItem>
      <MenuItem onClick={() => fileRef.current?.click()}>
        <FolderOpen /> Import project file…
      </MenuItem>
      <MenuItem onClick={() => (onExport(), close())}>
        <FileJson /> Export project file
      </MenuItem>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
      />
      <div className="my-1 border-t border-border" />
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] uppercase tracking-wider text-fg-subtle">
        <History className="size-3" /> Recent (saved in this browser)
      </div>
      {projects.length === 0 && <div className="px-2 py-2 text-xs text-fg-subtle">Projects are saved automatically as you edit.</div>}
      <div className="max-h-64 overflow-y-auto">
        {projects.map((p) => (
          <div key={p.id} className="group flex items-center">
            <MenuItem
              className={cn("flex-1 min-w-0", p.id === projectId && "text-accent")}
              onClick={() => {
                loadProject(p);
                close();
              }}
            >
              <span className="truncate">{p.name}</span>
              <span className="ml-auto shrink-0 text-[11px] text-fg-subtle">{new Date(p.updatedAt).toLocaleDateString()}</span>
            </MenuItem>
            {p.id !== projectId && (
              <button
                onClick={() => deleteProject(p.id)}
                className="mr-1 rounded p-1 text-fg-subtle opacity-0 hover:text-conflict group-hover:opacity-100 cursor-pointer"
                aria-label={`Delete ${p.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
