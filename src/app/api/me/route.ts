import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  return Response.json({ user: session?.user ?? null });
}
