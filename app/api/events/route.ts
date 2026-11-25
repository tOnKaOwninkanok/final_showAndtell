import { getEventsCollection } from "@/lib/mongodb";
import { validateEventInput } from "@/lib/event-validation";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const collection = await getEventsCollection();
    const documents = await collection
      .find({})
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .toArray();

    const events = documents.map((event) => ({
      id: event._id.toHexString(),
      date: event.date,
      details: event.details,
      createdAt: event.createdAt.toISOString(),
    }));

    return Response.json({ events }, { headers });
  } catch {
    return Response.json(
      { error: "Unable to load saved events. Please try again." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON format." },
      { status: 400, headers },
    );
  }

  const result = validateEventInput(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400, headers });
  }

  try {
    const collection = await getEventsCollection();
    const document = { ...result.value, createdAt: new Date() };
    const saved = await collection.insertOne(document);
    revalidatePath("/");

    return Response.json(
      {
        event: {
          id: saved.insertedId.toHexString(),
          ...result.value,
          createdAt: document.createdAt.toISOString(),
        },
      },
      { status: 201, headers },
    );
  } catch {
    return Response.json(
      { error: "Unable to save the event. Please try again." },
      { status: 503, headers },
    );
  }
}
