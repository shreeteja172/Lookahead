import {
  BookOpen,
  FileCode2,
  GitCompare,
  House,
  ListOrdered,
  Network,
  Play,
  Sigma,
  Table2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Position in the teaching sequence (grammar → parse), if part of it. */
  step?: number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Start",
    items: [
      { href: "/", label: "Overview", icon: House, description: "What this grammar is and where to go next" },
      { href: "/learn", label: "Concepts guide", icon: BookOpen, description: "CFGs and LR parsing explained, with your grammar as the example" },
    ],
  },
  {
    title: "Build a parser",
    items: [
      { href: "/grammar", label: "Grammar", icon: FileCode2, description: "Write and validate a context-free grammar", step: 1 },
      { href: "/first-follow", label: "FIRST & FOLLOW", icon: Sigma, description: "The sets every LR table depends on", step: 2 },
      { href: "/automaton", label: "LR automaton", icon: Network, description: "Item sets and GOTO transitions", step: 3 },
      { href: "/tables", label: "Parsing table", icon: Table2, description: "ACTION and GOTO, cell by cell", step: 4 },
      { href: "/simulate", label: "Parse an input", icon: Play, description: "Shift-reduce parsing step by step", step: 5 },
    ],
  },
  {
    title: "Analyse",
    items: [
      { href: "/compare", label: "Compare parsers", icon: GitCompare, description: "SLR vs CLR vs LALR on the same grammar" },
      { href: "/conflicts", label: "Conflicts", icon: TriangleAlert, description: "Why a table is not deterministic" },
      { href: "/algorithms", label: "Step-through algorithms", icon: ListOrdered, description: "Replay every construction step" },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
