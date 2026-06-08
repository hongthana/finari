import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { searchCompaniesWithCache } from "@/lib/research-service";
import { requireInvitationAccess } from "@/lib/site-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  return recordRouteActivity(
    request,
    {
      category: "research",
      eventName: "research.search",
      metadata: { queryLength: query.trim().length },
    },
    async () => {
      const blocked = await requireInvitationAccess();
      if (blocked) {
        return blocked;
      }

      try {
        const results = await searchCompaniesWithCache(query);
        return Response.json({ results });
      } catch {
        return jsonError("Unable to search SEC ticker directory right now", 502);
      }
    },
  );
}
