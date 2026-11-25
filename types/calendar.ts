export type CalendarDay = {
  id: string;
  title: string;
  date: string;
  kind: "holiday" | "event";
  regions: string[];
  tentative?: boolean;
};

export type UpcomingDay = CalendarDay & { daysUntil: number };
