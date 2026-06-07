import { jsonError } from "@/lib/api";
import { requireInvitationAccess } from "@/lib/site-access";
import { getSp500Constituents } from "@/lib/sp500";

export const runtime = "nodejs";

export async function GET() {
  const blocked = await requireInvitationAccess();
  if (blocked) {
    return blocked;
  }

  try {
    const constituents = await getSp500Constituents();
    return Response.json({ constituents });
  } catch {
    return jsonError("Unable to load S&P 500 ticker list right now", 502);
  }
}
