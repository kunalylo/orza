import type { Metadata } from "next";
import { CalendarView } from "@/components/care/calendar/CalendarView";

export const metadata: Metadata = { title: "Calendar" };

/** Calendar — month/week view of medicine doses, reminders and meals, the phone-calendar feed, and the user's own calendar. */
export default function CalendarPage() {
  return <CalendarView />;
}
