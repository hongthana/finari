import { jsonError } from "@/lib/api";
import { normalizeCompanySnapshot } from "@/lib/financial-analysis";
import { generateResearchMemo } from "@/lib/memo";
import { findCompanyByTicker, getCompanyFacts, getSubmissions } from "@/lib/sec";

export const runtime = "nodejs";

export async function POST(
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
    const memo = await generateResearchMemo(snapshot);

    return Response.json({ memo });
  } catch {
    return jsonError("Unable to generate a research memo right now", 502);
  }
}
