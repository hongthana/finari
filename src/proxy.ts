import { NextRequest, NextResponse } from "next/server";

import {
  getPathLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  preferredLocale,
} from "@/lib/i18n";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const SESSION_COOKIE_PREFIXES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

function withLocaleCookie(response: NextResponse, locale: string): NextResponse {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
  return response;
}

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) =>
    Boolean(cookie.value) &&
    SESSION_COOKIE_PREFIXES.some((prefix) =>
      cookie.name === prefix || cookie.name.startsWith(`${prefix}.`),
    ),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathLocale = getPathLocale(pathname);

  if (pathLocale) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(LOCALE_HEADER, pathLocale);

    return withLocaleCookie(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      pathLocale,
    );
  }

  if (pathname === "/") {
    const locale = preferredLocale({
      cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
      acceptLanguage: request.headers.get("accept-language"),
    });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(LOCALE_HEADER, locale);

    if (hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}`;
      return withLocaleCookie(NextResponse.redirect(url), locale);
    }

    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.searchParams.set("callbackUrl", `/${locale}?ticker=AAPL`);

    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
