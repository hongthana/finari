import { NextRequest, NextResponse } from "next/server";

import {
  getPathLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  preferredLocale,
} from "@/lib/i18n";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function withLocaleCookie(response: NextResponse, locale: string): NextResponse {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
  return response;
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
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return withLocaleCookie(NextResponse.redirect(url), locale);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
