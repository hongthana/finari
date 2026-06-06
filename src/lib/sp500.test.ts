import { describe, expect, it } from "vitest";

import { parseSp500Constituents } from "@/lib/sp500";

describe("S&P 500 constituents", () => {
  it("parses ticker, company name, and sector from the constituents table", () => {
    const constituents = parseSp500Constituents(`
      <table id="constituents">
        <tr>
          <th>Symbol</th>
          <th>Security</th>
          <th>GICS Sector</th>
        </tr>
        <tr>
          <td><a>BRK.B</a></td>
          <td>Berkshire Hathaway</td>
          <td>Financials</td>
        </tr>
        <tr>
          <td>MSFT</td>
          <td>Microsoft Corporation</td>
          <td>Information Technology</td>
        </tr>
      </table>
    `);

    expect(constituents).toEqual([
      {
        ticker: "BRK-B",
        name: "Berkshire Hathaway",
        sector: "Financials",
      },
      {
        ticker: "MSFT",
        name: "Microsoft Corporation",
        sector: "Information Technology",
      },
    ]);
  });
});
