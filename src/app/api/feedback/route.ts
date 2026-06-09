import { z } from "zod";

import { validationError } from "@/lib/api";
import { activityRequestContext, recordActivityEvent } from "@/lib/activity";
import { createTileFeedback, listTileFeedback } from "@/lib/tile-feedback";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  ticker: z.string().trim().min(1).max(12).transform((value) => value.toUpperCase()),
  locale: z.string().trim().min(1).max(12).default("en"),
  tileId: z.string().trim().min(1).max(120),
  tileLabel: z.string().trim().min(1).max(160),
  pagePath: z.string().trim().max(240).optional(),
  feedback: z.string().trim().min(3).max(2000),
  screenshot: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feedback = await listTileFeedback({
    ticker: url.searchParams.get("ticker") ?? undefined,
    tileId: url.searchParams.get("tileId") ?? undefined,
    limit: Number.parseInt(url.searchParams.get("limit") ?? "50", 10),
  });

  return Response.json({ feedback });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  try {
    const body = feedbackSchema.parse(await request.json());
    const context = activityRequestContext(request);
    const feedback = await createTileFeedback({
      ...body,
      userId: user?.id,
      ipHash: context.ipHash,
      userAgentHash: context.userAgentHash,
    });

    void recordActivityEvent({
      userId: user?.id,
      email: user?.email,
      category: "client",
      eventName: "feedback.tile.submit",
      path: body.pagePath ?? context.path,
      method: request.method,
      status: "ok",
      locale: body.locale,
      ticker: body.ticker,
      ipHash: context.ipHash,
      userAgentHash: context.userAgentHash,
      metadata: {
        feedbackId: feedback.id,
        tileId: body.tileId,
        tileLabel: body.tileLabel,
      },
    });

    return Response.json({ feedback }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
