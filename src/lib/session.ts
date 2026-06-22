import { getServerSession } from "next-auth";

import { hasSessionCookie } from "@/lib/auth-cookies";
import { getAuthOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";

export type CurrentUser = {
  id: string;
  email?: string | null;
  isAdmin: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!(await hasSessionCookie())) {
    return null;
  }

  const session = await getServerSession(getAuthOptions());
  const user = session?.user;

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    isAdmin: isAdminEmail(user.email),
  };
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

export function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "Admin access required" }, { status: 403 });
}
