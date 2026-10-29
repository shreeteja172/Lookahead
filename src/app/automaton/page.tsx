import type { Metadata } from "next";
import { AutomatonView } from "@/components/views/automaton-view";

export const metadata: Metadata = { title: "LR Automaton" };

export default function Page() {
  return <AutomatonView />;
}
