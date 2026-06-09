import { jsonError } from "@/lib/api";
import { getCompanyEventImpacts } from "@/lib/event-impact";
import { normalizeLocale } from "@/lib/i18n";
import { RATE_LIMITS, requireRequestRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { requireInvitationAccess } from "@/lib/site-access";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const limited = await requireRequestRateLimit(request, RATE_LIMITS.anonymousRead);
  if (limited) {
    return limited;
  }

  const blocked = await requireInvitationAccess();
  if (blocked) {
    return blocked;
  }

  const { ticker } = await context.params;
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const includeHidden = url.searchParams.get("includeHidden") === "1";
  const user = includeHidden ? await getCurrentUser() : null;

  try {
    const result = await getCompanyEventImpacts(ticker, locale, {
      includeHidden: Boolean(includeHidden && user?.isAdmin),
      ownerUserId: user?.id,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown ticker:")) {
      return jsonError(error.message, 404);
    }

    return jsonError("Unable to load latest event impact right now", 502);
  }
}
