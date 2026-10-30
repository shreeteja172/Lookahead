import type { Metadata } from "next";
import { TablesView } from "@/components/views/tables-view";

export const metadata: Metadata = { title: "Parsing table" };

export default function Page() {
  return <TablesView />;
}
