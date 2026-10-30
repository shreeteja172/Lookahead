import type { Metadata } from "next";
import { AlgorithmsView } from "@/components/views/algorithms-view";

export const metadata: Metadata = { title: "Step-through algorithms" };

export default function Page() {
  return <AlgorithmsView />;
}
