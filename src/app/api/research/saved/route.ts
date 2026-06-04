import { z } from "zod";

import { validationError } from "@/lib/api";
import {
  getResearchMemoForTicker,
  getStoredSnapshotForTicker,
} from "@/lib/research-service";
import { normalizeLocale } from "@/lib/i18n";
import { listSavedResearchForUser, saveResearchForUser } from "@/lib/research-store";
import { getCurrentUserId, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const saveResearchSchema = z.object({
  ticker: z.string().trim().min(1).max(12).transform((value) => value.toUpperCase()),
  includeMemo: z.boolean().optional().default(false),
  locale: z.string().optional(),
  title: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  const saved = await listSavedResearchForUser(userId);
  return Response.json({ saved });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  try {
    const body = saveResearchSchema.parse(await request.json());
    const snapshot = await getStoredSnapshotForTicker(body.ticker);
    const locale = normalizeLocale(body.locale);
    const memo = body.includeMemo
      ? await getResearchMemoForTicker(body.ticker, locale)
      : null;
    const saved = await saveResearchForUser({
      userId,
      snapshot,
      memo: memo ? { memoId: memo.memoId, memo: memo.memo } : null,
      title: body.title,
      notes: body.notes,
    });

    return Response.json({ saved }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
