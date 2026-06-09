import { z } from "zod";

import { RATE_LIMITS, requireUserRateLimit } from "@/lib/rate-limit";
import { markAlertDeliveryRead, getAlertDelivery } from "@/lib/research-store";
import { getCurrentUserId, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const patchSchema = z.object({
  read: z.boolean().default(true),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }
  const limited = await requireUserRateLimit(userId, RATE_LIMITS.userWrite);
  if (limited) {
    return limited;
  }

  const { id } = await context.params;
  const existing = await getAlertDelivery({ userId, alertDeliveryId: id });
  if (!existing) {
    return Response.json({ error: "Alert delivery not found" }, { status: 404 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    if (!body.read) {
      return Response.json({ delivery: existing });
    }

    const updated = await markAlertDeliveryRead({
      userId,
      alertDeliveryId: id,
      readAt: new Date(),
    });

    if (!updated) {
      return Response.json({ error: "Alert delivery not found" }, { status: 404 });
    }

    return Response.json({ delivery: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
