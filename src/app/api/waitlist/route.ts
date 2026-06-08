import { validationError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { requireInvitationAccess } from "@/lib/site-access";
import { saveWaitlistLead, waitlistLeadSchema } from "@/lib/waitlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return recordRouteActivity(
    request,
    {
      category: "api",
      eventName: "waitlist.join",
    },
    async () => {
      const blocked = await requireInvitationAccess();
      if (blocked) {
        return blocked;
      }

      try {
        const body = (await request.json()) as unknown;
        const lead = waitlistLeadSchema.parse(body);
        const saved = await saveWaitlistLead(lead);

        return Response.json({ lead: saved }, { status: 201 });
      } catch (error) {
        return validationError(error);
      }
    },
  );
}
