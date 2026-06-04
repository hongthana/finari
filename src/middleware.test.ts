import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";

function request(url: string, headers?: HeadersInit) {
  return new NextRequest(new Request(url, { headers }));
}

describe("locale middleware", () => {
  it("redirects the root path from browser language preference", () => {
    const response = proxy(
      request("https://finari.test/", {
        "accept-language": "th-TH,th;q=0.9,en;q=0.7",
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://finari.test/th");
  });

  it("sets the active locale cookie for localized paths", () => {
    const response = proxy(request("https://finari.test/en?ticker=AAPL"));

    expect(response.headers.getSetCookie().join("; ")).toContain(
      "finari_locale=en",
    );
  });

  it("excludes API and asset routes from the matcher", () => {
    expect(config.matcher[0]).toContain("(?!api|_next/static|_next/image");
  });
});
