import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { curateCompanyEventForTicker } from "@/lib/event-impact";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

type CurationAction = "feature" | "unfeature" | "hide" | "unhide";

function isCurationAction(value: unknown): value is CurationAction {
  return (
    value === "feature" ||
    value === "unfeature" ||
    value === "hide" ||
    value === "unhide"
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ticker: string; eventId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  if (!user.isAdmin) {
    return forbidden();
  }

  const { ticker, eventId } = await context.params;
  const payload = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;

  if (!isCurationAction(payload?.action)) {
    return jsonError("Invalid event curation action", 400);
  }
  const action = payload.action;

  return recordRouteActivity(
    request,
    {
      userId: user.id,
      email: user.email,
      category: "admin",
      eventName: "admin.events.curate",
      ticker,
      metadata: { action, eventId },
    },
    async () => {
      try {
        await curateCompanyEventForTicker({
          ticker,
          eventId,
          adminUserId: user.id,
          action,
        });
        return Response.json({ ok: true });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Unknown ticker:")) {
          return jsonError(error.message, 404);
        }

        if (error instanceof Error && error.message === "Unknown event") {
          return jsonError("Unknown event", 404);
        }

        return jsonError("Unable to update event curation right now", 502);
      }
    },
  );
}
