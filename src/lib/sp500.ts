import { getJsonCache, setJsonCache } from "@/lib/cache";

export interface Sp500Constituent {
  ticker: string;
  name: string;
  sector?: string;
}

const SP500_SOURCE_URL =
  process.env.SP500_SOURCE_URL?.trim() ||
  "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const SP500_CACHE_KEY = "sp500:constituents:v1";
const SP500_CACHE_TTL_SECONDS = 24 * 60 * 60;

const memoryState = globalThis as typeof globalThis & {
  __finariSp500Constituents?: {
    expiresAt: number;
    values: Sp500Constituent[];
  };
};

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase().replaceAll(".", "-");
}

export function parseSp500Constituents(html: string): Sp500Constituent[] {
  const tableMatch = /<table[^>]+id="constituents"[\s\S]*?<\/table>/i.exec(html);
  if (!tableMatch) {
    return [];
  }

  const rows = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const constituents = rows
    .map((row) => {
      const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
      const ticker = normalizeTicker(stripTags(cells[0] ?? ""));
      const name = stripTags(cells[1] ?? "");
      const sector = stripTags(cells[2] ?? "");

      if (!/^[A-Z0-9-]{1,12}$/.test(ticker) || ticker === "SYMBOL" || !name) {
        return null;
      }

      return {
        ticker,
        name,
        ...(sector ? { sector } : {}),
      };
    })
    .filter((constituent): constituent is Sp500Constituent => constituent !== null);

  const seen = new Set<string>();
  return constituents.filter((constituent) => {
    if (seen.has(constituent.ticker)) {
      return false;
    }
    seen.add(constituent.ticker);
    return true;
  });
}

export async function getSp500Constituents(): Promise<Sp500Constituent[]> {
  const memory = memoryState.__finariSp500Constituents;
  if (memory && memory.expiresAt > Date.now()) {
    return memory.values;
  }

  const cached = await getJsonCache<Sp500Constituent[]>(SP500_CACHE_KEY);
  if (cached?.length) {
    memoryState.__finariSp500Constituents = {
      expiresAt: Date.now() + SP500_CACHE_TTL_SECONDS * 1000,
      values: cached,
    };
    return cached;
  }

  const response = await fetch(SP500_SOURCE_URL, {
    headers: {
      "User-Agent": "Finari S&P 500 selector (educational research app)",
      Accept: "text/html",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch S&P 500 constituents (${response.status})`);
  }

  const constituents = parseSp500Constituents(await response.text());
  if (!constituents.length) {
    throw new Error("Unable to parse S&P 500 constituents");
  }

  memoryState.__finariSp500Constituents = {
    expiresAt: Date.now() + SP500_CACHE_TTL_SECONDS * 1000,
    values: constituents,
  };
  await setJsonCache(SP500_CACHE_KEY, constituents, SP500_CACHE_TTL_SECONDS);

  return constituents;
}
