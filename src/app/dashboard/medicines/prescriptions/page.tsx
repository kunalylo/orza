import type { Metadata } from "next";
import { PrescriptionsView } from "@/components/care/meds/PrescriptionsView";

export const metadata: Metadata = { title: "Scan a prescription" };

/** Prescription photo → AI read → review → automatic medicine alarms; manual entry when AI is off; history. */
export default function PrescriptionsPage() {
  return <PrescriptionsView />;
}
