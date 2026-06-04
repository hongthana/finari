import { jsonError } from "@/lib/api";
import { companyLookupError, getResearchMemoForTicker } from "@/lib/research-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await context.params;

  try {
    const { memo, memoId, snapshotId } = await getResearchMemoForTicker(ticker);

    return Response.json({ memo, memoId, snapshotId });
  } catch (error) {
    const lookupError = companyLookupError(error, ticker);
    if (lookupError) {
      return lookupError;
    }
    return jsonError("Unable to generate a research memo right now", 502);
  }
}
