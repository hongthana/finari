import { and, desc, eq, sql } from "drizzle-orm";

import { getDb, hasDatabase } from "@/db/client";
import { companyTickers, tileFeedback, tileFeedbackVotes } from "@/db/schema";

export type TileFeedbackRecord = {
  id: string;
  ticker: string;
  locale: string;
  tileId: string;
  tileLabel: string;
  pagePath: string | null;
  feedback: string;
  screenshot: Record<string, unknown>;
  status: string;
  votes: number;
  createdAt: Date;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().slice(0, 12);
}

function rowToFeedback(row: typeof tileFeedback.$inferSelect): TileFeedbackRecord {
  return {
    id: row.id,
    ticker: row.ticker,
    locale: row.locale,
    tileId: row.tileId,
    tileLabel: row.tileLabel,
    pagePath: row.pagePath,
    feedback: row.feedback,
    screenshot: row.screenshotJson,
    status: row.status,
    votes: row.votes,
    createdAt: row.createdAt,
  };
}

export async function listTileFeedback(input: {
  ticker?: string;
  tileId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<TileFeedbackRecord[]> {
  if (!hasDatabase()) {
    return [];
  }

  const conditions = [];
  if (input.ticker) {
    conditions.push(eq(tileFeedback.ticker, normalizeTicker(input.ticker)));
  }
  if (input.tileId) {
    conditions.push(eq(tileFeedback.tileId, input.tileId.trim().slice(0, 120)));
  }
  if (input.status) {
    conditions.push(eq(tileFeedback.status, input.status.trim().slice(0, 40)));
  }

  const rows = await getDb()
    .select()
    .from(tileFeedback)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(tileFeedback.votes), desc(tileFeedback.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 200));

  return rows.map(rowToFeedback);
}

export async function createTileFeedback(input: {
  userId?: string | null;
  ticker: string;
  locale: string;
  tileId: string;
  tileLabel: string;
  pagePath?: string | null;
  feedback: string;
  screenshot?: Record<string, unknown>;
  ipHash?: string | null;
  userAgentHash?: string | null;
}): Promise<TileFeedbackRecord> {
  const db = getDb();
  const ticker = normalizeTicker(input.ticker);
  const company = await db
    .select({ companyId: companyTickers.companyId })
    .from(companyTickers)
    .where(and(eq(companyTickers.ticker, ticker), eq(companyTickers.isActive, true)))
    .limit(1);

  const [row] = await db
    .insert(tileFeedback)
    .values({
      userId: input.userId ?? null,
      companyId: company[0]?.companyId ?? null,
      ticker,
      locale: input.locale.trim().slice(0, 12) || "en",
      tileId: input.tileId.trim().slice(0, 120),
      tileLabel: input.tileLabel.trim().slice(0, 160),
      pagePath: input.pagePath?.trim().slice(0, 240) || null,
      feedback: input.feedback.trim().slice(0, 2000),
      screenshotJson: input.screenshot ?? {},
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
    })
    .returning();

  return rowToFeedback(row);
}

export async function voteForTileFeedback(input: {
  feedbackId: string;
  voterKey: string;
  userId?: string | null;
}): Promise<{ feedback: TileFeedbackRecord; voted: boolean }> {
  const db = getDb();
  const inserted = await db
    .insert(tileFeedbackVotes)
    .values({
      feedbackId: input.feedbackId,
      voterKey: input.voterKey,
      userId: input.userId ?? null,
    })
    .onConflictDoNothing()
    .returning({ feedbackId: tileFeedbackVotes.feedbackId });

  if (inserted.length) {
    await db
      .update(tileFeedback)
      .set({
        votes: sql`${tileFeedback.votes} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tileFeedback.id, input.feedbackId));
  }

  const [row] = await db.select().from(tileFeedback).where(eq(tileFeedback.id, input.feedbackId));
  if (!row) {
    throw new Error("Feedback not found");
  }

  return { feedback: rowToFeedback(row), voted: Boolean(inserted.length) };
}
