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
  },
  advisor: {
    badge: "Plain-English summary",
    heading: "What the latest filing means",
    intro:
      "Start by checking whether the business is still healthy, then compare that with the stock price.",
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
      "This summary is a starting point for understanding the business, not a buy/sell recommendation. The stock price, personal risk tolerance, and portfolio fit still need separate review.",
    questionsTitle: "Questions to ask before investing",
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
    questions: {
      revenueDecline: "What could help revenue start growing again?",
      revenueContinue: "Can revenue keep growing without hurting profit margins?",
      netIncomeLower:
        "Is the lower net income temporary, or is the business becoming less profitable?",
      earningsDurable:
        "Are earnings gains coming from the core business, or from one-time items?",
      marginsDefensible:
        "Can these profit margins hold up if competition or pricing pressure increases?",
      operatingLeverage: "What could help profit margins improve from here?",
      balanceFlex:
        "Does the company have enough cash and balance-sheet flexibility if the economy weakens?",
      priceReflect:
        "How much of these fundamentals is already reflected in the current stock price?",
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
  },
  memo: {
    badge: "Filing-backed memo",
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
    saveResearchTitle: "Save company research",
    signIn: "Sign in",
    saveResearch: "Save research",
    signInToSave: "Sign in with email to save this research.",
    saved: "Research saved to your Finari workspace.",
    saveFailed: "This research could not be saved right now.",
    earlyAccessBadge: "Early access",
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
    tools: [
      "Saved company research",
      "Filing and metric alerts",
      "Exportable investment memos",
      "Valuation provider integration",
    ],
  },
  sources: {
    title: "Source links",
    caveatsTitle: "Normalization caveats",
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
  },
  advisor: {
    badge: "สรุปให้อ่านง่าย",
    heading: "งบล่าสุดบอกอะไรแบบสั้น ๆ",
    intro:
      "เริ่มจากดูว่าธุรกิจยังแข็งแรงหรือไม่ แล้วค่อยดูว่าราคาหุ้นแพงหรือถูก",
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
      "สรุปนี้ช่วยให้เริ่มเข้าใจธุรกิจ แต่ยังไม่ใช่คำแนะนำให้ซื้อหรือขาย ควรดูราคาหุ้น ความเสี่ยงที่รับได้ และความเหมาะสมกับพอร์ตของตัวเองเพิ่มเติม",
    questionsTitle: "คำถามที่ควรถามต่อก่อนลงทุน",
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
    questions: {
      revenueDecline: "อะไรจะช่วยให้รายได้กลับมาเติบโตอีกครั้ง?",
      revenueContinue: "รายได้จะโตต่อได้หรือไม่โดยไม่กดดันกำไร?",
      netIncomeLower:
        "กำไรสุทธิที่ลดลงเป็นเรื่องชั่วคราว หรือธุรกิจเริ่มทำกำไรยากขึ้น?",
      earningsDurable:
        "กำไรที่ดีขึ้นมาจากธุรกิจหลักที่ยั่งยืน หรือเกิดจากรายการพิเศษครั้งเดียว?",
      marginsDefensible:
        "อัตรากำไรระดับนี้รักษาไว้ได้แค่ไหน หากการแข่งขันหรือแรงกดดันด้านราคาเพิ่มขึ้น?",
      operatingLeverage: "มีอะไรที่จะช่วยให้อัตรากำไรดีขึ้นจากนี้?",
      balanceFlex: "บริษัทมีเงินสดและงบดุลยืดหยุ่นพอหรือไม่ ถ้าเศรษฐกิจแย่ลง?",
      priceReflect: "ราคาหุ้นปัจจุบันสะท้อนพื้นฐานเหล่านี้ไปแล้วมากแค่ไหน?",
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
  },
  memo: {
    badge: "Memo อ้างอิง filing",
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
    saveResearchTitle: "บันทึกงานวิจัยบริษัท",
    signIn: "เข้าสู่ระบบ",
    saveResearch: "บันทึก research",
    signInToSave: "เข้าสู่ระบบด้วยอีเมลเพื่อบันทึกงานวิจัยนี้",
    saved: "บันทึกงานวิจัยใน Finari workspace แล้ว",
    saveFailed: "ยังไม่สามารถบันทึกงานวิจัยนี้ได้ในตอนนี้",
    earlyAccessBadge: "Early access",
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
    tools: [
      "บันทึกงานวิจัยบริษัท",
      "แจ้งเตือน filing และ metrics",
      "Export investment memos",
      "เชื่อมต่อ valuation provider",
    ],
  },
  sources: {
    title: "Source links",
    caveatsTitle: "ข้อควรระวังจากการ normalize ข้อมูล",
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
