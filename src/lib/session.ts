import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/lib/auth";

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(getAuthOptions());
  return session?.user?.id ?? null;
}

export function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}
