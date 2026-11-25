import "server-only";
import { isCalendarDate } from "./calendar";
import type { CalendarDay } from "@/types/calendar";

export async function getBankHolidays(country: string, year: number): Promise<{ days: CalendarDay[]; error?: string }> {
  const apiKey = process.env.API_NINJAS_KEY;
  if (!apiKey) return { days: [], error: "The holiday calendar is not configured yet. Your saved events are still available." };

  try {
    const query = new URLSearchParams({ country, year: String(year) });
    const response = await fetch(`https://api.api-ninjas.com/v1/bankholidays?${query}`, {
      headers: { "X-Api-Key": apiKey },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const error = response.status === 429
        ? "The holiday service has reached its usage limit. Please try again later."
        : response.status === 400
          ? `Bank holiday data is not available for this country in ${year}. Try another country.`
          : "Countdown Holidays could not be loaded. Try refreshing in a moment.";
      return { days: [], error };
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected holiday response");
    const days = new Map<string, CalendarDay>();
    for (const holiday of data) {
      if (!holiday || typeof holiday.name !== "string" || !isCalendarDate(holiday.date)) {
        throw new Error("Invalid holiday data");
      }
      if (!holiday.date.startsWith(`${year}-`)) continue;
      const regions = Array.isArray(holiday.regions)
        ? holiday.regions.filter((region: unknown): region is string => typeof region === "string").sort()
        : [];
      const id = `holiday-${country}-${holiday.holiday_id || holiday.name}-${holiday.date}-${regions.join(",")}`;
      days.set(id, {
        id, title: holiday.name, date: holiday.date, kind: "holiday", regions,
        tentative: holiday.status === "tentative",
      });
    }
    return { days: [...days.values()] };
  } catch {
    return { days: [], error: "Countdown Holidays could not be loaded. Try refreshing in a moment." };
  }
}
