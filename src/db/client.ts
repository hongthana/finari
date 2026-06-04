import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const globalDb = globalThis as typeof globalThis & {
  __finariPostgresClient?: postgres.Sql;
  __finariDb?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url === "test") {
    return null;
  }
  return url;
}

export function hasDatabase(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getDb() {
  if (globalDb.__finariDb) {
    return globalDb.__finariDb;
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const client =
    globalDb.__finariPostgresClient ??
    postgres(databaseUrl, {
      connect_timeout: 10,
      idle_timeout: 20,
      max: 5,
      prepare: false,
    });

  globalDb.__finariPostgresClient = client;
  globalDb.__finariDb = drizzle(client, { schema });

  return globalDb.__finariDb;
}

export async function closeDb(): Promise<void> {
  await globalDb.__finariPostgresClient?.end({ timeout: 5 });
  globalDb.__finariPostgresClient = undefined;
  globalDb.__finariDb = undefined;
}
