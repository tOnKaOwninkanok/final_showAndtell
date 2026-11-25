import HomeDashboard from "@/components/HomeDashboard";
import { calendarDate, isCalendarDate } from "@/lib/calendar";
import { countries, resolveCountry } from "@/lib/countries";
import { getBankHolidays } from "@/lib/holidays";
import { getEventsCollection } from "@/lib/mongodb";
import type { CalendarDay } from "@/types/calendar";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const query = await searchParams;
  const country = resolveCountry(query.country);
  const today = calendarDate();
  const year = Number(today.slice(0, 4));
  const [holidays, savedEvents] = await Promise.all([
    getBankHolidays(country, year),
    loadUpcomingEvents(today),
  ]);

  return (
    <HomeDashboard
      country={country}
      countryName={countries.find((item) => item.code === country)!.name}
      countryOptions={countries}
      autoLocate={query.country === undefined}
      initialToday={today}
      holidays={holidays.days}
      events={savedEvents.days}
      holidayError={holidays.error}
      eventError={savedEvents.error}
      countryNotice={query.country !== undefined &&
        (typeof query.country !== "string" || query.country.toUpperCase() !== country)
        ? "That country code is not available. Showing United States instead."
        : undefined}
    />
  );
}

async function loadUpcomingEvents(today: string): Promise<{ days: CalendarDay[]; error?: string }> {
  try {
    const collection = await getEventsCollection();
    const documents = await collection
      .find({ date: { $gte: today } }, { projection: { date: 1, details: 1 } })
      .sort({ date: 1, _id: 1 })
      .toArray();
    const days: CalendarDay[] = documents
      .filter((event) => isCalendarDate(event.date) && typeof event.details === "string")
      .map((event) => ({
        id: `event-${event._id.toHexString()}`,
        title: event.details,
        date: event.date,
        kind: "event",
        regions: [],
      }));
    return { days };
  } catch {
    return { days: [], error: "Your events could not be loaded. Try refreshing in a moment." };
  }
}
