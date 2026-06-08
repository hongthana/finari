import { getActivityCronSecret } from "@/lib/env";
import { pruneOldActivityEvents, recordActivityEvent } from "@/lib/activity";
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
  const cronSecret = getActivityCronSecret();
  return Boolean(cronSecret && getBearerToken(request) === cronSecret);
}

export async function POST(request: Request) {
  if (isCronAuthorized(request)) {
    const result = await pruneOldActivityEvents();
    return Response.json({ result });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }
  if (!user.isAdmin) {
    return forbidden();
  }

  const result = await pruneOldActivityEvents();
  void recordActivityEvent({
    userId: user.id,
    email: user.email,
    category: "admin",
    eventName: "admin.activity.prune",
    path: new URL(request.url).pathname,
    method: request.method,
    status: "ok",
    metadata: { deleted: result.deleted, cutoff: result.cutoff.toISOString() },
  });

  return Response.json({ result });
}
