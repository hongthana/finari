import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { getRefreshCronSecret } from "@/lib/env";
import { RATE_LIMITS, requireRequestRateLimit } from "@/lib/rate-limit";
import { companyLookupError, getCompanySnapshotForTicker } from "@/lib/research-service";
import { requireInvitationAccess } from "@/lib/site-access";

export const runtime = "nodejs";

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return (match?.[1] ?? authorization).trim();
  }

  return request.headers.get("x-finari-cron-secret")?.trim() ?? "";
}

function isRefreshAuthorized(request: Request): boolean {
  const cronSecret = getRefreshCronSecret();
  if (!cronSecret) {
    return false;
  }

  return getBearerToken(request) === cronSecret;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  if (!isRefreshAuthorized(request)) {
    const limited = await requireRequestRateLimit(request, RATE_LIMITS.anonymousRead);
    if (limited) {
      return limited;
    }
  }

  const { ticker } = await context.params;
  const { searchParams } = new URL(request.url);
  const forceRefresh =
    searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true";

  return recordRouteActivity(
    request,
    {
      category: "research",
      eventName: forceRefresh ? "research.company_refresh" : "research.company_view",
      ticker,
      metadata: { forceRefresh },
    },
    async () => {
      if (!isRefreshAuthorized(request)) {
        const blocked = await requireInvitationAccess();
        if (blocked) {
          return blocked;
        }
      }

      try {
        const snapshot = await getCompanySnapshotForTicker(ticker, { forceRefresh });
        return Response.json({ snapshot });
      } catch (error) {
        const lookupError = companyLookupError(error, ticker);
        if (lookupError) {
          return lookupError;
        }
        return jsonError("Unable to load SEC company facts right now", 502);
      }
    },
  );
}
