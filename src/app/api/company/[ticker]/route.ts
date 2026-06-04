import { jsonError } from "@/lib/api";
import { normalizeCompanySnapshot } from "@/lib/financial-analysis";
import { findCompanyByTicker, getCompanyFacts, getSubmissions } from "@/lib/sec";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await context.params;
  const identity = await findCompanyByTicker(ticker);

  if (!identity) {
    return jsonError(`Unknown ticker: ${ticker.toUpperCase()}`, 404);
  }

  try {
    const [submissions, facts] = await Promise.all([
      getSubmissions(identity.cik),
      getCompanyFacts(identity.cik),
    ]);
    const snapshot = normalizeCompanySnapshot(identity, submissions, facts);

    return Response.json({ snapshot });
  } catch {
    return jsonError("Unable to load SEC company facts right now", 502);
  }
}
