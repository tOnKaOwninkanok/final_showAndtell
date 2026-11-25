import { MongoClient } from "mongodb";
import type { EventInput } from "@/types/event";

type EventDocument = EventInput & { createdAt: Date };

// Reuse the connection pool, including across Next.js development reloads.
const mongoGlobal = globalThis as typeof globalThis & {
  eventsMongoClient?: Promise<MongoClient>;
};

export async function getEventsCollection() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Set MONGO_URI in .env.local.");
  }

  if (!mongoGlobal.eventsMongoClient) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    mongoGlobal.eventsMongoClient = client.connect().catch(async (error) => {
      console.error("MongoDB error:", {
        name: error.name,
        code: error.code,
        cause: error.cause?.code,
      });
    
      for (const server of error.reason?.servers?.values() ?? []) {
        console.error("Connection cause:", {
          name: server.error?.name,
          code: server.error?.code,
          cause: server.error?.cause?.code,
        });
      }
    
      mongoGlobal.eventsMongoClient = undefined;
      await client.close().catch(() => undefined);
      throw error;
    });
  }

  const client = await mongoGlobal.eventsMongoClient;
  return client
    .db(process.env.MONGO_DB || "extraProject")
    .collection<EventDocument>("event");
}
