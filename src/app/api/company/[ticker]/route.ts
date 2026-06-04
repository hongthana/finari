import { jsonError } from "@/lib/api";
import { companyLookupError, getCompanySnapshotForTicker } from "@/lib/research-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await context.params;

  try {
    const snapshot = await getCompanySnapshotForTicker(ticker);
    return Response.json({ snapshot });
  } catch (error) {
    const lookupError = companyLookupError(error, ticker);
    if (lookupError) {
      return lookupError;
    }
    return jsonError("Unable to load SEC company facts right now", 502);
  }
}
