# Extra Project - Countdown Holidays App

A separate Next.js App Router project based on `mp-4`.

## Features

- `app/layout.tsx`: shared layout and Countdown Holidays App header.
- `app/page.tsx`: countdown dashboard with a country selector (automatic location, with United States as the fallback), today's date, the nearest upcoming date, and reusable `DayCard` components for Countdown Holidays and saved events.
- The overview supports All dates / Countdown Holidays / My events filters and refresh. Country selection is retained in `?country=TH` so calendars can be bookmarked.
- Opening `/` automatically requests browser location once, displays the approximate city/country, and selects that country's holiday calendar. Denied/unavailable location falls back to US. Explicit `?country=...` links and manual country choices are preserved. **Use my location** allows retrying; manual selection remains available while detection is pending.
- Countdowns use calendar days in `Asia/Bangkok`, update at midnight, include today, and omit past dates. Saved events remain visible for every country, including events in future years. Past events remain available on `/events`.
- Countdown Holidays use API Ninjas for the current calendar year, with a one-hour cache. Dates after that year are not guessed; regional and tentative holidays are labeled. Holiday and event loading failures are displayed independently.
- `app/[country]/page.tsx`: fetches Countdown Holidays from API Ninjas on the server and displays results or an error.
- `app/events/page.tsx`: add, edit, and delete events, and view the 50 most recently saved events. Edit loads the date and details into the form; Cancel restores the previous new-event draft. Delete requires confirmation.
- My events supports `.ics` calendar and `.xlsx` Excel downloads for one saved event or all saved events. Export all includes past dates and records beyond the 50 shown on screen, ordered by event date. Downloads are snapshots of saved data; save edits before exporting.
- `app/api/events/route.ts`: validates requests and reads/writes MongoDB using the same driver approach as `mp-5`.

## Run locally

From the `extra-project` folder:

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal. To run alongside `mp-4` on a different port:

```bash
npm run dev -- --port 3001
```

## API configuration

The result page reads `API_NINJAS_KEY` from `.env.local` in the project root. The local configuration was copied from `mp-4`. This file is ignored by Git; keep the key private and server-side.

For a fresh checkout, create `.env.local` with:

```dotenv
API_NINJAS_KEY=your_api_key_here
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB=extraProject
```

Restart the development server after changing the environment file.

The local MongoDB connection settings were copied from `mp-5`. Events use the
`extraProject` database and `event` collection by default. `mp-5` continues to
use its own `mp5` database. For a fresh checkout, set `MONGO_URI` to your MongoDB
connection string (local MongoDB or Atlas). Atlas must allow the connecting
machine's IP, and the database user needs read/write access to `MONGO_DB`.

Open `/events` or click **My events** in the navigation. Both fields are required;
details are trimmed and limited to 2,000 characters. Past and future dates are
allowed. Event dates are stored as `YYYY-MM-DD` strings to preserve the chosen
calendar day in every time zone; `createdAt` is a MongoDB Date.

## Events API

`POST /api/events` accepts JSON:

```json
{ "date": "2026-12-01", "details": "Team meeting at 10:00" }
```

- `201`: `{ "event": { "id": "...", "date": "2026-12-01", "details": "Team meeting at 10:00", "createdAt": "..." } }`
- `400`: `{ "error": "..." }` for malformed JSON, missing/invalid fields, impossible dates, or details over the limit.
- `503`: `{ "error": "..." }` when storage is unavailable. Connection credentials are never returned.

`GET /api/events` returns `200` with `{ "events": [...] }`, newest additions first
(up to 50), or `503` if storage is unavailable. Responses use `Cache-Control: no-store`.
The form stays filled if saving fails. Refresh reloads events from MongoDB.

This classroom app has no login: saved events are shared by all visitors.

`PUT /api/events/{id}` updates an existing event. Send both `date` and `details`
using the same JSON and validation as POST. Success returns `200` with
`{ "event": { "id": "...", "date": "...", "details": "...", "createdAt": "..." } }`.
The event's ID and creation time are preserved; unknown fields are ignored.
This is a full update of the two editable fields, not a partial patch.

`DELETE /api/events/{id}` removes only the event with that ID. It takes no body
and returns `200` with `{ "deleted": true, "id": "..." }` on success.

Both operations return `400` for an ID that is not 24 hexadecimal characters,
`404` with `{ "error": "Event not found." }` if the event no longer exists,
or `503` when storage is unavailable. PUT also returns `400` for invalid JSON
or invalid event fields. All responses use `Cache-Control: no-store`.
Repeated deletion returns `404`. No operation creates an event implicitly.
After a successful mutation the client reloads its list, and the overview is
marked for revalidation so countdowns reflect the changed dates on the next visit.

## Location detection

Opening the overview without a `country` query automatically starts location
detection and requests browser permission. United States is displayed while
waiting. Allow location to use the detected country, choose **Use US instead**,
or select a country manually. **Use my location** retries detection. Explicit
country links skip automatic detection. This requires HTTPS or localhost and enabled
device location services. Accuracy depends on the device; this identifies an
approximate city/country, not a street address.

The browser obtains fresh coordinates only with browser permission, then calls
[BigDataCloud's client-side reverse geocoding API](https://www.bigdatacloud.com/docs/article/fair-use-policy-for-free-client-side-reverse-geocoding-api)
directly, without an API key. The on-screen notice explains this sharing.
Coordinates are not saved in MongoDB, local storage, or the page URL.
There is no background tracking or IP fallback after denial. The calendar URL
stores only the resulting country code. Countdowns still use Bangkok time.

Denial, unavailable location, a 15-second device timeout, provider errors, and a
10-second lookup timeout select United States and explain how to retry or
choose manually. **Use US instead** and manual selection abort the lookup and
ignore late location callbacks. Automatic results/fallbacks replace the URL
instead of adding history entries. The provider is never called from a server
or with test coordinates.

## Export API

`GET /api/events/export?format=ics` or `?format=xlsx` downloads all saved events.
Add `&id=<24-character-event-id>` to download just one event. This is a read-only
operation on the existing `event` collection; holidays are not included.

- `200`: file bytes with `Content-Disposition: attachment`, `Cache-Control: no-store`,
  and `text/calendar; charset=utf-8` or
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `400`: JSON `{ "error": "..." }` for missing/unsupported format or invalid ID.
- `404`: JSON error if the selected event is missing or there are no events to export.
- `503`: JSON error if export cannot be completed. Credentials are never returned.

ICS uses one-day, all-day events with stable IDs, UTF-8 text, escaped details,
and RFC 5545 line folding. Import the file using your calendar app's import
feature. This is not a live subscription; later edits/deletions do not sync.
The first line of details (up to 160 characters) is the calendar title and the
full details are retained in its description.

XLSX uses ExcelJS on the server and contains one `My events` sheet with event
date, details, creation time (UTC), and event ID. It has a frozen header, filters,
wrapped details, and formatted date cells. Dates before 1900-03-01 are ISO text
to preserve days outside Excel's reliable date system. User details remain text,
including strings beginning with `=`; they are never evaluated as formulas.

## Checks

```bash
npm run lint
npm run build
```
