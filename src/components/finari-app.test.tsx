import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinariApp } from "@/components/finari-app";
import { fixtureSnapshot } from "@/test/fixtures";

const fixtureEvents = [
  {
    id: "event_1",
    ticker: "AAPL",
    title: "Apple launches new product pricing plan",
    summary: "The event could affect demand and gross margin.",
    url: "https://example.com/apple-pricing",
    sourceName: "Example News",
    sourceType: "news" as const,
    provider: "rss",
    publishedAt: "2026-06-05T10:00:00.000Z",
    eventType: "company-specific" as const,
    drivers: ["revenue", "margin"] as const,
    impact: "positive" as const,
    horizon: "both" as const,
    watchMetric: "revenue-growth",
    confidence: "Medium" as const,
    impactSummary:
      "Possible financial impact: positive signal for Revenue, Margin. Watch Revenue growth in the next filing. Confidence: medium.",
    investorMeaning:
      "Investor meaning: treat this as a positive signal for Revenue, Margin. It may affect sentiment and fundamentals, so confirm the effect in future filings before relying on it.",
    analysisMode: "deterministic" as const,
    visibility: "public" as const,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FinariApp", () => {
  it("renders the ticker research workflow with a loaded snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith("/api/company/AAPL/events")) {
          return Response.json({
            events: fixtureEvents,
            generatedAt: "2026-06-05T10:00:00.000Z",
          });
        }

        if (url.startsWith("/api/company/AAPL")) {
          return Response.json({ snapshot: fixtureSnapshot });
        }

        if (url.startsWith("/api/search")) {
          return Response.json({ results: [] });
        }

        return Response.json({}, { status: 404 });
      }),
    );

    render(<FinariApp locale="en" />);

    expect(
      screen.getByText("Institutional-grade equity research for retail investors"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("img", { name: /Revenue\. Top-line sales reported/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Decision screen")).toBeInTheDocument();
    expect(
      screen.getByText("Decision screen from the latest financial filing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Plain-English summary")).toBeInTheDocument();
    expect(screen.getByText("What the latest filing means for investors")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText("Latest events and potential financial impact"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Apple launches new product pricing plan")).toBeInTheDocument();
    expect(screen.getByText("Financial impact read")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Possible financial impact: positive signal for Revenue, Margin. Watch Revenue growth in the next filing. Confidence: medium.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Investor meaning")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Investor meaning: treat this as a positive signal for Revenue, Margin. It may affect sentiment and fundamentals, so confirm the effect in future filings before relying on it.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Growth and earnings: positive/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Trend improved in the latest annual comparison. The up arrow means revenue and/or earnings are rising.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Decision takeaway")).toBeInTheDocument();
    expect(screen.getByText("Investor questions with filing-backed answers")).toBeInTheDocument();
    expect(screen.getByText("Are earnings gains durable?")).toBeInTheDocument();
    expect(screen.getByText("Quarterly and TTM trend")).toBeInTheDocument();
    expect(screen.getByText("What changed since the last filing")).toBeInTheDocument();
    expect(screen.getByText("Business-driver read")).toBeInTheDocument();
    expect(screen.getByText("Balance-sheet strength")).toBeInTheDocument();
    expect(screen.getByText("SEC-industry peer comparison")).toBeInTheDocument();
    expect(screen.getByText("Data-quality checks")).toBeInTheDocument();
    expect(screen.getAllByText("Revenue growth").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", { name: /Annual statement screen\. Year-by-year/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Join waitlist")).toBeInTheDocument();
  }, 10_000);

  it("renders Thai interface copy and keeps SEC company facts visible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith("/api/company/AAPL/events")) {
          return Response.json({
            events: fixtureEvents,
            generatedAt: "2026-06-05T10:00:00.000Z",
          });
        }

        if (url.startsWith("/api/company/AAPL")) {
          return Response.json({ snapshot: fixtureSnapshot });
        }

        if (url.startsWith("/api/search")) {
          return Response.json({ results: [] });
        }

        return Response.json({}, { status: 404 });
      }),
    );

    render(<FinariApp locale="th" />);

    expect(
      screen.getByText("งานวิจัยหุ้นระดับสถาบัน สำหรับนักลงทุนรายย่อย"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    });
    expect(screen.getByText("หน้าช่วยตัดสินใจ")).toBeInTheDocument();
    expect(
      screen.getByText("หน้าช่วยตัดสินใจจาก financial filing ล่าสุด"),
    ).toBeInTheDocument();
    expect(screen.getByText("สรุปให้อ่านง่าย")).toBeInTheDocument();
    expect(screen.getByText("งบล่าสุดบอกอะไรสำหรับนักลงทุน")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText("เหตุการณ์ล่าสุดและผลกระทบทางการเงินที่อาจเกิดขึ้น"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Apple launches new product pricing plan")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "แนวโน้มดีขึ้นในการเทียบปีล่าสุด ลูกศรขึ้นหมายถึง revenue และ/หรือ earnings กำลังเพิ่มขึ้น",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("ข้อสรุปเพื่อการตัดสินใจ")).toBeInTheDocument();
    expect(screen.getByText("คำถามนักลงทุนพร้อมคำตอบจาก filing")).toBeInTheDocument();
    expect(screen.getByText("แนวโน้มรายไตรมาสและ TTM")).toBeInTheDocument();
    expect(screen.getByText("อะไรเปลี่ยนไปจาก filing ก่อนหน้า")).toBeInTheDocument();
    expect(screen.getByText("ตัวขับเคลื่อนธุรกิจ")).toBeInTheDocument();
    expect(screen.getByText("ความแข็งแรงของงบดุล")).toBeInTheDocument();
    expect(screen.getByText("เทียบกับ peer ในอุตสาหกรรม SEC")).toBeInTheDocument();
    expect(screen.getByText("ตรวจคุณภาพข้อมูล")).toBeInTheDocument();
    expect(screen.getByText("เข้าร่วม waitlist")).toBeInTheDocument();
  }, 10_000);

  it("generates a localized memo from the selected route locale", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/company/AAPL/events")) {
        return Response.json({
          events: fixtureEvents,
          generatedAt: "2026-06-05T10:00:00.000Z",
        });
      }

      if (url.startsWith("/api/company/AAPL/memo?locale=th")) {
        return Response.json({
          memo: {
            company: fixtureSnapshot.identity,
            generatedAt: new Date().toISOString(),
            mode: "fallback",
            disclaimer: "Finari เป็นซอฟต์แวร์วิจัยเพื่อการศึกษา",
            sections: [
              {
                title: "มุมมองแบบสถาบัน",
                body: "อ้างอิงข้อมูล SEC filing",
                signal: "neutral",
              },
            ],
            citations: fixtureSnapshot.citations,
          },
        });
      }

      if (url.startsWith("/api/company/AAPL")) {
        return Response.json({ snapshot: fixtureSnapshot });
      }

      if (url.startsWith("/api/search")) {
        return Response.json({ results: [] });
      }

      return Response.json({}, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FinariApp locale="th" />);

    await waitFor(() => {
      expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "ดู public memo" }));

    await waitFor(() => {
      expect(screen.getByText("มุมมองแบบสถาบัน")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/company/AAPL/memo?locale=th",
      { method: "POST" },
    );
  });

  it("uses the private memo route for signed-in users", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/me") {
        return Response.json({
          user: {
            id: "user_1",
            email: "investor@example.com",
            isAdmin: false,
          },
        });
      }

      if (url.startsWith("/api/me/company/AAPL/memo?locale=en")) {
        return Response.json({
          memo: {
            company: fixtureSnapshot.identity,
            generatedAt: new Date().toISOString(),
            mode: "fallback",
            visibility: "private",
            disclaimer: "Educational research only.",
            sections: [
              {
                title: "My private analysis",
                body: "Generated for the signed-in user.",
                signal: "neutral",
              },
            ],
            citations: fixtureSnapshot.citations,
          },
        });
      }

      if (url.startsWith("/api/company/AAPL/events")) {
        return Response.json({
          events: fixtureEvents,
          generatedAt: "2026-06-05T10:00:00.000Z",
        });
      }

      if (url.startsWith("/api/company/AAPL")) {
        return Response.json({ snapshot: fixtureSnapshot });
      }

      if (url.startsWith("/api/search")) {
        return Response.json({ results: [] });
      }

      return Response.json({}, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FinariApp locale="en" />);

    await waitFor(() => {
      expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate private analysis" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Generate private analysis" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Generated for the signed-in user.")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/company/AAPL/memo?locale=en",
      { method: "POST" },
    );
  });

  it("shows an admin publish control for admin users", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/me") {
        return Response.json({
          user: {
            id: "admin_1",
            email: "admin@example.com",
            isAdmin: true,
          },
        });
      }

      if (url.startsWith("/api/admin/company/AAPL/memo?locale=en")) {
        return Response.json({
          memo: {
            company: fixtureSnapshot.identity,
            generatedAt: new Date().toISOString(),
            mode: "fallback",
            visibility: "public",
            disclaimer: "Educational research only.",
            sections: [
              {
                title: "Public admin memo",
                body: "Published for public access.",
                signal: "neutral",
              },
            ],
            citations: fixtureSnapshot.citations,
          },
        });
      }

      if (url.startsWith("/api/company/AAPL/events")) {
        return Response.json({
          events: fixtureEvents,
          generatedAt: "2026-06-05T10:00:00.000Z",
        });
      }

      if (url.startsWith("/api/company/AAPL")) {
        return Response.json({ snapshot: fixtureSnapshot });
      }

      if (url.startsWith("/api/search")) {
        return Response.json({ results: [] });
      }

      return Response.json({}, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FinariApp locale="en" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publish public memo" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Publish public memo" }));

    await waitFor(() => {
      expect(screen.getByText("Published for public access.")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/company/AAPL/memo?locale=en",
      { method: "POST" },
    );
  });
});
