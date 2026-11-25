import ExcelJS from "exceljs";
import type { SavedEvent } from "../types/event";

function calendarText(value: string): string {
  return value
    .replace(/\p{Cc}/gu, (character) => "\t\r\n".includes(character) ? character : "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// RFC 5545 limits physical lines to 75 UTF-8 bytes, including continuation
// spaces. Iterate code points so Thai text and emoji are never split mid-byte.
function foldLine(line: string): string {
  let result = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += size;
  }
  return result;
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createEventsIcs(events: readonly SavedEvent[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Extra Project//My Events//EN", "CALSCALE:GREGORIAN"];
  for (const event of events) {
    const title = Array.from(event.details.split(/\r\n|\r|\n/)[0]).slice(0, 160).join("");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@extra-project.local`,
      `DTSTAMP:${timestamp(now)}`,
      `CREATED:${timestamp(new Date(event.createdAt))}`,
      // DATE without DTEND/DURATION means exactly one day (RFC 5545 3.6.1).
      // It also preserves 9999-12-31 without overflowing to a five-digit year.
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `SUMMARY:${calendarText(title)}`,
      `DESCRIPTION:${calendarText(event.details)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export async function createEventsXlsx(events: readonly SavedEvent[]): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Extra Project";
  const sheet = workbook.addWorksheet("My events", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 24 },
  });
  sheet.columns = [
    { header: "Event date", key: "date", width: 18 },
    { header: "Details", key: "details", width: 72 },
    { header: "Created at (UTC)", key: "createdAt", width: 25 },
    { header: "Event ID", key: "id", width: 29 },
  ];
  sheet.getColumn("date").numFmt = "yyyy-mm-dd";
  sheet.getColumn("createdAt").numFmt = "yyyy-mm-dd hh:mm:ss";
  sheet.getColumn("details").numFmt = "@";
  sheet.getColumn("id").numFmt = "@";

  for (const event of events) {
    const row = sheet.addRow({
      // Excel's early date system includes the fictional 1900-02-29. Keep
      // earlier dates as ISO text instead of silently shifting calendar days.
      date: event.date >= "1900-03-01" ? new Date(`${event.date}T00:00:00.000Z`) : event.date,
      details: event.details,
      createdAt: new Date(event.createdAt),
      id: event.id,
    });
    row.font = { name: "Calibri", size: 11, color: { argb: "FF19243B" } };
    row.alignment = { vertical: "top", wrapText: true };
    const lineCount = event.details.split(/\r\n|\r|\n/)
      .reduce((total, line) => total + Math.max(1, Math.ceil(Array.from(line).length / 60)), 0);
    row.height = Math.min(409, Math.max(30, lineCount * 16 + 10));
    if (row.number % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5FC" } };
    }
  }

  const header = sheet.getRow(1);
  header.height = 30;
  header.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF315DBC" } };
  header.alignment = { vertical: "middle" };
  sheet.autoFilter = { from: "A1", to: `D${sheet.rowCount}` };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
