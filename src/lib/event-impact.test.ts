import { describe, expect, it } from "vitest";

import {
  classifyEventImpact,
  companySearchTerms,
  normalizeNewsProviderName,
  parseRssItems,
} from "@/lib/event-impact";
import { fixtureIdentity } from "@/test/fixtures";

describe("event impact analysis", () => {
  it("parses source-linked RSS headlines", () => {
    const items = parseRssItems(
      `
      <rss>
        <channel>
          <item>
            <title><![CDATA[Apple launches new iPhone pricing plan]]></title>
            <link>https://example.com/apple-pricing</link>
            <description><![CDATA[The product launch could affect demand and margins.]]></description>
            <pubDate>Fri, 05 Jun 2026 10:00:00 GMT</pubDate>
            <source>Example News</source>
          </item>
        </channel>
      </rss>
      `,
      "AAPL",
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Apple launches new iPhone pricing plan",
      sourceName: "Example News",
      sourceType: "news",
    });
  });

  it("matches company aliases and falls back to the supported RSS provider", () => {
    expect(companySearchTerms(fixtureIdentity)).toEqual(
      expect.arrayContaining(["AAPL", "APPLE"]),
    );
    expect(normalizeNewsProviderName("future-paid-provider")).toBe("rss");

    const items = parseRssItems(
      `
      <rss>
        <channel>
          <item>
            <title><![CDATA[Apple services pricing update could lift margins]]></title>
            <link>https://example.com/apple-services</link>
            <description><![CDATA[Analysts debate services demand and margin impact.]]></description>
            <pubDate>Fri, 05 Jun 2026 12:00:00 GMT</pubDate>
          </item>
          <item>
            <title><![CDATA[Unrelated company announces new product]]></title>
            <link>https://example.com/unrelated</link>
            <description><![CDATA[No matching company alias appears here.]]></description>
            <pubDate>Fri, 05 Jun 2026 13:00:00 GMT</pubDate>
          </item>
          <item>
            <title><![CDATA[Another unrelated item]]></title>
            <link>https://example.com/unrelated-2</link>
            <description><![CDATA[No matching company alias appears here.]]></description>
            <pubDate>Fri, 05 Jun 2026 14:00:00 GMT</pubDate>
          </item>
          <item>
            <title><![CDATA[One more unrelated item]]></title>
            <link>https://example.com/unrelated-3</link>
            <description><![CDATA[No matching company alias appears here.]]></description>
            <pubDate>Fri, 05 Jun 2026 15:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
      `,
      companySearchTerms(fixtureIdentity),
    );

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Apple services pricing update could lift margins");
  });

  it("classifies product pricing as revenue and margin exposure", () => {
    const impact = classifyEventImpact(
      {
        title: "Apple launches new product pricing plan",
        summary: "The launch could affect demand, revenue, and gross margin.",
        url: "https://example.com/apple-pricing",
        sourceName: "Example News",
        publishedAt: "2026-06-05T10:00:00.000Z",
        sourceType: "news",
        provider: "rss",
      },
      fixtureIdentity,
    );

    expect(impact.eventType).toBe("company-specific");
    expect(impact.drivers).toEqual(expect.arrayContaining(["revenue", "margin"]));
    expect(impact.impact).toBe("positive");
    expect(impact.horizon).toBe("both");
    expect(impact.watchMetric).toBe("revenue-growth");
    expect(impact.confidence).toBe("Medium");
  });

  it("treats SEC filing events as high-confidence filing-related events", () => {
    const impact = classifyEventImpact(
      {
        title: "Apple Inc. filed quarterly report (10-Q)",
        summary: "SEC filing event.",
        url: "https://www.sec.gov/Archives/example",
        sourceName: "SEC EDGAR",
        publishedAt: "2026-05-01T00:00:00.000Z",
        sourceType: "filing",
        provider: "sec",
        form: "10-Q",
      },
      fixtureIdentity,
    );

    expect(impact.eventType).toBe("filing-related");
    expect(impact.drivers).toEqual(
      expect.arrayContaining(["revenue", "margin", "cash-flow", "debt"]),
    );
    expect(impact.horizon).toBe("long-term");
    expect(impact.confidence).toBe("High");
  });
});
