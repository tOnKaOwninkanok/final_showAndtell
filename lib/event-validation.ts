import type { EventInput } from "../types/event";

export const MAX_EVENT_DETAILS = 2000;

type ValidationResult =
  | { ok: true; value: EventInput }
  | { ok: false; error: string };

export function validateEventInput(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Enter an event date and details." };
  }

  const { date, details } = input as Record<string, unknown>;

  // A date-only value keeps the chosen day unchanged in every time zone.
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date.startsWith("0000-")
  ) {
    return { ok: false, error: "Choose a valid event date." };
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return { ok: false, error: "Choose a valid event date." };
  }

  if (typeof details !== "string" || !details.trim()) {
    return { ok: false, error: "Enter the event details." };
  }

  if (details.trim().length > MAX_EVENT_DETAILS) {
    return {
      ok: false,
      error: `Keep event details within ${MAX_EVENT_DETAILS} characters.`,
    };
  }

  return { ok: true, value: { date, details: details.trim() } };
}
