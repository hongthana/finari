import { z } from "zod";

import { validationError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { RATE_LIMITS, requireUserRateLimit } from "@/lib/rate-limit";
import {
  createWatchlist,
  ensureDefaultWatchlist,
  listWatchlistsForUser,
} from "@/lib/research-store";
import { getCurrentUserId, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const createWatchlistSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  await ensureDefaultWatchlist(userId);
  const watchlists = await listWatchlistsForUser(userId);
  return Response.json({ watchlists });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }
  const limited = await requireUserRateLimit(userId, RATE_LIMITS.userWrite);
  if (limited) {
    return limited;
  }

  return recordRouteActivity(
    request,
    {
      userId,
      category: "workspace",
      eventName: "workspace.watchlist.create",
    },
    async () => {
      try {
        const body = createWatchlistSchema.parse(await request.json());
        const watchlist = await createWatchlist({ userId, name: body.name });
        return Response.json({ watchlist }, { status: 201 });
      } catch (error) {
        return validationError(error);
      }
    },
  );
}
