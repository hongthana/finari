import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { normalizeLocale } from "@/lib/i18n";
import {
  companyLookupError,
  getPrivateResearchMemoForTicker,
} from "@/lib/research-service";
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

  const { ticker } = await context.params;
  const locale = normalizeLocale(new URL(request.url).searchParams.get("locale"));

  return recordRouteActivity(
    request,
    {
      userId: user.id,
      email: user.email,
      category: "workspace",
      eventName: "memo.generate_private",
      ticker,
      locale,
    },
    async () => {
      try {
        const { memo, memoId, snapshotId } = await getPrivateResearchMemoForTicker(
          user.id,
          ticker,
          locale,
        );

        return Response.json({ memo, memoId, snapshotId });
      } catch (error) {
        const lookupError = companyLookupError(error, ticker);
        if (lookupError) {
          return lookupError;
        }
        return jsonError("Unable to generate a private research memo right now", 502);
      }
    },
  );
}
