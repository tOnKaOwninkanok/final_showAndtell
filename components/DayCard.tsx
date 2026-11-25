import { formatCalendarDate } from "@/lib/calendar";
import type { UpcomingDay } from "@/types/calendar";
import styles from "./HomeDashboard.module.css";

export default function DayCard({ day }: { day: UpcomingDay }) {
  const isEvent = day.kind === "event";
  const longDetails = isEvent && day.title.length > 110;
  return (
    <article className={`${styles.dayCard} ${isEvent ? styles.eventCard : ""}`}>
      <div className={styles.cardTop}>
        <span className={`${styles.badge} ${isEvent ? styles.eventBadge : ""}`}><span aria-hidden="true">{isEvent ? "✦" : "◷"}</span>{isEvent ? "My event" : "Bank holiday"}</span>
        <time className={styles.dateTile} dateTime={day.date} aria-label={formatCalendarDate(day.date, { dateStyle: "full" })}>
          <span>{formatCalendarDate(day.date, { month: "short" })}</span>
          <strong>{day.date.slice(8)}</strong>
        </time>
      </div>
      <div className={styles.cardCountdown}>
        {day.daysUntil === 0 ? <><strong className={styles.todayLabel}>Today!</strong><span>The day is here</span></> : <><strong>{String(day.daysUntil).padStart(2, "0")}</strong><span>{day.daysUntil === 1 ? "day" : "days"} to go</span></>}
      </div>
      <div className={styles.cardContent}>
      <h3>{longDetails ? `${day.title.slice(0, 107).trimEnd()}…` : day.title}</h3>
      <p className={styles.cardDate}>{formatCalendarDate(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      {!isEvent && <p className={styles.region}>{day.regions.length ? day.regions.join(", ") : "Nationwide"}{day.tentative ? " · Tentative date" : ""}</p>}
      {longDetails && <details className={styles.details}><summary>Full event details</summary><p>{day.title}</p></details>}
      </div>
    </article>
  );
}
