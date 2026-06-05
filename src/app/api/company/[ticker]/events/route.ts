import { jsonError } from "@/lib/api";
import { getCompanyEventImpacts } from "@/lib/event-impact";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await context.params;

  try {
    const result = await getCompanyEventImpacts(ticker);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown ticker:")) {
      return jsonError(error.message, 404);
    }

    return jsonError("Unable to load latest event impact right now", 502);
  }
}
