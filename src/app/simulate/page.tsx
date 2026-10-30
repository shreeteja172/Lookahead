import type { Metadata } from "next";
import { SimulateView } from "@/components/views/simulate-view";

export const metadata: Metadata = { title: "Parse an input" };

export default function Page() {
  return <SimulateView />;
}
