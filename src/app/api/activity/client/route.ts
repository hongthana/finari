import { z } from "zod";

import { validationError } from "@/lib/api";
import { activityRequestContext, recordActivityEvent } from "@/lib/activity";
import { getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const clientEventSchema = z.object({
  eventName: z.string().trim().min(1).max(120),
  path: z.string().trim().min(1).max(240).optional(),
  locale: z.string().trim().max(12).optional(),
  ticker: z.string().trim().max(12).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const clientBatchSchema = z.object({
  events: z.array(clientEventSchema).min(1).max(25),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  try {
    const body = clientBatchSchema.parse(await request.json());
    const context = activityRequestContext(request);

    await Promise.all(
      body.events.map((event) =>
        recordActivityEvent({
          userId: user.id,
          email: user.email,
          category: "client",
          eventName: event.eventName,
          path: event.path ?? context.path,
          method: context.method,
          status: "ok",
          locale: event.locale,
          ticker: event.ticker,
          ipHash: context.ipHash,
          userAgentHash: context.userAgentHash,
          metadata: event.metadata,
        }),
      ),
    );

    return Response.json({ ok: true, accepted: body.events.length });
  } catch (error) {
    return validationError(error);
  }
}
