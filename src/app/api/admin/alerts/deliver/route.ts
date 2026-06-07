import { runAlertDeliveryJob } from "@/lib/alert-delivery";
import { getAlertsCronSecret } from "@/lib/env";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return (match?.[1] ?? authorization).trim();
  }

  return request.headers.get("x-finari-cron-secret")?.trim() ?? "";
}

function isCronAuthorized(request: Request): boolean {
  const cronSecret = getAlertsCronSecret();
  if (!cronSecret) {
    return false;
  }

  return getBearerToken(request) === cronSecret;
}

export async function POST(request: Request) {
  if (isCronAuthorized(request)) {
    const summary = await runAlertDeliveryJob();
    return Response.json({ summary });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  if (!user.isAdmin) {
    return forbidden();
  }

  const summary = await runAlertDeliveryJob();
  return Response.json({ summary });
}
