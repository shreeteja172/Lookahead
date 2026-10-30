import type { Metadata } from "next";
import { FirstFollowView } from "@/components/views/first-follow-view";

export const metadata: Metadata = { title: "FIRST and FOLLOW" };

export default function Page() {
  return <FirstFollowView />;
}
