"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { calendarDate, formatCalendarDate, upcomingDays } from "@/lib/calendar";
import type { CalendarDay } from "@/types/calendar";
import CalendarIcon from "./CalendarIcon";
import DayCard from "./DayCard";
import CountryPicker from "./CountryPicker";
import styles from "./HomeDashboard.module.css";

type Props = {
  country: string;
  countryName: string;
  countryOptions: { code: string; name: string }[];
  autoLocate: boolean;
  initialToday: string;
  holidays: CalendarDay[];
  events: CalendarDay[];
  holidayError?: string;
  eventError?: string;
  countryNotice?: string;
};

function subscribeToDateChange(update: () => void) {
  const timer = window.setInterval(update, 1000);
  window.addEventListener("focus", update);
  return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
}

export default function HomeDashboard({ country, countryName, countryOptions, autoLocate, initialToday, holidays, events, holidayError, eventError, countryNotice }: Props) {
  const router = useRouter();
  const today = useSyncExternalStore(subscribeToDateChange, calendarDate, () => initialToday);
  const [filter, setFilter] = useState<"all" | "holiday" | "event">("all");
  const [isRefreshing, startRefresh] = useTransition();
  const days = upcomingDays([...holidays, ...events], today);
  const holidayCount = days.filter((day) => day.kind === "holiday").length;
  const eventCount = days.filter((day) => day.kind === "event").length;
  const visibleDays = days.filter((day) => filter === "all" || day.kind === filter);
  const nextDay = days[0];
  const year = today.slice(0, 4);

  useEffect(() => {
    // Reload the holiday year and upcoming events when the Bangkok date changes.
    if (today !== initialToday) router.refresh();
  }, [today, initialToday, router]);

  return (
    <main className={styles.page}>
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>YOUR PERSONAL CALENDAR</p>
          <h1>My countdowns<span className={styles.headingDot}>.</span></h1>
          <p className={styles.subtitle}>A place for all the days you look forward to.</p>
        </div>
        <Link className={styles.addButton} href="/events"><span aria-hidden="true">+</span> Add an event</Link>
      </div>

      <div className={styles.summaryGrid}>
        <section className={styles.todayCard} aria-label="Today's date">
          <div className={styles.boxHeading}><span className={styles.boxIcon}><CalendarIcon /></span><h2>Today</h2><span className={styles.yearBadge}>{year}</span></div>
          <div className={styles.todayDate}>
            <strong className={styles.todayNumber}>{today.slice(8)}</strong>
            <div><p className={styles.todayWeekday}>{formatCalendarDate(today, { weekday: "long" })}</p>
              <time dateTime={today}>{formatCalendarDate(today, { month: "long", year: "numeric" })}</time></div>
          </div>
          <p className={styles.timezone}>Bangkok time · UTC+7</p>
        </section>
        <section className={styles.nextCard} aria-labelledby="next-day-title">
          <div className={styles.boxHeading}><span className={styles.boxIcon} aria-hidden="true">✦</span><h2>Up next</h2></div>
          <div className={styles.nextContent}>
            <h3 id="next-day-title">{nextDay ? (nextDay.title.length > 75 ? `${nextDay.title.slice(0, 72).trimEnd()}…` : nextDay.title) : "Make your next plan"}</h3>
            {nextDay ? <>
              <p className={styles.nextDate}>{formatCalendarDate(nextDay.date, { day: "numeric", month: "long", year: "numeric" })}{nextDay.regions.length > 0 ? " · Regional" : ""}{nextDay.tentative ? " · Tentative" : ""}</p>
            </> : <p className={styles.nextDate}>{holidayError || eventError ? "Some dates are unavailable. You can refresh or add a new event." : "Add an event and give yourself something to look forward to."}</p>}
            {(holidayError || eventError) && nextDay && <p className={styles.partialNote}>Based on the dates currently available.</p>}
          </div>
          <div className={styles.heroCountdown} aria-label={nextDay ? (nextDay.daysUntil === 0 ? "Happening today" : `${nextDay.daysUntil} days to go`) : "No upcoming dates"}>
            <strong>{nextDay ? (nextDay.daysUntil === 0 ? "Today" : nextDay.daysUntil) : "✦"}</strong>
            <span>{nextDay ? (nextDay.daysUntil === 0 ? "the day is here" : nextDay.daysUntil === 1 ? "day to go" : "days to go") : "Add your first event"}</span>
          </div>
        </section>
        <section className={styles.overviewCard} aria-labelledby="overview-title">
          <div className={styles.boxHeading}><span className={styles.boxIcon}><CalendarIcon /></span><h2 id="overview-title">On your calendar</h2></div>
          <div className={styles.calendarSummary}>
            <div><strong>{holidayError ? "—" : holidayCount}</strong><span>Countdown Holidays</span></div>
            <div><strong>{eventError ? "—" : eventCount}</strong><span>My events</span></div>
          </div>
          <p className={styles.summaryNote}>Upcoming dates · {countryName}</p>
        </section>
      </div>

      {countryNotice && <p className={styles.notice} role="status">{countryNotice}</p>}
      {(holidayError || eventError) && <div className={styles.error} role="alert">
        {holidayError && <p>{holidayError}</p>}
        {eventError && <p>{eventError}</p>}
        <button type="button" onClick={() => startRefresh(() => router.refresh())} disabled={isRefreshing}>{isRefreshing ? "Retrying…" : "Try again"}</button>
      </div>}

      <section className={styles.upcoming} aria-labelledby="upcoming-heading" aria-busy={isRefreshing}>
        <div className={styles.sectionHeading}>
          <div><h2 id="upcoming-heading">Your upcoming days <span className={styles.totalBadge}>{days.length}</span></h2><p>Every date has its own little space.</p></div>
          <button className={styles.refreshButton} type="button" onClick={() => startRefresh(() => router.refresh())} disabled={isRefreshing}>{isRefreshing ? "Refreshing…" : "Refresh dates"}</button>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.filters} role="group" aria-label="Filter upcoming dates">
          {([ ["all", "All dates", days.length], ["holiday", "Countdown Holidays", holidayCount], ["event", "My events", eventCount] ] as const).map(([value, label, count]) => (
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={filter === value ? styles.activeFilter : ""}>
              {label}<span>{count}</span>
            </button>
          ))}
          </div>
          <CountryPicker country={country} countries={countryOptions} autoLocate={autoLocate} />
        </div>
        <p className={styles.listContext} aria-live="polite">{visibleDays.length} upcoming {visibleDays.length === 1 ? "date" : "dates"}{filter !== "event" ? ` · ${countryName} holidays in ${year}` : " · Your saved events, across all countries"}</p>
        {visibleDays.length > 0 ? (
          <div className={styles.cardGrid}>
            {visibleDays.map((day) => <DayCard key={day.id} day={day} />)}
            {filter !== "holiday" && <Link href="/events" className={styles.addCard}>
              <span className={styles.addCardIcon} aria-hidden="true">+</span>
              <strong>A day to look forward to</strong>
              <span>Add a birthday, a trip, or your next plan.</span>
              <span className={styles.addCardLabel}>Create an event</span>
            </Link>}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><CalendarIcon /></span>
            <h3>{(filter !== "event" && holidayError) || (filter !== "holiday" && eventError) ? "Some dates are unavailable" : filter === "holiday" ? `No more Countdown Holidays in ${year}` : "Your next countdown starts here"}</h3>
            <p>{filter === "holiday" ? "Choose another country or check your saved events." : "Add an upcoming event to see it on your calendar. Past events are still available in My events."}</p>
            {filter !== "holiday" && <Link href="/events" className={styles.emptyLink}>Add an event</Link>}
          </div>
        )}
      </section>
      <footer className={styles.footnote}>
        <span>Countdowns use calendar days in Bangkok time. Your events appear for every country.</span>
        <span>Countdown Holidays · {year} · <a href="https://api-ninjas.com/api/bankholidays" target="_blank" rel="noreferrer">API Ninjas</a></span>
      </footer>
    </main>
  );
}

