import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { z } from "zod";

import { getDatabasePath } from "@/lib/env";
import type { WaitlistLead, WaitlistLeadRecord } from "@/lib/types";

const waitlistState = globalThis as typeof globalThis & {
  __finariWaitlistDb?: DatabaseSyncType;
};
const nodeRequire = createRequire(import.meta.url);

export const waitlistLeadSchema = z.object({
  email: z.string().trim().email().max(254),
  investorProfile: z.string().trim().min(2).max(80),
  interestArea: z.string().trim().min(2).max(120),
  sourceTicker: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
});

function resolveDatabasePath(): string {
  const configuredPath = getDatabasePath();
  return configuredPath === ":memory:" ? configuredPath : resolve(configuredPath);
}

function getDatabase(): DatabaseSyncType {
  if (waitlistState.__finariWaitlistDb) {
    return waitlistState.__finariWaitlistDb;
  }

  const databasePath = resolveDatabasePath();
  if (databasePath !== ":memory:") {
    const dir = dirname(databasePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      investor_profile TEXT NOT NULL,
      interest_area TEXT NOT NULL,
      source_ticker TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  waitlistState.__finariWaitlistDb = db;
  return db;
}

export function closeWaitlistDatabase(): void {
  waitlistState.__finariWaitlistDb?.close();
  waitlistState.__finariWaitlistDb = undefined;
}

export function saveWaitlistLead(lead: WaitlistLead): WaitlistLeadRecord {
  const parsed = waitlistLeadSchema.parse(lead);
  const db = getDatabase();

  db.prepare(
    `
      INSERT INTO waitlist_leads (
        email,
        investor_profile,
        interest_area,
        source_ticker
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        investor_profile = excluded.investor_profile,
        interest_area = excluded.interest_area,
        source_ticker = excluded.source_ticker
    `,
  ).run(
    parsed.email.toLowerCase(),
    parsed.investorProfile,
    parsed.interestArea,
    parsed.sourceTicker ?? null,
  );

  const row = db
    .prepare(
      `
        SELECT
          id,
          email,
          investor_profile AS investorProfile,
          interest_area AS interestArea,
          source_ticker AS sourceTicker,
          created_at AS createdAt
        FROM waitlist_leads
        WHERE email = ?
      `,
    )
    .get(parsed.email.toLowerCase()) as WaitlistLeadRecord | undefined;

  if (!row) {
    throw new Error("Waitlist lead was not saved");
  }

  return row;
}
