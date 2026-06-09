import { activityRequestContext, recordActivityEvent } from "@/lib/activity";
import { validationError } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { toPublicTileFeedback, voteForTileFeedback } from "@/lib/tile-feedback";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const requestContext = activityRequestContext(request);
  const voterKey = user?.id ?? requestContext.ipHash ?? requestContext.userAgentHash ?? "anonymous";

  try {
    const result = await voteForTileFeedback({
      feedbackId: id,
      voterKey,
      userId: user?.id,
    });

    void recordActivityEvent({
      userId: user?.id,
      email: user?.email,
      category: "client",
      eventName: "feedback.tile.vote",
      path: requestContext.path,
      method: request.method,
      status: "ok",
      ticker: result.feedback.ticker,
      ipHash: requestContext.ipHash,
      userAgentHash: requestContext.userAgentHash,
      metadata: {
        feedbackId: id,
        voted: result.voted,
        tileId: result.feedback.tileId,
      },
    });

    return Response.json({
      ...result,
      feedback: toPublicTileFeedback(result.feedback),
    });
  } catch (error) {
    return validationError(error);
  }
}
