import type { Metadata } from "next";
import { AlgorithmsView } from "@/components/views/algorithms-view";

export const metadata: Metadata = { title: "Algorithm Explorer" };

export default function Page() {
  return <AlgorithmsView />;
}
