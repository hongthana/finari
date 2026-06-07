import { jsonError } from "@/lib/api";
import { normalizeLocale } from "@/lib/i18n";
import { companyLookupError, getResearchMemoForTicker } from "@/lib/research-service";
import { requireInvitationAccess } from "@/lib/site-access";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const blocked = await requireInvitationAccess();
  if (blocked) {
    return blocked;
  }

  const { ticker } = await context.params;
  const locale = normalizeLocale(new URL(request.url).searchParams.get("locale"));

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
}
