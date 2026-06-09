import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { getPrivateCompanyEventAnalysisForTicker } from "@/lib/event-impact";
import { normalizeLocale } from "@/lib/i18n";
import { RATE_LIMITS, requireUserRateLimit } from "@/lib/rate-limit";
import { getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }
  const limited = await requireUserRateLimit(user.id, RATE_LIMITS.expensiveUser);
  if (limited) {
    return limited;
  }

  const { ticker } = await context.params;
  const locale = normalizeLocale(new URL(request.url).searchParams.get("locale"));

  return recordRouteActivity(
    request,
    {
      userId: user.id,
      email: user.email,
      category: "workspace",
      eventName: "events.generate_private",
      ticker,
      locale,
    },
    async () => {
      try {
        const result = await getPrivateCompanyEventAnalysisForTicker(
          user.id,
          ticker,
          locale,
        );
        return Response.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Unknown ticker:")) {
          return jsonError(error.message, 404);
        }

        return jsonError("Unable to generate private event analysis right now", 502);
      }
    },
  );
}
