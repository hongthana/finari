import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { normalizeLocale } from "@/lib/i18n";
import { RATE_LIMITS, requireRequestRateLimit } from "@/lib/rate-limit";
import { companyLookupError, getResearchMemoForTicker } from "@/lib/research-service";
import { requireInvitationAccess } from "@/lib/site-access";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const limited = await requireRequestRateLimit(request, RATE_LIMITS.expensiveUser);
  if (limited) {
    return limited;
  }

  const { ticker } = await context.params;
  const locale = normalizeLocale(new URL(request.url).searchParams.get("locale"));

  return recordRouteActivity(
    request,
    {
      category: "research",
      eventName: "memo.generate_public",
      ticker,
      locale,
    },
    async () => {
      const blocked = await requireInvitationAccess();
      if (blocked) {
        return blocked;
      }

      try {
        const { memo, memoId, snapshotId } = await getResearchMemoForTicker(ticker, locale);

        return Response.json({ memo, memoId, snapshotId });
      } catch (error) {
        const lookupError = companyLookupError(error, ticker);
        if (lookupError) {
          return lookupError;
        }
        return jsonError("Unable to generate a research memo right now", 502);
      }
    },
  );
}
