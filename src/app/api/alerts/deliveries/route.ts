import { listAlertDeliveries } from "@/lib/research-store";
import { getCurrentUserId, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  const deliveries = await listAlertDeliveries(userId);
  const unreadCount = deliveries.filter((delivery) => delivery.status === "queued").length;

  return Response.json({ deliveries, unreadCount });
}
