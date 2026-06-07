import { z } from "zod";

import { validationError } from "@/lib/api";
import type { AlertConfig } from "@/lib/types";
import {
  listAlertPreferences,
  upsertAlertPreference,
} from "@/lib/research-store";
import { getCurrentUserId, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const alertConfigSchema = z.object({
  alertType: z.string().trim().min(1).max(80),
  threshold: z.number().finite(),
  condition: z.enum([
    "above",
    "below",
    "change-above",
    "change-below",
    "above-or-equal",
    "below-or-equal",
  ]),
  notes: z.string().trim().max(160).optional(),
  enabled: z.boolean().default(true),
});

const createAlertSchema = z.object({
  ticker: z.string().trim().min(1).max(12).transform((value) => value.toUpperCase()),
  ...alertConfigSchema.shape,
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  const alerts = await listAlertPreferences(userId);
  return Response.json({ alerts });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  try {
    const body = createAlertSchema.parse(await request.json());
    const result = await upsertAlertPreference({
      userId,
      ticker: body.ticker,
      alertType: body.alertType,
      enabled: body.enabled,
      config: {
        threshold: body.threshold,
        condition: body.condition,
        notes: body.notes,
      } as AlertConfig,
    });

    return Response.json({ alert: result }, { status: result.isNew ? 201 : 200 });
  } catch (error) {
    return validationError(error);
  }
}
