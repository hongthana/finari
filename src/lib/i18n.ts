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
    github: "GitHub",
    githubRepo: "Open repository on GitHub",
    placeholder: "Search ticker or company, e.g. AAPL",
    research: "Research",
    languageLabel: "Language",
    english: "EN",
    thai: "TH",
    sp500Label: "S&P 500",
    sp500Placeholder: "Select S&P 500 ticker",
    sp500Loading: "Loading S&P 500...",
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
    latestFinancialFiling: "Latest financial filing",
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
  decision: {
    badge: "Decision screen",
    badgeTooltip:
      "A filing-only investor screen that highlights the core evidence, main risk, and metric to watch next.",
    heading: "Decision screen from the latest financial filing",
    subtitle:
      "Use this as a practical screen before valuation: it does not decide for you, but it tells you what the filing most clearly supports and what still needs proof.",
    finalTakeaway: "Final takeaway",
    strongestEvidence: "Strongest evidence",
    mainRisk: "Main risk",
    watchNext: "Metric to watch next",
    latestFinancialFiling: "Latest financial filing",
    dataConfidence: "Data confidence",
    notAvailable: "n/a",
    takeaways: {
      constructive:
        "Constructive filing profile: the latest standardized SEC facts support business quality, but the final investment decision still depends on valuation and risk fit.",
      mixed:
        "Mixed filing profile: the business has useful strengths, but the evidence is not one-sided enough to rely on without further review.",
      caution:
        "Caution filing profile: at least one decision-critical area is under pressure, so require stronger proof before relying on the investment case.",
      limited:
        "Limited filing profile: standardized data is too incomplete for a high-confidence screen, so open the filing before making decisions.",
    },
    evidence: {
      "cash-generation": "cash generation",
      "data-quality": "data quality",
      "financial-scale": "financial scale",
      "profit-quality": "profit quality",
    },
    risks: {
      "balance-sheet": "balance-sheet flexibility",
      "data-quality": "data quality",
      growth: "growth pressure",
      "margin-durability": "margin durability",
      "valuation-needed": "valuation still needed",
    },
    tooltips: {
      takeaway:
        "Overall filing read from growth, profitability, cash flow, balance-sheet, and data-quality signals.",
      evidence:
        "The strongest standardized SEC evidence supporting the current filing read.",
      risk: "The main risk area the next investor review should focus on.",
      watch:
        "The next metric that can confirm or weaken the filing-based read.",
      filing:
        "The latest 10-K or 10-Q family filing used as the primary financial-filing anchor.",
      confidence:
        "How complete and comparable the standardized SEC facts are for this screen.",
    },
  },
  analysis: {
    quarterlyTitle: "Quarterly and TTM trend",
    quarterlySubtitle:
      "Latest quarters and trailing twelve months from standardized SEC facts where comparable data is available.",
    quarter: "Quarter",
    ttm: "TTM",
    revenue: "Revenue",
    netIncome: "Net income",
    fcf: "FCF",
    opMargin: "Op margin",
    noTtm: "TTM is unavailable until four comparable quarters are available.",
    changeTitle: "What changed since the last filing",
    changeSubtitle:
      "Quarter-over-quarter and year-over-year comparisons from normalized SEC facts.",
    latestQuarter: "Latest quarter",
    latestAnnual: "Latest annual",
    current: "Current",
    previous: "Previous",
    change: "Change",
    noComparable: "No clean comparison available.",
    caveatChangesTitle: "Caveat changes",
    caveatBaseline:
      "This is the first stored snapshot, so Finari will track caveat changes from the next refresh.",
    caveatUnchanged:
      "No normalization caveats changed versus the previous stored snapshot.",
    newCaveats: "New caveats",
    resolvedCaveats: "Resolved caveats",
    unchangedCaveats: "Still applies",
    changeLabels: {
      "quarterly-revenue": "Quarterly revenue",
      "quarterly-net-income": "Quarterly net income",
      "quarterly-fcf": "Quarterly FCF",
      "quarterly-operating-margin": "Quarterly operating margin",
      "quarterly-debt": "Quarterly debt",
      "quarterly-cash": "Quarterly cash",
      "quarterly-liabilities-to-assets": "Quarterly liabilities/assets",
      "quarterly-working-capital": "Quarterly working capital",
      "annual-revenue": "Annual revenue",
      "annual-net-income": "Annual net income",
      "annual-fcf": "Annual FCF",
      "annual-operating-margin": "Annual operating margin",
      "annual-debt": "Annual debt",
      "annual-cash": "Annual cash",
      "annual-liabilities-to-assets": "Annual liabilities/assets",
      "annual-working-capital": "Annual working capital",
    },
    changeDescriptions: {
      "quarterly-revenue": "Latest quarter revenue compared with the prior quarter.",
      "quarterly-net-income":
        "Latest quarter net income compared with the prior quarter.",
      "quarterly-fcf": "Latest quarter free cash flow compared with the prior quarter.",
      "quarterly-operating-margin":
        "Latest quarter operating margin compared with the prior quarter.",
      "quarterly-debt":
        "Latest quarter debt compared with the prior quarter. Lower debt is usually more flexible.",
      "quarterly-cash":
        "Latest quarter cash compared with the prior quarter. More cash can increase flexibility.",
      "quarterly-liabilities-to-assets":
        "Latest quarter liabilities/assets compared with the prior quarter. Lower is usually better.",
      "quarterly-working-capital":
        "Latest quarter working capital compared with the prior quarter.",
      "annual-revenue": "Latest annual revenue compared with the prior fiscal year.",
      "annual-net-income":
        "Latest annual net income compared with the prior fiscal year.",
      "annual-fcf": "Latest annual free cash flow compared with the prior fiscal year.",
      "annual-operating-margin":
        "Latest annual operating margin compared with the prior fiscal year.",
      "annual-debt":
        "Latest annual debt compared with the prior fiscal year. Lower debt is usually more flexible.",
      "annual-cash":
        "Latest annual cash compared with the prior fiscal year. More cash can increase flexibility.",
      "annual-liabilities-to-assets":
        "Latest annual liabilities/assets compared with the prior fiscal year. Lower is usually better.",
      "annual-working-capital":
        "Latest annual working capital compared with the prior fiscal year.",
    },
    driversTitle: "Business-driver read",
    driversSubtitle:
      "Deterministic reads from tagged facts: growth, profitability, cash generation, capital allocation, liquidity, and leverage.",
    driverLabels: {
      growth: "Growth",
      profitability: "Profitability",
      "cash-generation": "Cash generation",
      "capital-allocation": "Capital allocation",
      liquidity: "Liquidity",
      leverage: "Leverage",
    },
    driverDescriptions: {
      growth:
        "Revenue momentum. Positive is easier when sales are expanding without weakening margins.",
      profitability:
        "Operating profitability. Higher operating margin gives the business more room to absorb pressure.",
      "cash-generation":
        "Free-cash-flow conversion. Cash-backed profit is more decision-useful than accounting profit alone.",
      "capital-allocation":
        "Buybacks and dividends relative to cash generation. High payout can reduce flexibility.",
      liquidity:
        "Near-term balance-sheet flexibility. Current assets should comfortably cover current liabilities.",
      leverage:
        "Balance-sheet obligations relative to assets. Higher liabilities reduce room for error.",
    },
    driverDetailLabels: {
      "product-demand": "Product demand proxy",
      "recent-quarter-demand": "Recent-quarter demand",
      "pricing-power": "Pricing-power proxy",
      "margin-pressure": "Margin pressure",
      "cash-conversion": "Cash conversion",
      "capital-return": "Capital return",
      "working-capital-flexibility": "Working-capital flexibility",
      "balance-sheet-flexibility": "Balance-sheet flexibility",
      "services-hardware-mix": "Services vs hardware mix",
      "geographic-exposure": "Geographic exposure",
    },
    driverDetailDescriptions: {
      "product-demand":
        "Annual revenue growth is the cleanest standardized SEC proxy for demand.",
      "recent-quarter-demand":
        "Latest quarter revenue change shows whether recent demand improved or weakened.",
      "pricing-power":
        "Gross-margin movement is the SEC-tagged proxy for pricing power, product mix, or cost pressure.",
      "margin-pressure":
        "Operating-margin movement shows whether revenue is converting into operating profit better or worse.",
      "cash-conversion":
        "Free cash flow divided by net income shows how much reported profit becomes cash.",
      "capital-return":
        "Buybacks plus dividends show how much cash is being returned to shareholders.",
      "working-capital-flexibility":
        "Working capital shows whether short-term assets exceed short-term obligations.",
      "balance-sheet-flexibility":
        "Cash divided by debt shows how much debt is covered by cash on hand.",
      "services-hardware-mix":
        "Standardized SEC facts do not provide a comparable services/hardware mix for every company; verify the segment table in the filing.",
      "geographic-exposure":
        "Standardized SEC facts do not provide a comparable geography mix for every company; verify the geographic revenue table in the filing.",
    },
    primaryValue: "Primary value",
    secondaryValue: "Secondary value",
    balanceTitle: "Balance-sheet strength",
    balanceSubtitle:
      "Latest available balance-sheet metrics from quarterly data when available, otherwise annual data.",
    cash: "Cash",
    debt: "Debt",
    netCash: "Net cash",
    workingCapital: "Working capital",
    cashToDebt: "Cash / debt",
    liabilitiesToAssets: "Liabilities / assets",
    debtToEquity: "Debt / equity",
    peersTitle: "SEC-industry peer comparison",
    peersSubtitle:
      "Same-SIC peer medians from bounded SEC-only Finari coverage. Treat limited peer coverage as directional.",
    peerCount: (count: number) => `${count} same-SIC peers`,
    metric: "Metric",
    company: "Company",
    peerMedian: "Peer median",
    limitedPeerCoverage:
      "Peer coverage is limited. Use this as a directional comparison, not a complete industry ranking.",
    noPeerMetrics: "No same-SIC peer metrics are available yet.",
    dataQualityTitle: "Data-quality checks",
    dataQualitySubtitle:
      "Confidence score based on available financial filings, annual comparability, quarterly coverage, and US-GAAP facts.",
    score: "Score",
    confidence: "Confidence",
    confidenceLabels: {
      High: "High",
      Medium: "Medium",
      Low: "Low",
    },
    checkLabels: {
      "financial-filing": "Latest financial filing found",
      "annual-comparability": "Annual comparability",
      "core-annual-tags": "Core annual tags",
      "quarterly-coverage": "Quarterly coverage",
      "us-gaap": "US-GAAP facts",
    },
    checkDescriptions: {
      "financial-filing":
        "A 10-K/10-Q family filing is available as the analysis anchor.",
      "annual-comparability":
        "At least two annual periods are available for trend comparison.",
      "core-annual-tags":
        "Revenue, net income, assets, and operating cash flow were available.",
      "quarterly-coverage":
        "At least four comparable quarters are available for TTM analysis.",
      "us-gaap": "The SEC response includes standardized US-GAAP facts.",
    },
    tooltips: {
      quarterly:
        "Quarterly facts are used only when standardized SEC tags support comparable quarter values.",
      change:
        "Change detection compares the latest available period with the prior comparable period.",
      drivers:
        "Business-driver reads translate normalized metrics into decision-relevant themes.",
      balance:
        "Balance-sheet strength focuses on liquidity, debt, and liabilities from the latest available filing period.",
      peers:
        "Peer comparison uses same-SIC companies from a bounded SEC-only seed universe.",
      dataQuality:
        "Data confidence explains whether missing or incomplete SEC tags should limit reliance on the screen.",
    },
  },
  events: {
    title: "Latest events and potential financial impact",
    subtitle:
      "Recent company, industry, macro, legal/regulatory, and filing-related events translated into the financial drivers investors should watch.",
    badge: "Event impact",
    badgeTooltip:
      "Event impact is a conservative, source-linked screen. It does not predict stock price.",
    loading: "Loading latest events...",
    unavailable: "Latest events are unavailable right now.",
    empty:
      "No recent source-linked events were available. Use the filing analysis below as the primary research base.",
    whatHappened: "What happened",
    eventType: "Event type",
    potentialDrivers: "Potential financial drivers",
    likelyImpact: "Likely impact",
    horizon: "Time frame",
    watchNext: "Watch in the next filing",
    confidence: "Confidence",
    impactSummaryLabel: "Financial impact read",
    investorMeaningLabel: "Investor meaning",
    analysis: "Analysis",
    publicAnalysis: "Public analysis",
    privateAnalysis: "Private analysis",
    deterministicAnalysis: "Rule-based read",
    aiAnalysis: "AI-enhanced read",
    generatePrivate: "Generate private event analysis",
    signInForPrivate: "Sign in for private event analysis",
    publishPublic: "Publish public event analysis",
    adminPublishHint:
      "Admin control for the canonical public event-impact read.",
    featured: "Featured",
    hidden: "Hidden",
    feature: "Feature",
    unfeature: "Unfeature",
    hide: "Hide",
    unhide: "Unhide",
    curationFailed: "Unable to update event curation right now.",
    analysisFailed: "Unable to generate event analysis right now.",
    source: "Source",
    generated: "Generated",
    sourceNote:
      "Headlines are interpreted with deterministic rules and should be verified with the source and next filing. This is not a buy/sell recommendation.",
    typeLabels: {
      "company-specific": "Company-specific",
      industry: "Industry",
      macro: "Macro",
      "legal-regulatory": "Legal/regulatory",
      "filing-related": "Filing-related",
    },
    driverLabels: {
      revenue: "Revenue",
      margin: "Margin",
      "cash-flow": "Cash flow",
      debt: "Debt",
      capex: "Capex",
      "valuation-risk": "Valuation risk",
    },
    impactLabels: {
      positive: "Positive",
      neutral: "Mixed",
      negative: "Negative",
      unknown: "Uncertain",
    },
    horizonLabels: {
      "short-term": "Short-term sentiment",
      "long-term": "Long-term fundamentals",
      both: "Sentiment and fundamentals",
      uncertain: "Uncertain",
    },
    confidenceLabels: {
      High: "High",
      Medium: "Medium",
      Low: "Low",
    },
    watchMetrics: {
      "revenue-growth": "Revenue growth",
      "gross-margin": "Gross margin",
      "free-cash-flow": "Free cash flow",
      "debt-and-liabilities": "Debt and liabilities/assets",
      capex: "Capex and cash flow",
      "risk-disclosure": "Risk disclosures and management commentary",
    },
    impactSummary: (
      impact: string,
      drivers: string,
      watchMetric: string,
      confidence: string,
    ) =>
      `Possible financial impact: ${impact.toLowerCase()} signal for ${drivers}. Watch ${watchMetric} in the next filing. Confidence: ${confidence.toLowerCase()}.`,
    whatHappenedSummary: (
      eventType: string,
      drivers: string,
      impact: string,
      watchMetric: string,
    ) =>
      `This ${eventType.toLowerCase()} event may matter because it is a ${impact.toLowerCase()} signal for ${drivers}. Watch ${watchMetric} in the next filing to confirm whether it affects the business.`,
    investorMeaning: (impact: string, drivers: string, horizon: string) =>
      `Investor meaning: treat this as a ${impact.toLowerCase()} signal for ${drivers}. It may affect ${horizon.toLowerCase()}, so confirm the effect in future filings before relying on it.`,
    aiInstruction:
      "Analyze only the supplied source headline, feed snippet, filing metadata, and deterministic baseline. Do not fetch or invent article details. Explain the possible financial impact in English for retail investors. Avoid buy/sell recommendations, price targets, predictions, or personalized advice. Return strict JSON with one result per event.",
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
      "Write a concise institutional-grade equity research memo in English for retail investors. Use only the supplied SEC-derived facts, quarterly/TTM fields, peer comparison, data-quality checks, decision framework, source-linked event impacts, citations, and caveats. Treat events as headline/snippet-level signals, not confirmed financial outcomes. Do not include buy/sell recommendations, price targets, stock-price predictions, or personalized investment advice. Return strict JSON with sections: [{title, body, signal}] where signal is positive, neutral, negative, or unknown.",
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
      decisionScreen: "Decision screen",
      quarterlyTtm: "Quarterly and TTM read",
      peerAndConfidence: "Peer and data confidence",
      eventImpact: "Event impact watchlist",
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
      decision: (takeaway: string, evidence: string, risk: string, watchMetric: string) =>
        `Decision screen: ${takeaway} Strongest evidence is ${evidence}; main risk is ${risk}; the next metric to watch is ${watchMetric}.`,
      quarterly: (periodLabel: string, revenue: string, netIncome: string, fcf: string) =>
        `Latest TTM or quarterly read: ${periodLabel} revenue was ${revenue}, net income was ${netIncome}, and FCF was ${fcf}.`,
      quarterlyUnavailable:
        "Quarterly and TTM analysis is limited because comparable quarterly facts were not available.",
      peerDataQuality: (peerCount: number, confidence: string) =>
        `Peer comparison uses ${peerCount} same-SIC SEC peers from bounded Finari coverage. Data confidence is ${confidence}, so missing tags or limited peers should affect how much weight the screen receives.`,
      eventImpact: (events: string) =>
        `Latest source-linked events to watch: ${events} Treat these as possible driver checks, not stock-price predictions.`,
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
    signInToUse: "Sign in with email to use workspace tools.",
    tools: [
      "Saved company research",
      "Filing and metric alerts",
      "Exportable investment memos",
      "Valuation provider integration",
    ],
    savedResearchListTitle: "Saved workspace",
    loadSavedResearchFailed: "Unable to load saved workspace items.",
    savedResearchEmpty: "No saved research yet.",
    addToWorkspace: "Add to workspace",
    addToWorkspaceSuccess: "Research saved to your workspace.",
    addToWorkspaceError: "Unable to save research right now.",
    savedWorkspaceTitle: "Saved company research",
    savedWorkspaceSubtitle: "Your latest saved research entries.",
    viewSavedWorkspace: "Open saved workspace",
    workspaceViewDisabled: "Sign in to view saved workspace items.",
    watchlistTitle: "Watchlists",
    watchlistAddTitle: "Add ticker to watchlist",
    watchlistListTitle: "Watchlist items",
    watchlistLoadFailed: "Unable to load watchlist right now.",
    watchlistAddFailed: "Unable to add this company to watchlist.",
    watchlistAdded: "Company saved to watchlist.",
    watchlistDuplicate: "This company is already in your watchlist.",
    watchlistEmpty: "No companies in this watchlist yet.",
    alertTitle: "Filing and metric alerts",
    alertSubtitle:
      "Create and update notification rules. Triggered alerts now queue in the in-app inbox and email when available.",
    alertTypeLabel: "Alert type",
    alertConditionLabel: "Condition",
    alertThresholdLabel: "Threshold",
    alertNotesLabel: "Notes",
    alertCreate: "Save alert",
    alertEnable: "Enable alert",
    alertDisable: "Disable alert",
    alertSaved: "Alert saved. Matching deliveries now queue in-app and email when available.",
    alertUpdated: "Alert updated. Matching deliveries now queue in-app and email when available.",
    alertLoadFailed: "Unable to load alerts.",
    alertToggleDisabled: "Sign in to create alerts.",
    valuationTitle: "Valuation",
    valuationLoading: "Loading valuation metrics...",
    valuationNotConfigured: "Configure FMP_API_KEY to unlock valuation metrics.",
    valuationUnavailable: "Valuation metrics are temporarily unavailable.",
    valuationAsOf: "As of",
    valuationDisclaimer:
      "Valuation data is optional and provided for research context only.",
    valuationSourceLabel: "Source",
    valuationMetricsTitle: "All valuation metrics",
    valuationMetricsSubtitle:
      "Combined from FMP key metrics, ratios, and quote data.",
    exportTitle: "Memo export",
    exportSubtitle:
      "Export your memo and snapshot summary when memo data is available.",
    exportMemoUnavailable: "Generate a memo first to enable export.",
    exportJson: "Download JSON",
    exportCsv: "Download CSV",
    exportFailed: "Unable to export workspace payload.",
    exportSaved: "Export started.",
    exportSignedOut: "Sign in to export private memo packages.",
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
    fewerQuarters:
      "Finari found fewer than four comparable quarterly periods, so TTM analysis is limited.",
    peerLimited:
      "SEC industry peer coverage is limited, so peer comparison should be treated as directional.",
    peerFewerThanThree:
      "Fewer than three same-SIC peer snapshots are available from SEC data.",
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
    github: "GitHub",
    githubRepo: "เปิด repository บน GitHub",
    placeholder: "ค้นหา ticker หรือชื่อบริษัท เช่น AAPL",
    research: "วิเคราะห์",
    languageLabel: "ภาษา",
    english: "EN",
    thai: "TH",
    sp500Label: "S&P 500",
    sp500Placeholder: "เลือก ticker ใน S&P 500",
    sp500Loading: "กำลังโหลด S&P 500...",
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
    latestFinancialFiling: "Financial filing ล่าสุด",
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
  decision: {
    badge: "หน้าช่วยตัดสินใจ",
    badgeTooltip:
      "ตัวกรองสำหรับนักลงทุนจาก filing เท่านั้น ช่วยชี้หลักฐานสำคัญ ความเสี่ยงหลัก และ metric ที่ควรติดตามต่อ",
    heading: "หน้าช่วยตัดสินใจจาก financial filing ล่าสุด",
    subtitle:
      "ใช้ส่วนนี้ก่อนดู valuation: ระบบไม่ได้ตัดสินใจแทนคุณ แต่บอกว่า filing สนับสนุนมุมมองใดชัดที่สุด และจุดไหนยังต้องมีหลักฐานเพิ่ม",
    finalTakeaway: "ข้อสรุปหลัก",
    strongestEvidence: "หลักฐานที่แข็งแรงที่สุด",
    mainRisk: "ความเสี่ยงหลัก",
    watchNext: "Metric ที่ควรดูต่อ",
    latestFinancialFiling: "Financial filing ล่าสุด",
    dataConfidence: "ความมั่นใจของข้อมูล",
    notAvailable: "n/a",
    takeaways: {
      constructive:
        "ภาพจาก filing ค่อนข้างสร้างสรรค์: standardized SEC facts ล่าสุดสนับสนุนคุณภาพธุรกิจ แต่การตัดสินใจจริงยังต้องดู valuation และความเสี่ยงที่เหมาะกับคุณ",
      mixed:
        "ภาพจาก filing ยังผสมกัน: ธุรกิจมีจุดแข็งที่ใช้ได้ แต่หลักฐานยังไม่ชัดด้านเดียวพอที่จะใช้โดยไม่ตรวจเพิ่ม",
      caution:
        "ภาพจาก filing ต้องระวัง: มีอย่างน้อยหนึ่งประเด็นสำคัญที่กดดัน จึงควรต้องการหลักฐานเพิ่มก่อนเชื่อ investment case",
      limited:
        "ข้อมูลจาก filing ยังจำกัด: standardized data ยังไม่พอสำหรับ screen ที่มั่นใจสูง ควรเปิด filing อ่านเพิ่มก่อนตัดสินใจ",
    },
    evidence: {
      "cash-generation": "การสร้างเงินสด",
      "data-quality": "คุณภาพข้อมูล",
      "financial-scale": "ขนาดธุรกิจ",
      "profit-quality": "คุณภาพกำไร",
    },
    risks: {
      "balance-sheet": "ความยืดหยุ่นของงบดุล",
      "data-quality": "คุณภาพข้อมูล",
      growth: "แรงกดดันด้านการเติบโต",
      "margin-durability": "ความยั่งยืนของ margin",
      "valuation-needed": "ยังต้องดู valuation",
    },
    tooltips: {
      takeaway:
        "ภาพรวมจาก filing โดยดู growth, profitability, cash flow, งบดุล, และคุณภาพข้อมูลร่วมกัน",
      evidence:
        "หลักฐานจาก standardized SEC data ที่สนับสนุนมุมมองปัจจุบันมากที่สุด",
      risk: "จุดเสี่ยงหลักที่ควรตรวจต่อในการตัดสินใจลงทุน",
      watch:
        "Metric ถัดไปที่จะช่วยยืนยันหรือทำให้มุมมองจาก filing อ่อนลง",
      filing:
        "10-K หรือ 10-Q family filing ล่าสุดที่ใช้เป็นหลักของการวิเคราะห์งบการเงิน",
      confidence:
        "ความครบถ้วนและการเทียบกันได้ของ standardized SEC facts สำหรับหน้าจอนี้",
    },
  },
  analysis: {
    quarterlyTitle: "แนวโน้มรายไตรมาสและ TTM",
    quarterlySubtitle:
      "ไตรมาสล่าสุดและ trailing twelve months จาก standardized SEC facts เมื่อข้อมูลเทียบกันได้",
    quarter: "ไตรมาส",
    ttm: "TTM",
    revenue: "Revenue",
    netIncome: "Net income",
    fcf: "FCF",
    opMargin: "Op margin",
    noTtm: "ยังคำนวณ TTM ไม่ได้จนกว่าจะมีไตรมาสที่เทียบกันได้ครบสี่ไตรมาส",
    changeTitle: "อะไรเปลี่ยนไปจาก filing ก่อนหน้า",
    changeSubtitle:
      "เปรียบเทียบไตรมาสล่าสุดกับไตรมาสก่อน และปีล่าสุดกับปีก่อน จาก normalized SEC facts",
    latestQuarter: "ไตรมาสล่าสุด",
    latestAnnual: "ปีล่าสุด",
    current: "ปัจจุบัน",
    previous: "ก่อนหน้า",
    change: "เปลี่ยนแปลง",
    noComparable: "ยังไม่มีข้อมูลเปรียบเทียบที่สะอาดพอ",
    caveatChangesTitle: "การเปลี่ยนแปลงของข้อควรระวัง",
    caveatBaseline:
      "นี่คือ snapshot แรกที่จัดเก็บไว้ Finari จะเริ่มติดตามการเปลี่ยนแปลงของ caveat ในการรีเฟรชครั้งถัดไป",
    caveatUnchanged:
      "ไม่มี caveat จากการ normalize ข้อมูลที่เปลี่ยนไปเมื่อเทียบกับ snapshot ก่อนหน้า",
    newCaveats: "caveat ใหม่",
    resolvedCaveats: "caveat ที่หายไป",
    unchangedCaveats: "ยังต้องใช้ caveat นี้",
    changeLabels: {
      "quarterly-revenue": "Revenue รายไตรมาส",
      "quarterly-net-income": "Net income รายไตรมาส",
      "quarterly-fcf": "FCF รายไตรมาส",
      "quarterly-operating-margin": "Operating margin รายไตรมาส",
      "quarterly-debt": "Debt รายไตรมาส",
      "quarterly-cash": "Cash รายไตรมาส",
      "quarterly-liabilities-to-assets": "Liabilities/assets รายไตรมาส",
      "quarterly-working-capital": "Working capital รายไตรมาส",
      "annual-revenue": "Revenue รายปี",
      "annual-net-income": "Net income รายปี",
      "annual-fcf": "FCF รายปี",
      "annual-operating-margin": "Operating margin รายปี",
      "annual-debt": "Debt รายปี",
      "annual-cash": "Cash รายปี",
      "annual-liabilities-to-assets": "Liabilities/assets รายปี",
      "annual-working-capital": "Working capital รายปี",
    },
    changeDescriptions: {
      "quarterly-revenue": "Revenue ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า",
      "quarterly-net-income":
        "Net income ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า",
      "quarterly-fcf": "Free cash flow ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า",
      "quarterly-operating-margin":
        "Operating margin ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า",
      "quarterly-debt":
        "Debt ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า โดยทั่วไป debt ที่ลดลงช่วยเพิ่มความยืดหยุ่น",
      "quarterly-cash":
        "Cash ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า Cash ที่เพิ่มขึ้นช่วยเพิ่มความยืดหยุ่น",
      "quarterly-liabilities-to-assets":
        "Liabilities/assets ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า โดยทั่วไปยิ่งต่ำยิ่งดี",
      "quarterly-working-capital":
        "Working capital ไตรมาสล่าสุดเทียบกับไตรมาสก่อนหน้า",
      "annual-revenue": "Revenue ปีล่าสุดเทียบกับปีก่อนหน้า",
      "annual-net-income": "Net income ปีล่าสุดเทียบกับปีก่อนหน้า",
      "annual-fcf": "Free cash flow ปีล่าสุดเทียบกับปีก่อนหน้า",
      "annual-operating-margin": "Operating margin ปีล่าสุดเทียบกับปีก่อนหน้า",
      "annual-debt":
        "Debt ปีล่าสุดเทียบกับปีก่อนหน้า โดยทั่วไป debt ที่ลดลงช่วยเพิ่มความยืดหยุ่น",
      "annual-cash":
        "Cash ปีล่าสุดเทียบกับปีก่อนหน้า Cash ที่เพิ่มขึ้นช่วยเพิ่มความยืดหยุ่น",
      "annual-liabilities-to-assets":
        "Liabilities/assets ปีล่าสุดเทียบกับปีก่อนหน้า โดยทั่วไปยิ่งต่ำยิ่งดี",
      "annual-working-capital": "Working capital ปีล่าสุดเทียบกับปีก่อนหน้า",
    },
    driversTitle: "ตัวขับเคลื่อนธุรกิจ",
    driversSubtitle:
      "อ่านจาก tagged facts แบบ deterministic: growth, profitability, cash generation, capital allocation, liquidity, และ leverage",
    driverLabels: {
      growth: "Growth",
      profitability: "Profitability",
      "cash-generation": "Cash generation",
      "capital-allocation": "Capital allocation",
      liquidity: "Liquidity",
      leverage: "Leverage",
    },
    driverDescriptions: {
      growth:
        "แรงส่งของ revenue จะดูดีขึ้นเมื่อยอดขายโตโดยไม่กดดัน margin",
      profitability:
        "ความสามารถทำกำไรจากการดำเนินงาน Operating margin ที่สูงช่วยให้ธุรกิจรับแรงกดดันได้มากขึ้น",
      "cash-generation":
        "การเปลี่ยนกำไรเป็น free cash flow กำไรที่มีเงินสดรองรับมีประโยชน์ต่อการตัดสินใจมากกว่าแค่กำไรทางบัญชี",
      "capital-allocation":
        "Buybacks และ dividends เทียบกับเงินสดที่ธุรกิจสร้างได้ หากจ่ายสูงเกินไปอาจลดความยืดหยุ่น",
      liquidity:
        "ความยืดหยุ่นระยะสั้นของงบดุล Current assets ควรมากพอเมื่อเทียบกับ current liabilities",
      leverage:
        "ภาระผูกพันในงบดุลเทียบกับสินทรัพย์ หนี้สินสูงทำให้มี room for error น้อยลง",
    },
    driverDetailLabels: {
      "product-demand": "ตัวแทน product demand",
      "recent-quarter-demand": "Demand ไตรมาสล่าสุด",
      "pricing-power": "ตัวแทน pricing power",
      "margin-pressure": "แรงกดดันต่อ margin",
      "cash-conversion": "Cash conversion",
      "capital-return": "Capital return",
      "working-capital-flexibility": "ความยืดหยุ่นจาก working capital",
      "balance-sheet-flexibility": "ความยืดหยุ่นของงบดุล",
      "services-hardware-mix": "Services vs hardware mix",
      "geographic-exposure": "Geographic exposure",
    },
    driverDetailDescriptions: {
      "product-demand":
        "Revenue growth รายปีคือ proxy จาก standardized SEC facts ที่สะอาดที่สุดสำหรับ demand",
      "recent-quarter-demand":
        "การเปลี่ยนแปลงของ revenue ไตรมาสล่าสุดช่วยดูว่า demand ล่าสุดดีขึ้นหรืออ่อนลง",
      "pricing-power":
        "การเปลี่ยนแปลงของ gross margin เป็น proxy จาก SEC tags สำหรับ pricing power, product mix, หรือ cost pressure",
      "margin-pressure":
        "การเปลี่ยนแปลงของ operating margin บอกว่า revenue เปลี่ยนเป็น operating profit ได้ดีขึ้นหรือแย่ลง",
      "cash-conversion":
        "Free cash flow หารด้วย net income บอกว่ากำไรทางบัญชีเปลี่ยนเป็นเงินสดได้แค่ไหน",
      "capital-return":
        "Buybacks รวม dividends แสดงเงินสดที่คืนให้ผู้ถือหุ้น",
      "working-capital-flexibility":
        "Working capital บอกว่า short-term assets มากกว่าภาระระยะสั้นหรือไม่",
      "balance-sheet-flexibility":
        "Cash หาร debt บอกว่า cash ในมือครอบคลุม debt ได้แค่ไหน",
      "services-hardware-mix":
        "Standardized SEC facts ยังไม่ให้ services/hardware mix ที่เทียบได้ครบทุกบริษัท ควรตรวจ segment table ใน filing",
      "geographic-exposure":
        "Standardized SEC facts ยังไม่ให้ geography mix ที่เทียบได้ครบทุกบริษัท ควรตรวจ geographic revenue table ใน filing",
    },
    primaryValue: "ค่าหลัก",
    secondaryValue: "ค่าเสริม",
    balanceTitle: "ความแข็งแรงของงบดุล",
    balanceSubtitle:
      "ใช้ตัวเลขงบดุลล่าสุดจากไตรมาส ถ้ามีข้อมูลรายไตรมาส มิฉะนั้นใช้ตัวเลขรายปี",
    cash: "Cash",
    debt: "Debt",
    netCash: "Net cash",
    workingCapital: "Working capital",
    cashToDebt: "Cash / debt",
    liabilitiesToAssets: "Liabilities / assets",
    debtToEquity: "Debt / equity",
    peersTitle: "เทียบกับ peer ในอุตสาหกรรม SEC",
    peersSubtitle:
      "เทียบ median ของบริษัท same-SIC จาก Finari coverage ที่จำกัดและใช้ข้อมูล SEC เท่านั้น หาก peer coverage น้อยให้ใช้เป็นสัญญาณประกอบ",
    peerCount: (count: number) => `${count} peer same-SIC`,
    metric: "Metric",
    company: "บริษัท",
    peerMedian: "Peer median",
    limitedPeerCoverage:
      "Peer coverage ยังจำกัด ใช้เป็นการเทียบเชิงทิศทาง ไม่ใช่ industry ranking ที่ครบถ้วน",
    noPeerMetrics: "ยังไม่มี metric ของ peer same-SIC ที่ใช้ได้",
    dataQualityTitle: "ตรวจคุณภาพข้อมูล",
    dataQualitySubtitle:
      "คะแนนความมั่นใจจาก financial filing, การเทียบรายปี, quarterly coverage, และ US-GAAP facts ที่มีอยู่",
    score: "คะแนน",
    confidence: "ความมั่นใจ",
    confidenceLabels: {
      High: "สูง",
      Medium: "ปานกลาง",
      Low: "ต่ำ",
    },
    checkLabels: {
      "financial-filing": "พบ financial filing ล่าสุด",
      "annual-comparability": "เทียบรายปีได้",
      "core-annual-tags": "Core annual tags",
      "quarterly-coverage": "Quarterly coverage",
      "us-gaap": "US-GAAP facts",
    },
    checkDescriptions: {
      "financial-filing":
        "มี 10-K/10-Q family filing เป็นจุดยึดของการวิเคราะห์",
      "annual-comparability":
        "มีงวดรายปีอย่างน้อยสองปีสำหรับเทียบ trend",
      "core-annual-tags":
        "มี revenue, net income, assets, และ operating cash flow",
      "quarterly-coverage":
        "มีไตรมาสที่เทียบกันได้อย่างน้อยสี่ไตรมาสสำหรับ TTM",
      "us-gaap": "SEC response มี standardized US-GAAP facts",
    },
    tooltips: {
      quarterly:
        "ใช้ quarterly facts เฉพาะเมื่อ standardized SEC tags รองรับตัวเลขไตรมาสที่เทียบกันได้",
      change:
        "Change detection เทียบงวดล่าสุดกับงวดก่อนหน้าที่เทียบกันได้",
      drivers:
        "Business-driver read แปล normalized metrics ให้เป็นหัวข้อที่ใช้ตัดสินใจได้",
      balance:
        "ความแข็งแรงของงบดุลดู liquidity, debt, และ liabilities จากงวดล่าสุดที่มีข้อมูล",
      peers:
        "Peer comparison ใช้บริษัท same-SIC จาก seed universe ที่จำกัดและอ้างอิง SEC เท่านั้น",
      dataQuality:
        "Data confidence บอกว่าข้อมูล SEC tags ที่ขาดหรือไม่ครบควรจำกัดการใช้ screen แค่ไหน",
    },
  },
  events: {
    title: "เหตุการณ์ล่าสุดและผลกระทบทางการเงินที่อาจเกิดขึ้น",
    subtitle:
      "แปลงเหตุการณ์ล่าสุดของบริษัท อุตสาหกรรม ภาพรวมเศรษฐกิจ กฎหมาย/กฎเกณฑ์ และ filing ให้เป็นปัจจัยทางการเงินที่นักลงทุนควรติดตาม",
    badge: "ผลกระทบจากเหตุการณ์",
    badgeTooltip:
      "การอ่านผลกระทบจากเหตุการณ์เป็นการคัดกรองแบบระมัดระวังและมีลิงก์แหล่งข้อมูล ไม่ใช่การทำนายราคาหุ้น",
    loading: "กำลังโหลดเหตุการณ์ล่าสุด...",
    unavailable: "ยังโหลดเหตุการณ์ล่าสุดไม่ได้ในตอนนี้",
    empty:
      "ยังไม่มีเหตุการณ์ล่าสุดที่มีลิงก์แหล่งข้อมูล ใช้การวิเคราะห์ filing ด้านล่างเป็นฐานวิจัยหลัก",
    whatHappened: "เกิดอะไรขึ้น",
    eventType: "ประเภทเหตุการณ์",
    potentialDrivers: "ปัจจัยทางการเงินที่อาจได้รับผลกระทบ",
    likelyImpact: "ผลกระทบที่น่าจะเป็น",
    horizon: "กรอบเวลา",
    watchNext: "สิ่งที่ควรดูใน filing ถัดไป",
    confidence: "ความมั่นใจ",
    impactSummaryLabel: "อ่านผลกระทบทางการเงิน",
    investorMeaningLabel: "ความหมายสำหรับนักลงทุน",
    analysis: "การวิเคราะห์",
    publicAnalysis: "บทวิเคราะห์สาธารณะ",
    privateAnalysis: "บทวิเคราะห์ส่วนตัว",
    deterministicAnalysis: "อ่านด้วยกฎ",
    aiAnalysis: "อ่านด้วย AI",
    generatePrivate: "สร้างบทวิเคราะห์เหตุการณ์ส่วนตัว",
    signInForPrivate: "เข้าสู่ระบบเพื่อสร้างบทวิเคราะห์เหตุการณ์ส่วนตัว",
    publishPublic: "เผยแพร่บทวิเคราะห์เหตุการณ์สาธารณะ",
    adminPublishHint:
      "เครื่องมือ admin สำหรับสร้างบทวิเคราะห์ผลกระทบจากเหตุการณ์สาธารณะของ ticker นี้",
    featured: "ปักหมุด",
    hidden: "ซ่อนอยู่",
    feature: "ปักหมุด",
    unfeature: "เลิกปักหมุด",
    hide: "ซ่อน",
    unhide: "เลิกซ่อน",
    curationFailed: "ยังอัปเดตการจัดการเหตุการณ์ไม่ได้ในตอนนี้",
    analysisFailed: "ยังสร้างบทวิเคราะห์เหตุการณ์ไม่ได้ในตอนนี้",
    source: "แหล่งที่มา",
    generated: "สร้างเมื่อ",
    sourceNote:
      "หัวข่าวถูกตีความด้วยกฎแบบคงที่ และควรตรวจสอบกับแหล่งข้อมูลและ filing ถัดไป นี่ไม่ใช่คำแนะนำให้ซื้อหรือขาย",
    typeLabels: {
      "company-specific": "เฉพาะบริษัท",
      industry: "อุตสาหกรรม",
      macro: "ภาพรวมเศรษฐกิจ",
      "legal-regulatory": "กฎหมาย/กฎเกณฑ์",
      "filing-related": "เกี่ยวกับ filing",
    },
    driverLabels: {
      revenue: "Revenue",
      margin: "Margin",
      "cash-flow": "Cash flow",
      debt: "Debt",
      capex: "Capex",
      "valuation-risk": "Valuation risk",
    },
    impactLabels: {
      positive: "บวก",
      neutral: "ผสม",
      negative: "ลบ",
      unknown: "ยังไม่ชัด",
    },
    horizonLabels: {
      "short-term": "อารมณ์ตลาดระยะสั้น",
      "long-term": "ปัจจัยพื้นฐานระยะยาว",
      both: "ทั้งอารมณ์ตลาดและปัจจัยพื้นฐาน",
      uncertain: "ยังไม่ชัด",
    },
    confidenceLabels: {
      High: "สูง",
      Medium: "ปานกลาง",
      Low: "ต่ำ",
    },
    watchMetrics: {
      "revenue-growth": "Revenue growth",
      "gross-margin": "Gross margin",
      "free-cash-flow": "Free cash flow",
      "debt-and-liabilities": "Debt และ liabilities/assets",
      capex: "Capex และ cash flow",
      "risk-disclosure": "Risk disclosure และคำอธิบายของผู้บริหาร",
    },
    impactSummary: (
      impact: string,
      drivers: string,
      watchMetric: string,
      confidence: string,
    ) =>
      `ผลกระทบที่อาจเกิดขึ้น: เป็นสัญญาณ${impact}ต่อ ${drivers} ควรดู ${watchMetric} ใน filing ถัดไป ความมั่นใจ: ${confidence}`,
    whatHappenedSummary: (
      eventType: string,
      drivers: string,
      impact: string,
      watchMetric: string,
    ) =>
      `เหตุการณ์ประเภท${eventType}นี้อาจสำคัญ เพราะเป็นสัญญาณ${impact}ต่อ ${drivers} นักลงทุนควรดู ${watchMetric} ใน filing ถัดไปเพื่อยืนยันว่ากระทบธุรกิจจริงหรือไม่`,
    investorMeaning: (impact: string, drivers: string, horizon: string) =>
      `ความหมายสำหรับนักลงทุน: มองเป็นสัญญาณ${impact}ต่อ ${drivers} และอาจกระทบ ${horizon} จึงควรยืนยันผลจริงใน filing ถัดไปก่อนใช้ตัดสินใจ`,
    aiInstruction:
      "วิเคราะห์เฉพาะ headline, snippet จาก feed, metadata ของ filing, และ deterministic baseline ที่ให้มาเท่านั้น ห้ามดึงหรือแต่งรายละเอียดจากบทความเพิ่มเติม อธิบายผลกระทบทางการเงินเป็นภาษาไทยที่นักลงทุนทั่วไปเข้าใจง่าย ห้ามให้คำแนะนำซื้อขาย ราคาเป้าหมาย การทำนายราคา หรือคำแนะนำเฉพาะบุคคล ส่งกลับ strict JSON หนึ่งผลลัพธ์ต่อหนึ่ง event",
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
      "เขียน equity research memo ระดับสถาบันเป็นภาษาไทยแบบมืออาชีพและเข้าใจง่ายสำหรับนักลงทุนรายย่อย ใช้เฉพาะข้อมูล SEC-derived facts, quarterly/TTM fields, peer comparison, data-quality checks, decision framework, event impacts ที่มี source link, citations, และ caveats ที่ให้มาเท่านั้น มอง event เป็นสัญญาณจาก headline/snippet ไม่ใช่ผลลัพธ์ทางการเงินที่ยืนยันแล้ว ห้ามให้คำแนะนำซื้อหรือขาย ห้ามให้ราคาเป้าหมาย ห้ามทำนายราคาหุ้น และห้ามให้คำแนะนำการลงทุนเฉพาะบุคคล ส่งกลับเป็น strict JSON พร้อม sections: [{title, body, signal}] โดย signal ต้องเป็น positive, neutral, negative, หรือ unknown",
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
      decisionScreen: "หน้าช่วยตัดสินใจ",
      quarterlyTtm: "มุมมองรายไตรมาสและ TTM",
      peerAndConfidence: "Peer และความมั่นใจของข้อมูล",
      eventImpact: "เหตุการณ์ที่ควรติดตาม",
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
      decision: (takeaway: string, evidence: string, risk: string, watchMetric: string) =>
        `หน้าช่วยตัดสินใจ: ${takeaway} หลักฐานที่แข็งแรงที่สุดคือ ${evidence}; ความเสี่ยงหลักคือ ${risk}; metric ที่ควรดูต่อคือ ${watchMetric}.`,
      quarterly: (periodLabel: string, revenue: string, netIncome: string, fcf: string) =>
        `มุมมอง TTM หรือไตรมาสล่าสุด: ${periodLabel} มี revenue ${revenue}, net income ${netIncome}, และ FCF ${fcf}.`,
      quarterlyUnavailable:
        "การวิเคราะห์รายไตรมาสและ TTM ยังจำกัด เพราะไม่มี quarterly facts ที่เทียบกันได้ครบ",
      peerDataQuality: (peerCount: number, confidence: string) =>
        `Peer comparison ใช้ peer same-SIC ${peerCount} บริษัทจาก Finari coverage ที่จำกัดและอ้างอิง SEC เท่านั้น ความมั่นใจของข้อมูลอยู่ที่ ${confidence} ดังนั้น missing tags หรือ peer coverage ที่จำกัดควรมีผลต่อน้ำหนักที่ใช้กับ screen นี้`,
      eventImpact: (events: string) =>
        `เหตุการณ์ล่าสุดที่มี source link และควรติดตาม: ${events} ใช้เป็นจุดตรวจ driver ทางการเงิน ไม่ใช่การทำนายราคาหุ้น`,
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
    signInToUse: "เข้าสู่ระบบด้วยอีเมลเพื่อใช้เครื่องมือ workspace",
    tools: [
      "บันทึกงานวิจัยบริษัท",
      "แจ้งเตือน filing และ metrics",
      "Export investment memos",
      "เชื่อมต่อ valuation provider",
    ],
    savedResearchListTitle: "งานวิจัยที่บันทึกแล้ว",
    loadSavedResearchFailed: "ไม่สามารถโหลดรายการที่บันทึกไว้ได้",
    savedResearchEmpty: "ยังไม่มีงานวิจัยที่บันทึกไว้",
    addToWorkspace: "บันทึกลง workspace",
    addToWorkspaceSuccess: "บันทึกงานวิจัยลง workspace เรียบร้อยแล้ว",
    addToWorkspaceError: "ไม่สามารถบันทึกงานวิจัยนี้ได้ตอนนี้",
    savedWorkspaceTitle: "งานวิจัยที่บันทึกแล้ว",
    savedWorkspaceSubtitle: "รายการงานวิจัยที่คุณบันทึกไว้",
    viewSavedWorkspace: "ดู workspace ที่บันทึก",
    workspaceViewDisabled: "เข้าสู่ระบบเพื่อดูรายการที่บันทึกไว้",
    watchlistTitle: "Watchlist",
    watchlistAddTitle: "เพิ่มหุ้นลง watchlist",
    watchlistListTitle: "รายการใน watchlist",
    watchlistLoadFailed: "ไม่สามารถโหลด watchlist ได้ตอนนี้",
    watchlistAddFailed: "ไม่สามารถเพิ่มหุ้นลง watchlist นี้ได้",
    watchlistAdded: "เพิ่มเข้ารายการ watchlist แล้ว",
    watchlistDuplicate: "บริษัทนี้อยู่ใน watchlist แล้ว",
    watchlistEmpty: "ยังไม่มีหุ้นใน watchlist นี้",
    alertTitle: "แจ้งเตือน filing และ metrics",
    alertSubtitle:
      "สร้าง/อัปเดตกฎแจ้งเตือน ระบบจะคิว alert ที่เข้าเงื่อนไขไว้ใน inbox ภายในและส่งอีเมลเมื่อพร้อม",
    alertTypeLabel: "ประเภท alert",
    alertConditionLabel: "เงื่อนไข",
    alertThresholdLabel: "ค่าขีดจำกัด",
    alertNotesLabel: "บันทึก",
    alertCreate: "บันทึก alert",
    alertEnable: "เปิดการแจ้งเตือน",
    alertDisable: "หยุดการแจ้งเตือน",
    alertSaved: "บันทึก alert แล้ว ระบบจะคิวการแจ้งเตือนที่เข้าเงื่อนไขไว้ใน inbox ภายในและอีเมลเมื่อพร้อม",
    alertUpdated: "อัปเดต alert แล้ว ระบบจะคิวการแจ้งเตือนที่เข้าเงื่อนไขไว้ใน inbox ภายในและอีเมลเมื่อพร้อม",
    alertLoadFailed: "ไม่สามารถโหลด alert ได้",
    alertToggleDisabled: "เข้าสู่ระบบเพื่อสร้าง alert",
    valuationTitle: "Valuation",
    valuationLoading: "กำลังโหลดค่า valuation...",
    valuationNotConfigured: "ใส่ค่า FMP_API_KEY เพื่อใช้งาน valuation",
    valuationUnavailable: "ข้อมูล valuation ชั่วคราวไม่สามารถใช้ได้",
    valuationAsOf: "อัปเดตล่าสุด",
    valuationDisclaimer: "ข้อมูล valuation เป็นข้อมูลเสริมสำหรับงานวิจัย ไม่ใช่คำแนะนำการลงทุน",
    valuationSourceLabel: "ที่มา",
    valuationMetricsTitle: "ตัวชี้วัด valuation ทั้งหมด",
    valuationMetricsSubtitle: "รวมจาก FMP key metrics, ratios, และ quote data",
    exportTitle: "ส่งออกสรุป",
    exportSubtitle: "ดาวน์โหลด memo และสรุป snapshot เมื่อมี memo พร้อมใช้งาน",
    exportMemoUnavailable: "สร้าง memo ก่อนเพื่อเปิดใช้งานการ export",
    exportJson: "ดาวน์โหลด JSON",
    exportCsv: "ดาวน์โหลด CSV",
    exportFailed: "ไม่สามารถ export workspace ได้",
    exportSaved: "เริ่ม export แล้ว",
    exportSignedOut: "เข้าสู่ระบบเพื่อ export private memo",
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
    fewerQuarters:
      "Finari พบงวดรายไตรมาสที่เทียบกันได้น้อยกว่าสี่งวด ทำให้การวิเคราะห์ TTM มีข้อจำกัด",
    peerLimited:
      "Peer coverage จาก SEC industry ยังจำกัด จึงควรใช้ peer comparison เป็นสัญญาณประกอบเชิงทิศทาง",
    peerFewerThanThree:
      "มี peer snapshots แบบ same-SIC จากข้อมูล SEC น้อยกว่าสามบริษัท",
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

  if (caveat === dictionaries.en.caveats.fewerQuarters) {
    return t.caveats.fewerQuarters;
  }

  if (caveat === dictionaries.en.caveats.peerLimited) {
    return t.caveats.peerLimited;
  }

  if (caveat === dictionaries.en.caveats.peerFewerThanThree) {
    return t.caveats.peerFewerThanThree;
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
