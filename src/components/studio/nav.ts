import {
  FileCode2,
  GitCompare,
  LayoutDashboard,
  Microscope,
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
  short: string;
  icon: LucideIcon;
  description: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutDashboard, description: "Capability report and parser summary" },
  { href: "/grammar", label: "Grammar Workbench", short: "Grammar", icon: FileCode2, description: "Edit, validate and load sample grammars" },
  { href: "/first-follow", label: "FIRST / FOLLOW", short: "Sets", icon: Sigma, description: "Nullable, FIRST and FOLLOW with derivations" },
  { href: "/automaton", label: "LR Automaton", short: "Automaton", icon: Network, description: "Interactive item-set state machines" },
  { href: "/tables", label: "Parsing Tables", short: "Tables", icon: Table2, description: "ACTION / GOTO tables with explanations" },
  { href: "/simulate", label: "Simulation Studio", short: "Simulate", icon: Play, description: "Step-by-step shift-reduce parsing" },
  { href: "/compare", label: "Parser Comparison", short: "Compare", icon: GitCompare, description: "SLR vs CLR vs LALR side by side" },
  { href: "/conflicts", label: "Conflict Analyzer", short: "Conflicts", icon: TriangleAlert, description: "Why each conflict happens" },
  { href: "/algorithms", label: "Algorithm Explorer", short: "Algorithms", icon: Microscope, description: "Replay every construction step" },
];
