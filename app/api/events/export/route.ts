import { ObjectId } from "mongodb";
import { calendarDate } from "@/lib/calendar";
import { createEventsIcs, createEventsXlsx } from "@/lib/event-export";
import { getEventsCollection } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const format = query.get("format");
  const id = query.get("id");
  if (format !== "ics" && format !== "xlsx") {
    return errorResponse("Choose an export format: ics or xlsx.", 400);
  }
  if (id !== null && !/^[a-f\d]{24}$/i.test(id)) {
    return errorResponse("Invalid event ID.", 400);
  }

  try {
    const collection = await getEventsCollection();
    // Export all saved events, independently of the 50-row screen limit.
    const documents = await collection.find(id ? { _id: new ObjectId(id) } : {})
      .sort({ date: 1, _id: 1 }).toArray();
    if (documents.length === 0) {
      return errorResponse(id ? "Event not found." : "No saved events to export.", 404);
    }
    const events = documents.map((event) => ({
      id: event._id.toHexString(), date: event.date, details: event.details,
      createdAt: event.createdAt.toISOString(),
    }));
    const body = format === "ics" ? createEventsIcs(events) : await createEventsXlsx(events);
    const filename = id ? `event-${id.toLowerCase()}.${format}` : `my-events-${calendarDate()}.${format}`;
    return new Response(body, {
      headers: {
        "Content-Type": format === "ics" ? "text/calendar; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("Unable to export events. Please try again.", 503);
  }
}
