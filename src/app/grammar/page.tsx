import type { Metadata } from "next";
import { GrammarView } from "@/components/views/grammar-view";

export const metadata: Metadata = { title: "Grammar Workbench" };

export default function Page() {
  return <GrammarView />;
}
