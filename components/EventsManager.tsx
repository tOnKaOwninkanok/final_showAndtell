"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { MAX_EVENT_DETAILS, validateEventInput } from "@/lib/event-validation";
import type { EventInput, SavedEvent } from "@/types/event";
import styles from "./EventsManager.module.css";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

type ExportFormat = "ics" | "xlsx";

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" />
  </svg>;
}

async function fetchEvents(signal: AbortSignal): Promise<SavedEvent[]> {
  const response = await fetch("/api/events", { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.events)) throw new Error("Unable to load events");
  return data.events;
}

export default function EventsManager() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [details, setDetails] = useState("");
  const [events, setEvents] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedEvent | null>(null);
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [success, setSuccess] = useState("");
  const mutationRef = useRef(false);
  const draftBeforeEdit = useRef<EventInput | null>(null);
  const listRequest = useRef<AbortController | null>(null);
  const exportRequest = useRef<AbortController | null>(null);
  const dateInput = useRef<HTMLInputElement | null>(null);
  const deleteDialog = useRef<HTMLDialogElement | null>(null);
  const cancelDeleteButton = useRef<HTMLButtonElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement | null>(null);
  const busy = saving || deleting || exporting !== null;
  const exportDisabled = busy || loading || editingId !== null || !!listError;

  // The initial view already has loading=true. Only event handlers reset the
  // loading state; this effect-driven read updates state after its response.
  const loadEvents = useCallback(() => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    return fetchEvents(controller.signal).then((savedEvents) => {
      if (!controller.signal.aborted) {
        setEvents(savedEvents);
        setListError("");
      }
    }).catch(() => {
      if (!controller.signal.aborted) setListError("Unable to load saved events. Please try again.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }, []);

  useEffect(() => {
    void loadEvents();
    return () => { listRequest.current?.abort(); exportRequest.current?.abort(); };
  }, [loadEvents]);

  useEffect(() => {
    const dialog = deleteDialog.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) {
      dialog.showModal();
      cancelDeleteButton.current?.focus();
    } else if (!deleteTarget && dialog.open) {
      dialog.close();
      listHeading.current?.focus();
    }
  }, [deleteTarget]);

  function refreshEvents() {
    setLoading(true);
    setListError("");
    void loadEvents();
  }

  function beginEdit(event: SavedEvent) {
    if (mutationRef.current || exportRequest.current || editingId) return;
    draftBeforeEdit.current = { date, details };
    setEditingId(event.id);
    setDate(event.date);
    setDetails(event.details);
    setFormError("");
    setSuccess("");
    dateInput.current?.focus();
  }

  function finishEdit() {
    const previousDraft = draftBeforeEdit.current;
    setEditingId(null);
    setDate(previousDraft?.date ?? "");
    setDetails(previousDraft?.details ?? "");
    setFormError("");
    draftBeforeEdit.current = null;
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationRef.current || exportRequest.current) return;
    setFormError("");
    setSuccess("");
    const input = validateEventInput({ date, details });
    if (!input.ok) { setFormError(input.error); return; }

    const targetId = editingId;
    mutationRef.current = true;
    setSaving(true);
    listRequest.current?.abort();
    setLoading(false);
    try {
      const response = await fetch(targetId ? `/api/events/${encodeURIComponent(targetId)}` : "/api/events", {
        method: targetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.value),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(response.status === 404
          ? "This event no longer exists. Cancel editing and refresh the list."
          : data.error || "Unable to save the event. Please try again.");
        return;
      }
      if (!data.event?.id) throw new Error("Invalid server response");

      setEvents((current) => targetId
        ? current.map((item) => item.id === targetId ? data.event : item)
        : [data.event, ...current].slice(0, 50));
      if (targetId) finishEdit();
      else { setDate(""); setDetails(""); }
      setSuccess(targetId ? "Event updated successfully." : "Event saved successfully.");
      refreshEvents();
      router.refresh();
    } catch {
      setFormError("Unable to confirm the save. Refresh the event list before trying again.");
    } finally {
      mutationRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || mutationRef.current || exportRequest.current) return;
    const targetId = deleteTarget.id;
    mutationRef.current = true;
    setDeleting(true);
    setDeleteError("");
    setSuccess("");
    listRequest.current?.abort();
    setLoading(false);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(targetId)}`, { method: "DELETE" });
      const data = await response.json();
      // Another visitor may already have removed this shared event.
      if (!response.ok && response.status !== 404) {
        setDeleteError(data.error || "Unable to delete the event. Please try again.");
        return;
      }
      if (response.ok && (data.deleted !== true || data.id !== targetId)) throw new Error("Invalid server response");
      setEvents((current) => current.filter((item) => item.id !== targetId));
      setDeleteTarget(null);
      setSuccess(response.status === 404 ? "This event was already deleted." : "Event deleted successfully.");
      refreshEvents();
      router.refresh();
    } catch {
      setDeleteError("Unable to confirm the deletion. Cancel and refresh the list before trying again.");
    } finally {
      mutationRef.current = false;
      setDeleting(false);
    }
  }

  async function downloadEvents(format: ExportFormat, id?: string) {
    if (mutationRef.current || exportRequest.current || editingId) return;
    const controller = new AbortController();
    exportRequest.current = controller;
    setExporting(`${id ?? "all"}:${format}`);
    setExportError("");
    setExportStatus("");
    try {
      const query = new URLSearchParams({ format });
      if (id) query.set("id", id);
      const response = await fetch(`/api/events/export?${query}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        setExportError(data.error || "Unable to export events. Please try again.");
        return;
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `my-events.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser time to consume the download before releasing it.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportStatus(`${format.toUpperCase()} download started. Check your downloads folder.`);
    } catch {
      if (!controller.signal.aborted) setExportError("Unable to download the file. Please try again.");
    } finally {
      exportRequest.current = null;
      setExporting(null);
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>My events</h1>
      <p className={styles.intro}>Save important dates, update your plans, and keep your calendar organised.</p>
      <p role="status" className={styles.success}>{success}</p>
      <div className={styles.columns}>
        <section className={`${styles.card} ${editingId ? styles.editingCard : ""}`} aria-labelledby="event-form-title">
          <div className={styles.formHeader}>
            <h2 id="event-form-title">{editingId ? "Edit event" : "Add an event"}</h2>
            {editingId && <span className={styles.editingBadge}>Editing</span>}
          </div>
          {editingId && <p className={styles.hint}>Update the date or details, then save your changes.</p>}
          <form onSubmit={handleSubmit} aria-busy={saving}>
            <fieldset className={styles.fields} disabled={busy}>
              <label htmlFor="event-date">Event date</label>
              <input ref={dateInput} id="event-date" name="date" type="date" min="0001-01-01" max="9999-12-31" required value={date}
                onChange={(event) => { setDate(event.target.value); setSuccess(""); }} className={styles.input} />
              <label htmlFor="event-details">Event details</label>
              <textarea id="event-details" name="details" rows={6} required maxLength={MAX_EVENT_DETAILS} value={details}
                onChange={(event) => { setDetails(event.target.value); setSuccess(""); }}
                placeholder="What is happening on this date?" aria-describedby="event-details-help" className={styles.input} />
              <p id="event-details-help" className={styles.hint}>{details.length} / {MAX_EVENT_DETAILS} characters</p>
              <button className={styles.saveButton} type="submit">{saving ? "Saving..." : editingId ? "Save changes" : "Save event"}</button>
              {editingId && <button className={styles.cancelEditButton} type="button" onClick={() => { finishEdit(); dateInput.current?.focus(); }}>Cancel editing</button>}
            </fieldset>
            {formError && <p role="alert" className={styles.error}>{formError}</p>}
          </form>
        </section>

        <section className={styles.card} aria-labelledby="saved-events-title">
          <div className={styles.listHeader}>
            <h2 ref={listHeading} id="saved-events-title" tabIndex={-1}>Saved events</h2>
            <button type="button" onClick={refreshEvents} disabled={loading || busy} className={styles.refreshButton}>Refresh</button>
          </div>
          <p className={styles.hint}>Your 50 most recently added events appear here.</p>
          <div className={styles.exportToolbar} aria-label="Export all saved events">
            <strong>Export all events</strong>
            <p>Take your saved dates with you, including older events.</p>
            <div className={styles.exportButtons}>
              <button type="button" className={styles.calendarExportButton} disabled={exportDisabled || events.length === 0}
                onClick={() => void downloadEvents("ics")}>
                <DownloadIcon />{exporting === "all:ics" ? "Preparing..." : "Calendar (.ics)"}
              </button>
              <button type="button" className={styles.excelExportButton} disabled={exportDisabled || events.length === 0}
                onClick={() => void downloadEvents("xlsx")}>
                <DownloadIcon />{exporting === "all:xlsx" ? "Preparing..." : "Excel (.xlsx)"}
              </button>
            </div>
            {editingId && <p>Save or cancel your changes before exporting.</p>}
          </div>
          <p role="status" className={styles.success}>{exporting ? "Preparing your download..." : exportStatus}</p>
          {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
          {loading && <p role="status">Loading events...</p>}
          {listError && <p role="alert" className={styles.error}>{listError}</p>}
          {!loading && !listError && events.length === 0 && <p className={styles.empty}>No events yet. Add your first event using the form.</p>}
          <ul className={styles.list}>
            {events.map((savedEvent) => (
              <li key={savedEvent.id} className={`${styles.event} ${editingId === savedEvent.id ? styles.activeEvent : ""}`}>
                <time dateTime={savedEvent.date}>{dateFormatter.format(new Date(`${savedEvent.date}T00:00:00.000Z`))}</time>
                <p>{savedEvent.details}</p>
                <div className={styles.eventActions}>
                  <button type="button" className={styles.editButton} disabled={busy || loading || editingId !== null}
                    onClick={() => beginEdit(savedEvent)} aria-label={`Edit event on ${savedEvent.date}`}>
                    {editingId === savedEvent.id ? "Editing" : "Edit"}
                  </button>
                  <button type="button" className={styles.deleteButton} disabled={busy || loading || editingId !== null}
                    onClick={() => { setDeleteError(""); setDeleteTarget(savedEvent); }} aria-label={`Delete event on ${savedEvent.date}`}>Delete</button>
                  <div className={styles.eventDownloads}>
                    <button type="button" className={styles.fileButton} disabled={exportDisabled}
                      onClick={() => void downloadEvents("ics", savedEvent.id)} aria-label={`Download event on ${savedEvent.date} as a calendar file (.ics)`}>
                      <DownloadIcon />.ics
                    </button>
                    <button type="button" className={styles.fileButton} disabled={exportDisabled}
                      onClick={() => void downloadEvents("xlsx", savedEvent.id)} aria-label={`Download event on ${savedEvent.date} as an Excel file (.xlsx)`}>
                      <DownloadIcon />.xlsx
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <dialog ref={deleteDialog} className={styles.deleteDialog} aria-labelledby="delete-title" aria-describedby="delete-description"
        onCancel={(event) => { if (mutationRef.current) event.preventDefault(); else setDeleteTarget(null); }}
        onClose={() => setDeleteTarget(null)}>
        <h2 id="delete-title">Delete this event?</h2>
        <p id="delete-description">This event will be removed from your calendar. This cannot be undone.</p>
        {deleteTarget && <div className={styles.deletePreview}>
          <time dateTime={deleteTarget.date}>{dateFormatter.format(new Date(`${deleteTarget.date}T00:00:00.000Z`))}</time>
          <p>{deleteTarget.details}</p>
        </div>}
        {deleteError && <p role="alert" className={styles.error}>{deleteError}</p>}
        <div className={styles.dialogActions}>
          <button ref={cancelDeleteButton} type="button" className={styles.refreshButton} disabled={deleting} onClick={() => setDeleteTarget(null)}>Keep event</button>
          <button type="button" className={styles.confirmDeleteButton} disabled={deleting} onClick={() => void handleDelete()}>{deleting ? "Deleting..." : "Delete event"}</button>
        </div>
      </dialog>
    </main>
  );
}
