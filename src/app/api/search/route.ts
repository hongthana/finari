import { jsonError } from "@/lib/api";
import { searchCompaniesWithCache } from "@/lib/research-service";
import { requireInvitationAccess } from "@/lib/site-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const blocked = await requireInvitationAccess();
  if (blocked) {
    return blocked;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const results = await searchCompaniesWithCache(query);
    return Response.json({ results });
  } catch {
    return jsonError("Unable to search SEC ticker directory right now", 502);
  }
}
