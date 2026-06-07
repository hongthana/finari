import { z } from "zod";

import { jsonError, validationError } from "@/lib/api";
import { requireInvitationAccess } from "@/lib/site-access";
import { getValuationForTicker } from "@/lib/valuation";

export const runtime = "nodejs";

const paramsSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .transform((value) => value.toUpperCase()),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const blocked = await requireInvitationAccess();
  if (blocked) {
    return blocked;
  }

  try {
    const { ticker } = await context.params.then((raw) => paramsSchema.parse(raw));
    const valuation = await getValuationForTicker(ticker);

    return Response.json({ valuation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationError(error);
    }

    if (error instanceof Error) {
      if (error.message.includes("FMP_API_KEY is not configured")) {
        return jsonError("FMP API key is not configured", 503);
      }

      if (error.message.startsWith("Invalid ticker")) {
        return jsonError(error.message, 400);
      }

      return jsonError(error.message, 502);
    }

    return jsonError("Unable to load valuation right now", 502);
  }
}
