import { z } from "zod";

import { validationError } from "@/lib/api";
import { getStoredSnapshotForTicker } from "@/lib/research-service";
import { addCompanyToWatchlist } from "@/lib/research-store";
import { getCurrentUserId, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const addItemSchema = z.object({
  ticker: z.string().trim().min(1).max(12).transform((value) => value.toUpperCase()),
  notes: z.string().trim().max(2_000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  try {
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    const parsed = addItemSchema.parse(body);
    const snapshot = await getStoredSnapshotForTicker(parsed.ticker);
    const item = await addCompanyToWatchlist({
      userId,
      watchlistId: id,
      snapshot,
      notes: parsed.notes,
    });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
