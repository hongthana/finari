import { describe, expect, it } from "vitest";

import {
  dictionaries,
  getPathLocale,
  localeFromAcceptLanguage,
  preferredLocale,
  translateCaveat,
} from "@/lib/i18n";

function collectKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.keys(value)
    .sort()
    .flatMap((key) =>
      collectKeys(
        (value as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    );
}

describe("i18n", () => {
  it("keeps Thai and English dictionaries structurally aligned", () => {
    expect(collectKeys(dictionaries.th)).toEqual(collectKeys(dictionaries.en));
  });

  it("detects locale from paths and Accept-Language headers", () => {
    expect(getPathLocale("/th")).toBe("th");
    expect(getPathLocale("/en")).toBe("en");
    expect(getPathLocale("/api/search")).toBeNull();
    expect(localeFromAcceptLanguage("th-TH,th;q=0.9,en;q=0.8")).toBe("th");
    expect(localeFromAcceptLanguage("fr-CA, en-US;q=0.7")).toBe("en");
  });

  it("uses cookie locale before browser language and falls back to English", () => {
    expect(
      preferredLocale({
        cookieLocale: "th",
        acceptLanguage: "en-US,en;q=0.9",
      }),
    ).toBe("th");
    expect(
      preferredLocale({
        cookieLocale: "fr",
        acceptLanguage: "th-TH,th;q=0.9",
      }),
    ).toBe("th");
    expect(preferredLocale({ cookieLocale: "fr", acceptLanguage: "ja" })).toBe(
      "en",
    );
  });

  it("translates known SEC normalization caveats", () => {
    expect(
      translateCaveat(
        "Latest annual net income was not available in standard SEC tags.",
        "th",
      ),
    ).toContain("net income ไม่มีอยู่ใน standard SEC tags");
  });
});
