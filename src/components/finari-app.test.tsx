import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinariApp } from "@/components/finari-app";
import { fixtureSnapshot } from "@/test/fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FinariApp", () => {
  it("renders the ticker research workflow with a loaded snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

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
    expect(screen.getByText("Advisor summary")).toBeInTheDocument();
    expect(screen.getByText("What the latest filing says")).toBeInTheDocument();
    expect(screen.getByText("Revenue growth")).toBeInTheDocument();
    expect(screen.getByText("Join waitlist")).toBeInTheDocument();
  });

  it("renders Thai interface copy and keeps SEC company facts visible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

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
    expect(screen.getByText("สรุปแบบที่ปรึกษาการเงิน")).toBeInTheDocument();
    expect(screen.getByText("สิ่งที่ filing ล่าสุดกำลังบอก")).toBeInTheDocument();
    expect(screen.getByText("เข้าร่วม waitlist")).toBeInTheDocument();
  });

  it("generates a localized memo from the selected route locale", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

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

    await user.click(screen.getByRole("button", { name: "สร้าง memo" }));

    await waitFor(() => {
      expect(screen.getByText("มุมมองแบบสถาบัน")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/company/AAPL/memo?locale=th",
      { method: "POST" },
    );
  });
});
