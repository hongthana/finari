export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "finari_locale";
export const LOCALE_HEADER = "x-finari-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getPathLocale(pathname: string): Locale | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return isLocale(firstSegment) ? firstSegment : null;
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === "en" ? "th" : "en";
}

export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) {
    return null;
  }

  const preferences = header
    .split(",")
    .map((part) => {
      const [language = "", quality = "q=1"] = part.trim().split(";");
      const q = Number(quality.replace("q=", ""));
      return {
        language: language.toLowerCase(),
        quality: Number.isFinite(q) ? q : 1,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const preference of preferences) {
    if (preference.language.startsWith("th")) {
      return "th";
    }

    if (preference.language.startsWith("en")) {
      return "en";
    }
  }

  return null;
}

export function preferredLocale(input: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookieLocale)) {
    return input.cookieLocale;
  }

  return localeFromAcceptLanguage(input.acceptLanguage ?? null) ?? DEFAULT_LOCALE;
}

const en = {
  metadata: {
    title: "Finari | SEC-backed equity research",
    description:
      "Institutional-grade equity research for retail investors, powered by SEC filings and AI-assisted analysis.",
  },
  toolbar: {
    product: "Finari",
    headline: "Institutional-grade equity research for retail investors",
    secBacked: "SEC-backed",
    educationOnly: "Education only",
    placeholder: "Search ticker or company, e.g. AAPL",
    research: "Research",
    languageLabel: "Language",
    english: "EN",
    thai: "TH",
  },
  snapshot: {
    loading: "Loading SEC filings and normalized company facts...",
    unavailableTitle: "Research unavailable",
    usListed: "US listed",
    revenue: "Revenue",
    netIncome: "Net income",
    fcf: "FCF",
    assets: "Assets",
    refresh: "Refresh",
    latestFiling: "Latest filing",
    generated: "Generated",
    fiscalYear: "FY",
    tooltips: {
      company:
        "Company identity from SEC submissions: exchange, industry code, ticker, CIK, and fiscal year.",
      revenue:
        "Top-line sales reported in the latest annual filing. Use it to understand business scale.",
      netIncome:
        "Bottom-line profit after expenses and taxes. Use it to judge earnings power.",
      fcf:
        "Free cash flow after operating cash flow and capital expenditure. Use it to judge cash generation.",
      assets:
        "Total assets on the balance sheet. Use it to understand the company asset base.",
    },
  },
  advisor: {
    badge: "Plain-English summary",
    badgeTooltip:
      "Plain-language filing interpretation designed to help retail investors understand the latest facts.",
    heading: "What the latest filing means for investors",
    intro:
      "Use this as a filing-based decision screen: first judge business quality, then decide whether the current stock price gives enough margin of safety.",
    latestPeriod: "the latest annual period",
    latestFacts: (
      name: string,
      revenue: string,
      netIncome: string,
      freeCashFlow: string,
      fiscalYear: string,
    ) =>
      `In FY ${fiscalYear}, ${name} reported revenue of ${revenue}, net income of ${netIncome}, and free cash flow (FCF) of ${freeCashFlow}.`,
    and: "and",
    closing:
      "This is educational research, not a buy/sell recommendation. A final decision still needs valuation, risk tolerance, time horizon, and portfolio fit.",
    questionsTitle: "Investor questions with filing-backed answers",
    readLabels: {
      trend: "Growth and earnings",
      quality: "Profit quality",
      balance: "Balance-sheet risk",
      decision: "Decision takeaway",
    },
    signalTooltips: {
      trend: {
        positive:
          "Trend improved in the latest annual comparison. The up arrow means revenue and/or earnings are rising.",
        negative:
          "Trend weakened in the latest annual comparison. The down arrow means revenue or earnings declined and deserves follow-up.",
        neutral:
          "Trend is mixed or roughly flat. The line means growth and earnings do not point clearly up or down.",
        unknown:
          "Trend cannot be read from comparable SEC data yet. The question mark means there is not enough standardized data.",
      },
      status: {
        positive:
          "Constructive filing signal. The check means this metric currently supports business quality.",
        negative:
          "Pressure or risk signal. The warning means this metric deserves extra review.",
        neutral:
          "Mixed filing signal. The shield means this point needs context before deciding.",
        unknown:
          "Data is unavailable or not comparable. The question mark means standardized SEC tags are incomplete.",
      },
    },
    noComparable: (label: string) =>
      `${label} did not have a clean prior-year comparison in the normalized filing data`,
    flat: (label: string) => `${label} was roughly flat year over year`,
    changed: (label: string, direction: string, value: string) =>
      `${label} ${direction} ${value} year over year`,
    increased: "increased",
    declined: "declined",
    labels: {
      revenue: "Revenue",
      netIncome: "net income",
    },
    profitabilityUnavailable:
      "Profit-quality metrics were not available in the standardized filing tags, so this part needs manual review in the filing.",
    profitabilityStrong: (
      grossMargin: string,
      operatingMargin: string,
      fcfMargin: string,
    ) =>
      `The filing still shows strong business quality: gross margin was ${grossMargin}, operating margin was ${operatingMargin}, and FCF margin was ${fcfMargin}. In plain English, the company kept a meaningful share of sales as operating profit and cash.`,
    profitabilityMixed: (
      grossMargin: string,
      operatingMargin: string,
      fcfMargin: string,
    ) =>
      `Profit quality is mixed: gross margin was ${grossMargin}, operating margin was ${operatingMargin}, and FCF margin was ${fcfMargin}. This is usable, but the next step is checking whether margins are stable or drifting lower.`,
    profitabilityWeak: (
      grossMargin: string,
      operatingMargin: string,
      fcfMargin: string,
    ) =>
      `Profit quality needs caution: gross margin was ${grossMargin}, operating margin was ${operatingMargin}, and FCF margin was ${fcfMargin}. Weak or negative cash conversion can make reported earnings less useful for investors.`,
    grossMargin: (value: string) => `Gross margin was ${value}`,
    operatingMargin: (value: string) => `operating margin was ${value}`,
    marginJoiner: " and ",
    cashNeedsReview: "Free-cash-flow conversion needs more review",
    cashStrong: (value: string) =>
      `Cash conversion was strong at ${value} of revenue`,
    cashPositive: (value: string) =>
      `Cash conversion was positive at ${value} of revenue`,
    cashThin: (value: string) =>
      `Free cash flow was thin at ${value} of revenue`,
    cashNegative: (value: string) =>
      `Free cash flow was negative at ${value} of revenue`,
    leverageUnavailable:
      "Balance-sheet leverage was not fully available from standard SEC tags.",
    debtToEquity: (value: string) => `Debt to equity was ${value}`,
    liabilitiesToAssets: (value: string) => `liabilities to assets was ${value}`,
    leverageJoiner: " and ",
    leverageElevated:
      "the next question is whether the balance sheet has enough flexibility if sales or demand weakens.",
    leverageManageable:
      "the balance sheet does not screen as the first concern from these filing metrics.",
    takeaways: {
      qualityGrowthBalance:
        "The filing supports a quality-business-with-growth-pressure read. For a retail investor, the key decision is whether revenue can stabilize before high liabilities or leverage reduce flexibility.",
      qualityGrowth:
        "The filing supports a quality-business-with-growth-pressure read. The business still converts sales into profit and cash, but the decision depends on evidence that revenue can stabilize.",
      growthPressure:
        "The filing says growth is the main issue. Until revenue stabilizes, the investment case depends more on downside protection, valuation, and whether margins can hold.",
      qualityBalance:
        "The filing shows good operating quality, but balance-sheet risk should affect position size and required return. Strong margins help, but they do not remove leverage risk.",
      qualitySupport:
        "The filing gives a constructive quality signal. The next decision step is valuation: how much of this quality is already priced into the stock?",
      needsMoreEvidence:
        "The filing does not yet give a clear high-conviction signal. Treat this as a watchlist candidate until growth, margin, cash-flow, and balance-sheet evidence improve.",
    },
    questions: {
      revenueDecline: "Is the revenue decline a warning sign?",
      revenueContinue: "Can revenue keep growing without hurting margins?",
      netIncomeLower:
        "Is lower net income temporary or a profitability problem?",
      earningsDurable:
        "Are earnings gains durable?",
      marginsDefensible:
        "Are these margins defensible?",
      operatingLeverage: "What would improve profit margins?",
      balanceFlex:
        "Does the balance sheet have enough flexibility?",
      priceReflect:
        "What would change the investment view?",
    },
    answers: {
      revenueDecline: (value: string) =>
        `Yes, it is the main item to watch. A ${value} revenue decline can be manageable when margins and FCF are strong, but conviction improves only if the next filings show demand stabilizing or returning to growth.`,
      revenueContinue: (value: string) =>
        `The filing shows revenue growth of ${value}. The quality of that growth depends on whether operating margin and FCF margin stay stable instead of being sacrificed for sales growth.`,
      netIncomeLower: (value: string) =>
        `The filing shows net income down ${value}. If the decline is close to the revenue decline, it may reflect softer demand; if it is worse than revenue, margin pressure deserves more attention.`,
      earningsDurable: (value: string) =>
        `The filing shows net income growth of ${value}. The next check is whether operating income and FCF moved in the same direction, because cash-backed earnings are more decision-useful than accounting profit alone.`,
      marginsDefensible: (operatingMargin: string, fcfMargin: string) =>
        `They screen as strong for now: operating margin was ${operatingMargin} and FCF margin was ${fcfMargin}. The risk is whether competition, pricing pressure, or cost inflation causes those margins to compress.`,
      operatingLeverage: (operatingMargin: string) =>
        `Operating margin was ${operatingMargin}. Improvement would usually require better pricing, lower costs, higher utilization, or a revenue mix shift toward more profitable products.`,
      balanceFlex: (liabilitiesToAssets: string, debtToEquity: string) =>
        `This needs caution. Liabilities were ${liabilitiesToAssets} of assets and debt/equity was ${debtToEquity}. Strong FCF can offset some risk, but high obligations reduce room for error if profits weaken.`,
      priceReflect:
        "The filing alone cannot answer valuation. A useful decision rule is to require a larger margin of safety when growth is slowing, leverage is elevated, or margins look vulnerable.",
    },
  },
  metrics: {
    "revenue-growth": {
      label: "Revenue growth",
      description: "Latest annual revenue compared with the prior fiscal year.",
    },
    "net-income-growth": {
      label: "Net income growth",
      description: "Bottom-line growth compared with the prior fiscal year.",
    },
    "gross-margin": {
      label: "Gross margin",
      description: "Gross profit as a percentage of revenue.",
    },
    "operating-margin": {
      label: "Operating margin",
      description: "Operating income as a percentage of revenue.",
    },
    "net-margin": {
      label: "Net margin",
      description: "Net income as a percentage of revenue.",
    },
    "free-cash-flow-margin": {
      label: "FCF margin",
      description: "Free cash flow as a percentage of revenue.",
    },
    "debt-to-equity": {
      label: "Debt / equity",
      description: "Debt load relative to book equity.",
    },
    "liabilities-to-assets": {
      label: "Liabilities / assets",
      description: "Balance-sheet obligations relative to total assets.",
    },
    "return-on-assets": {
      label: "Return on assets",
      description: "Net income generated per dollar of assets.",
    },
    "return-on-equity": {
      label: "Return on equity",
      description: "Net income generated per dollar of book equity.",
    },
  },
  charts: {
    revenueNetIncome: "Revenue and net income",
    annualFacts: "Annual SEC XBRL facts by fiscal year",
    cashBalance: "Cash flow and balance sheet",
    cashBalanceSubtitle: "Free cash flow, assets, and liabilities",
    revenue: "Revenue",
    netIncome: "Net income",
    liabilities: "Liabilities",
    assets: "Assets",
    tooltips: {
      revenueNetIncome:
        "Trend chart showing whether sales and profits are moving together across annual filings.",
      cashBalance:
        "Balance and cash-flow chart showing cash generation against assets and liabilities.",
    },
  },
  table: {
    title: "Annual statement screen",
    subtitle: "Values are normalized from standard SEC XBRL tags.",
    fy: "FY",
    revenue: "Revenue",
    grossMargin: "Gross margin",
    operatingMargin: "Op margin",
    netIncome: "Net income",
    fcf: "FCF",
    debt: "Debt",
    eps: "EPS",
    tooltip:
      "Year-by-year financial table for comparing normalized SEC facts across fiscal periods.",
  },
  memo: {
    badge: "Filing-backed memo",
    badgeTooltip:
      "Memo narrative grounded in normalized SEC facts, source links, and caveats.",
    title: "Analyst memo",
    subtitle: "Grounded in normalized SEC facts and source links.",
    generate: "Generate memo",
    publicTitle: "Public filing memo",
    privateTitle: "My private analysis",
    publicSubtitle:
      "Public view uses admin-published analysis when available, otherwise a deterministic filing summary.",
    privateSubtitle:
      "Private AI analysis is generated in your Finari workspace and is not public by default.",
    generatePublic: "View public memo",
    generatePrivate: "Generate private analysis",
    signInForPrivate: "Sign in to create private AI analysis",
    publishPublic: "Publish public memo",
    adminPublishHint: "Admin control for the canonical public ticker memo.",
    fallbackNotice:
      "Deterministic memo shown because AI is not configured or is unavailable.",
    empty: "Select a company and generate a memo to see the research narrative.",
    error: "Unable to generate a research memo right now",
    disclaimer:
      "Finari is educational research software. It does not provide personalized investment advice, buy/sell recommendations, price targets, or suitability analysis.",
    aiInstruction:
      "Write a concise institutional-grade equity research memo in English for retail investors. Use only the supplied SEC-derived facts and caveats. Do not include buy/sell recommendations, price targets, or personalized investment advice. Return strict JSON with sections: [{title, body, signal}] where signal is positive, neutral, negative, or unknown.",
    signal: {
      positive:
        "The current filing profile screens as constructive, but it still needs valuation and business-quality review.",
      negative:
        "The current filing profile contains pressure points that deserve extra diligence before any investment decision.",
      neutral:
        "The current filing profile is mixed, so the next step is understanding the business drivers behind the numbers.",
      unknown:
        "There is not enough standardized filing data to form a strong filing-based view.",
    },
    sections: {
      institutionalRead: "Institutional read",
      trajectory: "Financial trajectory",
      balanceSheet: "Balance sheet and cash flow",
      riskQuestions: "Risk questions",
    },
    fallback: {
      intro: (name: string, ticker: string, signalSentence: string) =>
        `${name} (${ticker}) is analyzed from SEC standardized financial-statement facts. ${signalSentence}`,
      trajectory: (
        revenue: string,
        netIncome: string,
        fiscalYear: number,
        highlights: string,
      ) =>
        `Latest annual revenue was ${revenue} and net income was ${netIncome} for fiscal ${fiscalYear}. ${highlights}`,
      trajectoryUnavailable:
        "Finari could not identify a comparable latest annual period from standard SEC tags.",
      metricsUnavailable:
        "Several core metrics were unavailable in standard SEC tags.",
      balanceSheet: (
        assets: string,
        liabilities: string,
        cash: string,
        freeCashFlow: string,
      ) =>
        `Reported assets were ${assets}, liabilities were ${liabilities}, cash was ${cash}, and free cash flow was ${freeCashFlow}. Treat free cash flow as a screening estimate because XBRL tag conventions can vary by issuer.`,
      balanceSheetUnavailable:
        "Balance sheet and cash-flow screening is unavailable until a filing period can be normalized.",
      reviewCaveats: (caveats: string) =>
        `Review these before relying on the memo: ${caveats}`,
      defaultQuestions:
        "Key next questions: what drives margins, how durable is growth, what risks management highlights in the latest 10-K, and whether the current market price compensates for those risks.",
    },
  },
  waitlist: {
    workspaceBadge: "Workspace",
    workspaceTooltip:
      "Private workspace actions for signed-in users, including saving company research.",
    saveResearchTitle: "Save company research",
    signIn: "Sign in",
    saveResearch: "Save research",
    signInToSave: "Sign in with email to save this research.",
    saved: "Research saved to your Finari workspace.",
    saveFailed: "This research could not be saved right now.",
    earlyAccessBadge: "Early access",
    earlyAccessTooltip:
      "Waitlist for future product features such as alerts, exports, valuation, and watchlists.",
    earlyAccessTitle: "Save research, alerts, and exports",
    emailPlaceholder: "you@example.com",
    join: "Join waitlist",
    joined: "You are on the Finari early-access list.",
    joinFailed: "That email could not be saved. Check it and try again.",
    profiles: [
      "Long-term individual investor",
      "Active retail investor",
      "Student or learner",
      "Analyst or financial professional",
    ],
    interests: [
      "Saved research and alerts",
      "Memo exports",
      "Advanced valuation",
      "Portfolio watchlist",
    ],
    toolsTitle: "Workspace tools",
    toolsTooltip:
      "Upcoming workflow tools planned for a fuller investor research workspace.",
    tools: [
      "Saved company research",
      "Filing and metric alerts",
      "Exportable investment memos",
      "Valuation provider integration",
    ],
  },
  sources: {
    title: "Source links",
    titleTooltip:
      "Direct filing and source links used to ground this research screen.",
    caveatsTitle: "Normalization caveats",
    caveatsTooltip:
      "Data-quality notes explaining missing, inconsistent, or non-comparable filing tags.",
    coreFactsAvailable: "Core annual facts were available in standard SEC tags.",
  },
  errors: {
    loadCompany: "Unable to load company",
    loadFacts: "Unable to load SEC company facts right now",
    generateMemo: "Unable to generate memo",
  },
  caveats: {
    fewerPeriods:
      "Finari found fewer than two comparable annual periods, so trend analysis is limited.",
    noAnnualFacts: "No annual financial-statement facts were found for this company.",
    noUsGaap:
      "The company did not expose standard US-GAAP facts in the SEC response.",
    latestAnnualMissing: (label: string) =>
      `Latest annual ${label} was not available in standard SEC tags.`,
    fields: {
      revenue: "revenue",
      "net income": "net income",
      assets: "assets",
      "operating cash flow": "operating cash flow",
    },
  },
};

