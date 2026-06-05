import { jsonError } from "@/lib/api";
import { publishPublicEventImpactsForTicker } from "@/lib/event-impact";
import { normalizeLocale } from "@/lib/i18n";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  if (!user.isAdmin) {
    return forbidden();
  }

  const { ticker } = await context.params;
  const locale = normalizeLocale(new URL(request.url).searchParams.get("locale"));

  try {
    const result = await publishPublicEventImpactsForTicker(user.id, ticker, locale);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown ticker:")) {
      return jsonError(error.message, 404);
    }

    return jsonError("Unable to publish public event analysis right now", 502);
  }
}
