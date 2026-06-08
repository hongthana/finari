import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { publishPublicEventImpactsForTicker } from "@/lib/event-impact";
import { normalizeLocale } from "@/lib/i18n";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  if (!user.isAdmin) {
    return forbidden();
  }

  const { ticker } = await context.params;
  const locale = normalizeLocale(new URL(request.url).searchParams.get("locale"));

  return recordRouteActivity(
    request,
    {
      userId: user.id,
      email: user.email,
      category: "admin",
      eventName: "admin.events.publish_public",
      ticker,
      locale,
    },
    async () => {
      try {
        const result = await publishPublicEventImpactsForTicker(user.id, ticker, locale);
        return Response.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Unknown ticker:")) {
          return jsonError(error.message, 404);
        }

        return jsonError("Unable to publish public event analysis right now", 502);
      }
    },
  );
}
