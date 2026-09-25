import type { Metadata } from "next";
import { HealthView } from "@/components/care/health/HealthView";

export const metadata: Metadata = { title: "Health sync" };

/** Health sync — Apple Health / Health Connect data via export import, automation apps (sync token) and CSV; charts and sources. */
export default function HealthPage() {
  return <HealthView />;
}
