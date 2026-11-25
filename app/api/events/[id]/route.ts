import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { getEventsCollection } from "@/lib/mongodb";
import { validateEventInput } from "@/lib/event-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventContext = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "no-store" };

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

export async function PUT(request: Request, { params }: EventContext) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) return errorResponse("Invalid event ID.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON format.", 400);
  }
  const input = validateEventInput(body);
  if (!input.ok) return errorResponse(input.error, 400);

  try {
    const collection = await getEventsCollection();
    const event = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: input.value },
      { returnDocument: "after" },
    );
    if (!event) return errorResponse("Event not found.", 404);

    revalidatePath("/");
    return Response.json({
      event: {
        id: event._id.toHexString(),
        date: event.date,
        details: event.details,
        createdAt: event.createdAt.toISOString(),
      },
    }, { headers });
  } catch {
    return errorResponse("Unable to update the event. Please try again.", 503);
  }
}

export async function DELETE(_request: Request, { params }: EventContext) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) return errorResponse("Invalid event ID.", 400);

  try {
    const collection = await getEventsCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (!result.deletedCount) return errorResponse("Event not found.", 404);

    revalidatePath("/");
    return Response.json({ deleted: true, id: new ObjectId(id).toHexString() }, { headers });
  } catch {
    return errorResponse("Unable to delete the event. Please try again.", 503);
  }
}
