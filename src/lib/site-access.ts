import { isInvitationOnlyEnabled } from "@/lib/env";
import { getCurrentUser, unauthorized } from "@/lib/session";

export async function requireInvitationAccess(): Promise<Response | null> {
  if (!isInvitationOnlyEnabled()) {
    return null;
  }

  const user = await getCurrentUser();
  return user ? null : unauthorized();
}
