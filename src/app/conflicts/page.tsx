import type { Metadata } from "next";
import { ConflictsView } from "@/components/views/conflicts-view";

export const metadata: Metadata = { title: "Conflict Analyzer" };

export default function Page() {
  return <ConflictsView />;
}
