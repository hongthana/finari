import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FinariApp } from "@/components/finari-app";
import { fixtureSnapshot } from "@/test/fixtures";

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

    render(<FinariApp />);

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
});
