import { z } from "zod";

import { validationError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { RATE_LIMITS, requireUserRateLimit } from "@/lib/rate-limit";
import type { AlertConfig } from "@/lib/types";
import { patchAlertPreference } from "@/lib/research-store";
import { getCurrentUserId, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const patchAlertSchema = z.object({
  threshold: z.number().finite().optional(),
  condition: z
    .enum([
      "above",
      "below",
      "change-above",
      "change-below",
      "above-or-equal",
      "below-or-equal",
    ])
    .optional(),
  notes: z.string().trim().max(160).optional(),
  enabled: z.boolean().optional(),
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

  return recordRouteActivity(
    request,
    {
      userId,
      category: "workspace",
      eventName: "workspace.alert.patch",
      metadata: { alertId: id },
    },
    async () => {
      try {
        const body = patchAlertSchema.parse(await request.json());
        const { getAlertPreference } = await import("@/lib/research-store");
        const existingAlert = await getAlertPreference({
          userId,
          alertId: id,
        });

        if (!existingAlert) {
          return Response.json({ error: "Alert not found" }, { status: 404 });
        }

        const config: AlertConfig | undefined =
          body.threshold === undefined && body.condition === undefined && body.notes === undefined
            ? undefined
            : {
                threshold: body.threshold ?? existingAlert.config.threshold,
                condition: body.condition ?? existingAlert.config.condition,
                notes: body.notes ?? existingAlert.config.notes,
              };

        const updated = await patchAlertPreference({
          userId,
          alertId: id,
          config,
          enabled: body.enabled,
        });

        if (!updated) {
          return Response.json({ error: "Alert not found" }, { status: 404 });
        }

        return Response.json({ alert: updated });
      } catch (error) {
        return validationError(error);
      }
    },
  );
}
