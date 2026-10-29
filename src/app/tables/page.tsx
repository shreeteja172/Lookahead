import type { Metadata } from "next";
import { TablesView } from "@/components/views/tables-view";

export const metadata: Metadata = { title: "Parsing Tables" };

export default function Page() {
  return <TablesView />;
}
