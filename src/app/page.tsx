import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { AuthSignInPage } from "@/components/auth-signin-page";
import { hasSessionCookie } from "@/lib/auth-cookies";
import { DEFAULT_LOCALE, LOCALE_HEADER, normalizeLocale } from "@/lib/i18n";

export default async function Home() {
  const requestHeaders = await headers();
  const locale = normalizeLocale(requestHeaders.get(LOCALE_HEADER) ?? DEFAULT_LOCALE);
  const viewer = (await hasSessionCookie())
    ? await (await import("@/lib/session")).getCurrentUser()
    : null;

  if (viewer) {
    redirect(`/${locale}`);
  }

  return <AuthSignInPage callbackUrl={`/${locale}?ticker=AAPL`} />;
}