export type Dictionary = typeof en;

const th: Dictionary = {
  metadata: {
    title: "Finari | วิเคราะห์หุ้นจากข้อมูล SEC",
    description:
      "เครื่องมือวิจัยหุ้นระดับสถาบันสำหรับนักลงทุนรายย่อย ใช้ข้อมูล SEC filing และการวิเคราะห์ด้วย AI",
  },
  toolbar: {
    product: "Finari",
    headline: "งานวิจัยหุ้นระดับสถาบัน สำหรับนักลงทุนรายย่อย",
    secBacked: "อ้างอิง SEC",
    educationOnly: "เพื่อการศึกษา",
    placeholder: "ค้นหา ticker หรือชื่อบริษัท เช่น AAPL",
    research: "วิเคราะห์",
    languageLabel: "ภาษา",
    english: "EN",
    thai: "TH",
  },
  snapshot: {
    loading: "กำลังโหลด SEC filing และข้อมูลงบการเงินที่ปรับมาตรฐาน...",
    unavailableTitle: "ไม่สามารถแสดงงานวิจัยได้",
    usListed: "หุ้นสหรัฐ",
    revenue: "Revenue",
    netIncome: "Net income",
    fcf: "FCF",
    assets: "Assets",
    refresh: "รีเฟรช",
    latestFiling: "Filing ล่าสุด",
    generated: "สร้างเมื่อ",
    fiscalYear: "FY",
    tooltips: {
      company:
        "ข้อมูลระบุตัวบริษัทจาก SEC submissions เช่น exchange, industry code, ticker, CIK, และ fiscal year",
      revenue:
        "ยอดขายรวมจาก annual filing ล่าสุด ใช้ดูขนาดของธุรกิจ",
      netIncome:
        "กำไรสุทธิหลังค่าใช้จ่ายและภาษี ใช้ดูความสามารถทำกำไร",
      fcf:
        "Free cash flow หลัง operating cash flow และ capital expenditure ใช้ดูการสร้างเงินสด",
      assets:
        "สินทรัพย์รวมในงบดุล ใช้ดูฐานสินทรัพย์ของบริษัท",
    },
  },
  advisor: {
    badge: "สรุปให้อ่านง่าย",
    badgeTooltip:
      "คำอธิบาย filing แบบภาษาง่าย ช่วยให้นักลงทุนรายย่อยเข้าใจข้อมูลล่าสุด",
    heading: "งบล่าสุดบอกอะไรสำหรับนักลงทุน",
    intro:
      "ใช้ส่วนนี้เป็นตัวกรองจาก filing: ดูคุณภาพธุรกิจก่อน แล้วค่อยตัดสินใจว่าราคาหุ้นมี margin of safety พอหรือไม่",
    latestPeriod: "งวดปีล่าสุด",
    latestFacts: (
      name: string,
      revenue: string,
      netIncome: string,
      freeCashFlow: string,
      fiscalYear: string,
    ) =>
      `ใน FY ${fiscalYear} ${name} มีรายได้ ${revenue}, กำไรสุทธิ ${netIncome}, และเงินสดอิสระ (FCF) ${freeCashFlow}`,
    and: "และ",
    closing:
      "นี่คือข้อมูลวิจัยเพื่อการศึกษา ไม่ใช่คำแนะนำให้ซื้อหรือขาย การตัดสินใจจริงยังต้องดู valuation, ความเสี่ยงที่รับได้, ระยะเวลาลงทุน, และความเหมาะสมกับพอร์ต",
    questionsTitle: "คำถามนักลงทุนพร้อมคำตอบจาก filing",
    readLabels: {
      trend: "การเติบโตและกำไร",
      quality: "คุณภาพกำไร",
      balance: "ความเสี่ยงงบดุล",
      decision: "ข้อสรุปเพื่อการตัดสินใจ",
    },
    signalTooltips: {
      trend: {
        positive:
          "แนวโน้มดีขึ้นในการเทียบปีล่าสุด ลูกศรขึ้นหมายถึง revenue และ/หรือ earnings กำลังเพิ่มขึ้น",
        negative:
          "แนวโน้มอ่อนลงในการเทียบปีล่าสุด ลูกศรลงหมายถึง revenue หรือ earnings ลดลงและควรดูสาเหตุเพิ่มเติม",
        neutral:
          "แนวโน้มผสมหรือใกล้ทรงตัว เส้นแนวนอนหมายถึง growth และ earnings ยังไม่ชี้ชัดขึ้นหรือลง",
        unknown:
          "ยังอ่านแนวโน้มจากข้อมูล SEC ที่เทียบกันได้ไม่ชัด เครื่องหมายคำถามหมายถึงข้อมูล standardized ยังไม่พอ",
      },
      status: {
        positive:
          "สัญญาณจาก filing เป็นบวก เครื่องหมายถูกหมายถึง metric นี้สนับสนุนคุณภาพธุรกิจ",
        negative:
          "สัญญาณความกดดันหรือความเสี่ยง เครื่องหมายเตือนหมายถึง metric นี้ควรตรวจเพิ่ม",
        neutral:
          "สัญญาณผสม โล่หมายถึงต้องดูบริบทก่อนใช้ตัดสินใจ",
        unknown:
          "ข้อมูลไม่ครบหรือเทียบกันไม่ได้ เครื่องหมายคำถามหมายถึง standardized SEC tags ยังไม่พอ",
      },
    },
    noComparable: (label: string) =>
      `${label} ไม่มีตัวเลขปีก่อนที่เทียบกันได้ในข้อมูล filing ที่ปรับมาตรฐาน`,
    flat: (label: string) => `${label} ทรงตัวใกล้เคียงปีก่อน`,
    changed: (label: string, direction: string, value: string) =>
      `${label} ${direction} ${value} เมื่อเทียบกับปีก่อน`,
    increased: "เพิ่มขึ้น",
    declined: "ลดลง",
    labels: {
      revenue: "รายได้",
      netIncome: "กำไรสุทธิ",
    },
    profitabilityUnavailable:
      "ยังไม่มีตัวชี้วัดคุณภาพกำไรครบจาก standardized filing tags จึงควรเปิดดูรายละเอียดใน filing เพิ่มเติม",
    profitabilityStrong: (
      grossMargin: string,
      operatingMargin: string,
      fcfMargin: string,
    ) =>
      `Filing ยังสะท้อนคุณภาพธุรกิจที่แข็งแรง: gross margin ${grossMargin}, operating margin ${operatingMargin}, และ FCF margin ${fcfMargin}. แปลให้ง่ายคือบริษัทเก็บยอดขายเป็นกำไรและเงินสดได้ในสัดส่วนที่มีนัยสำคัญ`,
    profitabilityMixed: (
      grossMargin: string,
      operatingMargin: string,
      fcfMargin: string,
    ) =>
      `คุณภาพกำไรอยู่ในระดับผสมกัน: gross margin ${grossMargin}, operating margin ${operatingMargin}, และ FCF margin ${fcfMargin}. ใช้เป็นข้อมูลเบื้องต้นได้ แต่ต้องดูต่อว่า margin ทรงตัวหรือเริ่มอ่อนลง`,
    profitabilityWeak: (
      grossMargin: string,
      operatingMargin: string,
      fcfMargin: string,
    ) =>
      `คุณภาพกำไรต้องระวัง: gross margin ${grossMargin}, operating margin ${operatingMargin}, และ FCF margin ${fcfMargin}. ถ้า cash conversion อ่อนหรือเป็นลบ กำไรทางบัญชีจะมีประโยชน์ต่อการตัดสินใจน้อยลง`,
    grossMargin: (value: string) => `อัตรากำไรขั้นต้นอยู่ที่ ${value}`,
    operatingMargin: (value: string) => `อัตรากำไรจากการดำเนินงานอยู่ที่ ${value}`,
    marginJoiner: " และ ",
    cashNeedsReview: "ต้องดูต่อว่าบริษัทเปลี่ยนยอดขายเป็นเงินสดได้ดีแค่ไหน",
    cashStrong: (value: string) =>
      `การเปลี่ยนยอดขายเป็นเงินสดอิสระทำได้ดี อยู่ที่ ${value} ของรายได้`,
    cashPositive: (value: string) =>
      `การเปลี่ยนยอดขายเป็นเงินสดอิสระเป็นบวก อยู่ที่ ${value} ของรายได้`,
    cashThin: (value: string) =>
      `เงินสดอิสระยังค่อนข้างบาง อยู่ที่ ${value} ของรายได้`,
    cashNegative: (value: string) =>
      `เงินสดอิสระติดลบ คิดเป็น ${value} ของรายได้`,
    leverageUnavailable:
      "ข้อมูลงบดุลเรื่องหนี้ยังไม่ครบจาก standard SEC tags",
    debtToEquity: (value: string) => `หนี้ต่อส่วนผู้ถือหุ้นอยู่ที่ ${value}`,
    liabilitiesToAssets: (value: string) =>
      `หนี้สินต่อสินทรัพย์อยู่ที่ ${value}`,
    leverageJoiner: " และ ",
    leverageElevated:
      "จุดที่ควรถามต่อคือบริษัทมีงบดุลยืดหยุ่นพอหรือไม่ หากยอดขายหรือความต้องการอ่อนตัว",
    leverageManageable:
      "จากตัวเลข filing ชุดนี้ งบดุลยังไม่ใช่ความกังวลแรกที่เด่นที่สุด",
    takeaways: {
      qualityGrowthBalance:
        "Filing ชี้ไปทางธุรกิจคุณภาพดีแต่มีแรงกดดันด้านการเติบโต สำหรับนักลงทุนรายย่อย ประเด็นสำคัญคือรายได้จะกลับมาทรงตัวได้หรือไม่ ก่อนที่หนี้สินหรือ leverage สูงจะลดความยืดหยุ่น",
      qualityGrowth:
        "Filing ชี้ไปทางธุรกิจคุณภาพดีแต่มีแรงกดดันด้านการเติบโต ธุรกิจยังเปลี่ยนยอดขายเป็นกำไรและเงินสดได้ดี แต่การตัดสินใจขึ้นกับหลักฐานว่ารายได้จะกลับมาทรงตัวได้หรือไม่",
      growthPressure:
        "Filing บอกว่าการเติบโตคือประเด็นหลัก จนกว่ารายได้จะทรงตัว investment case ต้องพึ่ง downside protection, valuation, และความสามารถในการรักษา margin มากขึ้น",
      qualityBalance:
        "Filing แสดงคุณภาพการดำเนินงานที่ดี แต่ความเสี่ยงงบดุลควรมีผลต่อขนาดการลงทุนและผลตอบแทนที่ต้องการ Margin ที่แข็งแรงช่วยได้ แต่ไม่ได้ลบความเสี่ยงจาก leverage",
      qualitySupport:
        "Filing ให้สัญญาณคุณภาพธุรกิจที่สร้างสรรค์ ขั้นต่อไปคือ valuation: คุณภาพนี้ถูกสะท้อนในราคาหุ้นไปมากแค่ไหนแล้ว",
      needsMoreEvidence:
        "Filing ยังไม่ให้สัญญาณที่ชัดพอสำหรับความมั่นใจสูง ควรมองเป็น watchlist candidate จนกว่าหลักฐานด้าน growth, margin, cash flow, และงบดุลจะดีขึ้น",
    },
    questions: {
      revenueDecline: "รายได้ที่ลดลงเป็นสัญญาณเตือนหรือไม่?",
      revenueContinue: "รายได้จะโตต่อได้โดยไม่กดดัน margin หรือไม่?",
      netIncomeLower:
        "กำไรสุทธิที่ลดลงเป็นเรื่องชั่วคราวหรือเป็นปัญหาความสามารถทำกำไร?",
      earningsDurable:
        "กำไรที่ดีขึ้นยั่งยืนแค่ไหน?",
      marginsDefensible:
        "Margin ระดับนี้ป้องกันได้แค่ไหน?",
      operatingLeverage: "อะไรจะช่วยให้ profit margin ดีขึ้น?",
      balanceFlex: "งบดุลมีความยืดหยุ่นเพียงพอหรือไม่?",
      priceReflect: "อะไรจะเปลี่ยนมุมมองการลงทุน?",
    },
    answers: {
      revenueDecline: (value: string) =>
        `ใช่ เป็นประเด็นหลักที่ต้องติดตาม รายได้ลดลง ${value} อาจยังจัดการได้ถ้า margin และ FCF แข็งแรง แต่ความมั่นใจจะเพิ่มขึ้นก็ต่อเมื่อ filing ถัดไปแสดงว่า demand เริ่มทรงตัวหรือกลับมาโต`,
      revenueContinue: (value: string) =>
        `Filing แสดง revenue growth ${value}. คุณภาพของการเติบโตขึ้นกับว่า operating margin และ FCF margin ยังทรงตัวหรือไม่ ไม่ใช่โตด้วยการยอมเสียกำไรมากเกินไป`,
      netIncomeLower: (value: string) =>
        `Filing แสดงกำไรสุทธิลดลง ${value}. ถ้าลดใกล้เคียงกับรายได้ อาจสะท้อน demand ที่อ่อนลง แต่ถ้าลดมากกว่ารายได้ ต้องให้ความสำคัญกับ margin pressure มากขึ้น`,
      earningsDurable: (value: string) =>
        `Filing แสดง net income growth ${value}. จุดที่ต้องดูต่อคือ operating income และ FCF ไปทิศทางเดียวกันหรือไม่ เพราะกำไรที่มีเงินสดรองรับมีประโยชน์ต่อการตัดสินใจมากกว่ากำไรทางบัญชีอย่างเดียว`,
      marginsDefensible: (operatingMargin: string, fcfMargin: string) =>
        `ตอนนี้ยังดูแข็งแรง: operating margin ${operatingMargin} และ FCF margin ${fcfMargin}. ความเสี่ยงคือ competition, pricing pressure, หรือต้นทุนที่สูงขึ้นอาจทำให้ margin ลดลง`,
      operatingLeverage: (operatingMargin: string) =>
        `Operating margin อยู่ที่ ${operatingMargin}. Margin จะดีขึ้นได้จาก pricing ที่ดีขึ้น, ต้นทุนต่ำลง, utilization สูงขึ้น, หรือ revenue mix ที่ไปทางสินค้าหรือบริการกำไรสูง`,
      balanceFlex: (liabilitiesToAssets: string, debtToEquity: string) =>
        `ต้องระวัง หนี้สินอยู่ที่ ${liabilitiesToAssets} ของสินทรัพย์ และ debt/equity อยู่ที่ ${debtToEquity}. FCF ที่แข็งแรงช่วยลดความเสี่ยงบางส่วน แต่ภาระสูงทำให้มี room for error น้อยลงหากกำไรอ่อนตัว`,
      priceReflect:
        "Filing อย่างเดียวตอบ valuation ไม่ได้ กฎใช้งานจริงคือควรต้องการ margin of safety มากขึ้นเมื่อ growth ชะลอ, leverage สูง, หรือ margin ดูเปราะบาง",
    },
  },
  metrics: {
    "revenue-growth": {
      label: "Revenue growth",
      description: "Revenue ปีล่าสุดเทียบกับปีก่อนหน้า",
    },
    "net-income-growth": {
      label: "Net income growth",
      description: "การเติบโตของกำไรสุทธิเทียบกับปีก่อนหน้า",
    },
    "gross-margin": {
      label: "Gross margin",
      description: "Gross profit เป็นสัดส่วนของ revenue",
    },
    "operating-margin": {
      label: "Operating margin",
      description: "Operating income เป็นสัดส่วนของ revenue",
    },
    "net-margin": {
      label: "Net margin",
      description: "Net income เป็นสัดส่วนของ revenue",
    },
    "free-cash-flow-margin": {
      label: "FCF margin",
      description: "Free cash flow เป็นสัดส่วนของ revenue",
    },
    "debt-to-equity": {
      label: "Debt / equity",
      description: "ภาระหนี้เทียบกับ book equity",
    },
    "liabilities-to-assets": {
      label: "Liabilities / assets",
      description: "ภาระผูกพันในงบดุลเทียบกับ total assets",
    },
    "return-on-assets": {
      label: "Return on assets",
      description: "Net income ที่สร้างได้ต่อ assets หนึ่งดอลลาร์",
    },
    "return-on-equity": {
      label: "Return on equity",
      description: "Net income ที่สร้างได้ต่อ book equity หนึ่งดอลลาร์",
    },
  },
  charts: {
    revenueNetIncome: "Revenue และ net income",
    annualFacts: "ข้อมูล SEC XBRL รายปีตาม fiscal year",
    cashBalance: "Cash flow และงบดุล",
    cashBalanceSubtitle: "Free cash flow, assets, และ liabilities",
    revenue: "Revenue",
    netIncome: "Net income",
    liabilities: "Liabilities",
    assets: "Assets",
    tooltips: {
      revenueNetIncome:
        "กราฟแนวโน้มที่ช่วยดูว่า sales และ profits เคลื่อนไปทางเดียวกันหรือไม่ใน annual filings",
      cashBalance:
        "กราฟงบดุลและ cash flow ที่ช่วยเทียบการสร้างเงินสดกับ assets และ liabilities",
    },
  },
  table: {
    title: "สรุปงบการเงินรายปี",
    subtitle: "ตัวเลขถูก normalize จาก standard SEC XBRL tags",
    fy: "FY",
    revenue: "Revenue",
    grossMargin: "Gross margin",
    operatingMargin: "Op margin",
    netIncome: "Net income",
    fcf: "FCF",
    debt: "Debt",
    eps: "EPS",
    tooltip:
      "ตารางการเงินรายปีสำหรับเทียบ normalized SEC facts ข้าม fiscal periods",
  },
  memo: {
    badge: "Memo อ้างอิง filing",
    badgeTooltip:
      "Narrative ของ memo อ้างอิง normalized SEC facts, source links, และ caveats",
    title: "Analyst memo",
    subtitle: "อ้างอิง normalized SEC facts และ source links",
    generate: "สร้าง memo",
    publicTitle: "Public filing memo",
    privateTitle: "บทวิเคราะห์ส่วนตัวของฉัน",
    publicSubtitle:
      "หน้าสาธารณะจะแสดงบทวิเคราะห์ที่ admin เผยแพร่ไว้ ถ้ายังไม่มีจะแสดงสรุปจาก filing แบบ deterministic",
    privateSubtitle:
      "บทวิเคราะห์ด้วย AI จะอยู่ใน Finari workspace ของคุณ และไม่เป็นสาธารณะโดยค่าเริ่มต้น",
    generatePublic: "ดู public memo",
    generatePrivate: "สร้างบทวิเคราะห์ส่วนตัว",
    signInForPrivate: "เข้าสู่ระบบเพื่อสร้างบทวิเคราะห์ AI ส่วนตัว",
    publishPublic: "เผยแพร่ public memo",
    adminPublishHint: "ปุ่มสำหรับ admin เพื่อสร้าง memo สาธารณะประจำ ticker",
    fallbackNotice:
      "แสดง deterministic memo เพราะยังไม่ได้ตั้งค่า AI หรือ AI ใช้งานไม่ได้ชั่วคราว",
    empty: "เลือกบริษัทและสร้าง memo เพื่อดู narrative ของงานวิจัย",
    error: "ไม่สามารถสร้าง research memo ได้ในตอนนี้",
    disclaimer:
      "Finari เป็นซอฟต์แวร์วิจัยเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุนเฉพาะบุคคล คำแนะนำให้ซื้อหรือขาย ราคาเป้าหมาย หรือการวิเคราะห์ความเหมาะสมรายบุคคล",
    aiInstruction:
      "เขียน equity research memo ระดับสถาบันเป็นภาษาไทยแบบมืออาชีพและเข้าใจง่ายสำหรับนักลงทุนรายย่อย ใช้เฉพาะข้อมูล SEC-derived facts และ caveats ที่ให้มาเท่านั้น ห้ามให้คำแนะนำซื้อหรือขาย ห้ามให้ราคาเป้าหมาย และห้ามให้คำแนะนำการลงทุนเฉพาะบุคคล ส่งกลับเป็น strict JSON พร้อม sections: [{title, body, signal}] โดย signal ต้องเป็น positive, neutral, negative, หรือ unknown",
    signal: {
      positive:
        "ภาพจาก filing ล่าสุดดูเป็นบวกในเชิง screening แต่ยังต้องตรวจสอบ valuation และคุณภาพธุรกิจเพิ่มเติม",
      negative:
        "ภาพจาก filing ล่าสุดมีจุดกดดันที่ควรทำ diligence เพิ่มก่อนตัดสินใจลงทุน",
      neutral:
        "ภาพจาก filing ล่าสุดผสมกันหลายด้าน ขั้นต่อไปคือต้องเข้าใจ driver ของธุรกิจที่อยู่เบื้องหลังตัวเลข",
      unknown:
        "ข้อมูล filing ที่ปรับมาตรฐานยังไม่พอสำหรับสร้างมุมมองที่ชัดเจน",
    },
    sections: {
      institutionalRead: "มุมมองแบบสถาบัน",
      trajectory: "แนวโน้มทางการเงิน",
      balanceSheet: "งบดุลและกระแสเงินสด",
      riskQuestions: "คำถามด้านความเสี่ยง",
    },
    fallback: {
      intro: (name: string, ticker: string, signalSentence: string) =>
        `${name} (${ticker}) ถูกวิเคราะห์จากข้อมูลงบการเงินมาตรฐานของ SEC ${signalSentence}`,
      trajectory: (
        revenue: string,
        netIncome: string,
        fiscalYear: number,
        highlights: string,
      ) =>
        `Revenue รายปีล่าสุดอยู่ที่ ${revenue} และ net income อยู่ที่ ${netIncome} สำหรับ fiscal ${fiscalYear}. ${highlights}`,
      trajectoryUnavailable:
        "Finari ยังไม่พบงวดรายปีล่าสุดที่เทียบกันได้จาก standard SEC tags",
      metricsUnavailable:
        "Core metrics หลายรายการไม่มีอยู่ใน standard SEC tags",
      balanceSheet: (
        assets: string,
        liabilities: string,
        cash: string,
        freeCashFlow: string,
      ) =>
        `Reported assets อยู่ที่ ${assets}, liabilities อยู่ที่ ${liabilities}, cash อยู่ที่ ${cash}, และ free cash flow อยู่ที่ ${freeCashFlow}. ควรมอง free cash flow เป็น screening estimate เพราะ XBRL tag conventions อาจต่างกันตามบริษัท`,
      balanceSheetUnavailable:
        "ยังไม่สามารถ screen งบดุลและ cash flow ได้จนกว่าจะ normalize filing period ได้",
      reviewCaveats: (caveats: string) =>
        `ตรวจสอบประเด็นเหล่านี้ก่อนใช้ memo: ${caveats}`,
      defaultQuestions:
        "คำถามต่อไปคือ margin ขับเคลื่อนด้วยอะไร, growth ยั่งยืนแค่ไหน, management ระบุ risk อะไรใน 10-K ล่าสุด, และราคาตลาดปัจจุบันชดเชยความเสี่ยงเหล่านั้นเพียงพอหรือไม่",
    },
  },
  waitlist: {
    workspaceBadge: "Workspace",
    workspaceTooltip:
      "พื้นที่ส่วนตัวสำหรับผู้ใช้ที่เข้าสู่ระบบ เช่น บันทึกงานวิจัยบริษัท",
    saveResearchTitle: "บันทึกงานวิจัยบริษัท",
    signIn: "เข้าสู่ระบบ",
    saveResearch: "บันทึก research",
    signInToSave: "เข้าสู่ระบบด้วยอีเมลเพื่อบันทึกงานวิจัยนี้",
    saved: "บันทึกงานวิจัยใน Finari workspace แล้ว",
    saveFailed: "ยังไม่สามารถบันทึกงานวิจัยนี้ได้ในตอนนี้",
    earlyAccessBadge: "Early access",
    earlyAccessTooltip:
      "Waitlist สำหรับฟีเจอร์ถัดไป เช่น alerts, exports, valuation, และ watchlists",
    earlyAccessTitle: "บันทึก research, alerts, และ exports",
    emailPlaceholder: "you@example.com",
    join: "เข้าร่วม waitlist",
    joined: "คุณอยู่ในรายชื่อ early access ของ Finari แล้ว",
    joinFailed: "ยังบันทึกอีเมลนี้ไม่ได้ กรุณาตรวจสอบแล้วลองอีกครั้ง",
    profiles: [
      "นักลงทุนระยะยาวรายบุคคล",
      "นักลงทุนรายย่อยที่ลงทุนสม่ำเสมอ",
      "นักเรียนหรือนักศึกษาที่กำลังเรียนรู้",
      "นักวิเคราะห์หรือผู้เชี่ยวชาญการเงิน",
    ],
    interests: [
      "Saved research และ alerts",
      "Memo exports",
      "Advanced valuation",
      "Portfolio watchlist",
    ],
    toolsTitle: "เครื่องมือ workspace",
    toolsTooltip:
      "เครื่องมือ workflow ที่วางแผนไว้สำหรับ research workspace ของนักลงทุน",
    tools: [
      "บันทึกงานวิจัยบริษัท",
      "แจ้งเตือน filing และ metrics",
      "Export investment memos",
      "เชื่อมต่อ valuation provider",
    ],
  },
  sources: {
    title: "Source links",
    titleTooltip:
      "ลิงก์ filing และ source ที่ใช้รองรับหน้าวิจัยนี้",
    caveatsTitle: "ข้อควรระวังจากการ normalize ข้อมูล",
    caveatsTooltip:
      "หมายเหตุคุณภาพข้อมูล อธิบาย tag ที่ขาดหาย ไม่สอดคล้อง หรือเทียบกันยาก",
    coreFactsAvailable: "พบ core annual facts ใน standard SEC tags",
  },
  errors: {
    loadCompany: "ไม่สามารถโหลดข้อมูลบริษัทได้",
    loadFacts: "ไม่สามารถโหลดข้อมูล SEC company facts ได้ในตอนนี้",
    generateMemo: "ไม่สามารถสร้าง memo ได้",
  },
  caveats: {
    fewerPeriods:
      "Finari พบงวดรายปีที่เทียบกันได้น้อยกว่าสองงวด ทำให้การวิเคราะห์ trend มีข้อจำกัด",
    noAnnualFacts: "ไม่พบ annual financial-statement facts สำหรับบริษัทนี้",
    noUsGaap:
      "บริษัทไม่ได้แสดง standard US-GAAP facts ใน SEC response",
    latestAnnualMissing: (label: string) =>
      `Latest annual ${label} ไม่มีอยู่ใน standard SEC tags`,
    fields: {
      revenue: "revenue",
      "net income": "net income",
      assets: "assets",
      "operating cash flow": "operating cash flow",
    },
  },
};

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  th,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function translateCaveat(caveat: string, locale: Locale): string {
  const t = getDictionary(locale);

  if (caveat === dictionaries.en.caveats.fewerPeriods) {
    return t.caveats.fewerPeriods;
  }

  if (caveat === dictionaries.en.caveats.noAnnualFacts) {
    return t.caveats.noAnnualFacts;
  }

  if (caveat === dictionaries.en.caveats.noUsGaap) {
    return t.caveats.noUsGaap;
  }

  const missing = caveat.match(
    /^Latest annual (.+) was not available in standard SEC tags\.$/,
  );
  if (missing?.[1]) {
    const label =
      t.caveats.fields[missing[1] as keyof typeof t.caveats.fields] ?? missing[1];
    return t.caveats.latestAnnualMissing(label);
  }

  return caveat;
}
