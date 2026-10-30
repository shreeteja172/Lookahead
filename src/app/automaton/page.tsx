import type { Metadata } from "next";
import { AutomatonView } from "@/components/views/automaton-view";

export const metadata: Metadata = { title: "LR automaton" };

export default function Page() {
  return <AutomatonView />;
}
