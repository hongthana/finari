import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, hasDatabase } from "@/db/client";
import { waitlistLeads } from "@/db/schema";
import type { WaitlistLead, WaitlistLeadRecord } from "@/lib/types";

const waitlistState = globalThis as typeof globalThis & {
  __finariWaitlistLeads?: Map<string, WaitlistLeadRecord>;
};

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

function getMemoryLeads(): Map<string, WaitlistLeadRecord> {
  waitlistState.__finariWaitlistLeads ??= new Map();
  return waitlistState.__finariWaitlistLeads;
}

export function closeWaitlistDatabase(): void {
  waitlistState.__finariWaitlistLeads = new Map();
}

export async function saveWaitlistLead(lead: WaitlistLead): Promise<WaitlistLeadRecord> {
  const parsed = waitlistLeadSchema.parse(lead);
  const email = parsed.email.toLowerCase();

  if (!hasDatabase()) {
    const existing = getMemoryLeads().get(email);
    const record: WaitlistLeadRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      email,
      investorProfile: parsed.investorProfile,
      interestArea: parsed.interestArea,
      sourceTicker: parsed.sourceTicker,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getMemoryLeads().set(email, record);
    return record;
  }

  await getDb()
    .insert(waitlistLeads)
    .values({
      email,
      investorProfile: parsed.investorProfile,
      interestArea: parsed.interestArea,
      sourceTicker: parsed.sourceTicker,
    })
    .onConflictDoUpdate({
      target: waitlistLeads.email,
      set: {
        investorProfile: parsed.investorProfile,
        interestArea: parsed.interestArea,
        sourceTicker: parsed.sourceTicker,
        updatedAt: new Date(),
      },
    });

  const [row] = await getDb()
    .select()
    .from(waitlistLeads)
    .where(eq(waitlistLeads.email, email))
    .limit(1);

  if (!row) {
    throw new Error("Waitlist lead was not saved");
  }

  return {
    id: row.id,
    email: row.email,
    investorProfile: row.investorProfile,
    interestArea: row.interestArea,
    sourceTicker: row.sourceTicker ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
