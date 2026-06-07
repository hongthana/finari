import { getAdminEmails, getInvitedEmails, isInvitationOnlyEnabled } from "@/lib/env";

export function isInvitedEmail(email?: string | null): boolean {
  if (!isInvitationOnlyEnabled()) {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return new Set([...getInvitedEmails(), ...getAdminEmails()]).has(normalizedEmail);
}
