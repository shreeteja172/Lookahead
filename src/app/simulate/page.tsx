import type { Metadata } from "next";
import { SimulateView } from "@/components/views/simulate-view";

export const metadata: Metadata = { title: "Simulation Studio" };

export default function Page() {
  return <SimulateView />;
}
