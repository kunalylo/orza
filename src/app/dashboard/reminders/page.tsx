import type { Metadata } from "next";
import { RemindersView } from "@/components/care/reminders/RemindersView";

export const metadata: Metadata = { title: "Reminders" };

/** Reminders & alarms — notifications on this device, WhatsApp, quiet hours and meal / water / weigh-in reminders. */
export default function RemindersPage() {
  return <RemindersView />;
}
