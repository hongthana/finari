import { cookies } from "next/headers";

const SESSION_COOKIE_PREFIXES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

export async function hasSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies();

  return cookieStore.getAll().some((cookie) =>
    Boolean(cookie.value) &&
    SESSION_COOKIE_PREFIXES.some((prefix) =>
      cookie.name === prefix || cookie.name.startsWith(`${prefix}.`),
    ),
  );
}
