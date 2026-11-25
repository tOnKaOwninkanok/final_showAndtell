import type { Metadata } from "next";
import EventsManager from "@/components/EventsManager";

export const metadata: Metadata = {
  title: "My Events | Countdown Holidays App",
  description: "Save your own event dates and details.",
};

export default function EventsPage() {
  return <EventsManager />;
}
