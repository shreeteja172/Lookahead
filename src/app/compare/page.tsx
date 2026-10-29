import type { Metadata } from "next";
import { CompareView } from "@/components/views/compare-view";

export const metadata: Metadata = { title: "Parser Comparison" };

export default function Page() {
  return <CompareView />;
}
