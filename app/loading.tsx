import styles from "@/components/HomeDashboard.module.css";

export default function Loading() {
  return <main className={styles.loading} role="status">Getting your calendar ready…</main>;
}
