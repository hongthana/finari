import { jsonError } from "@/lib/api";
import { getSp500Constituents } from "@/lib/sp500";

export const runtime = "nodejs";

export async function GET() {
  try {
    const constituents = await getSp500Constituents();
    return Response.json({ constituents });
  } catch {
    return jsonError("Unable to load S&P 500 ticker list right now", 502);
  }
}
