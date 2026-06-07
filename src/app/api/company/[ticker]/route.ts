import { jsonError } from "@/lib/api";
import { companyLookupError, getCompanySnapshotForTicker } from "@/lib/research-service";
import { requireInvitationAccess } from "@/lib/site-access";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const blocked = await requireInvitationAccess();
  if (blocked) {
    return blocked;
  }

  const { ticker } = await context.params;
  const { searchParams } = new URL(request.url);
  const forceRefresh =
    searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true";

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
}
