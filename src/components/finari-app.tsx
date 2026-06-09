"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bookmark,
  Building2,
  CheckCircle2,
  Clock3,
  CircleHelp,
  Database,
  DollarSign,
  Download,
  FileText,
  Languages,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Minus,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  compactCurrency,
  compactNumber,
  formatMetricValue,
  formatPercent,
} from "@/lib/format";
import {
  getAlternateLocale,
  getDictionary,
  translateCaveat,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";
import type {
  BusinessDriver,
  ChangeItem,
  CompanyIdentity,
  CompanyEventImpact,
  CompanySnapshot,
  DataQualityCheck,
  AlertPreference,
  FinancialMetric,
  FinancialPeriod,
  MetricUnit,
  PeerMetricComparison,
  ResearchMemo,
  ValuationMetric,
  ValuationSnapshot,
  TrendSignal,
} from "@/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";
type MemoState = "idle" | "loading" | "ready" | "error";
type EventCurationAction = "feature" | "unfeature" | "hide" | "unhide";
type Viewer = {
  id: string;
  email?: string | null;
  isAdmin: boolean;
};

type ClientActivityEvent = {
  eventName: string;
  path: string;
  locale: Locale;
  ticker?: string;
  metadata?: Record<string, unknown>;
};

type WorkspaceWatchlist = {
  id: string;
  name: string;
  isDefault: boolean;
};

type WorkspaceWatchlistItem = {
  id: string;
  companyId: string;
  watchlistId: string;
  company: {
    ticker: string;
    name: string;
  };
  addedAt: string;
};

type WorkspaceAlert = Pick<
  AlertPreference,
  "id" | "ticker" | "alertType" | "config" | "enabled" | "createdAt" | "lastTriggeredAt"
>;

type WorkspaceValuation = ValuationSnapshot | null;

type WorkspaceSavedResearch = {
  id: string;
  title: string;
  notes: string | null;
  createdAt: string;
  ticker: string;
  companyName: string;
};

type WorkspacePanelState = "idle" | "loading" | "ready" | "error";

type PublicTileFeedback = {
  id: string;
  tileId: string;
  tileLabel: string;
  feedback: string;
  votes: number;
  createdAt: string;
};

type FeedbackTarget = {
  ticker: string;
  locale: Locale;
  tileId: string;
  tileLabel: string;
};

const VALUATION_METRICS_PREVIEW_LIMIT = 12;
const VALUATION_FAVORITES_STORAGE_PREFIX = "finari:valuation-metric-favorites";

const ALERT_TYPES = [
  "revenue",
  "net-income",
  "fcf",
  "cash",
  "debt",
  "working-capital",
  "debt-to-equity",
  "roe",
  "custom",
] as const;

const ALERT_CONDITIONS = [
  "above",
  "below",
  "change-above",
  "change-below",
  "above-or-equal",
  "below-or-equal",
] as const;

type AlertTypeOption = typeof ALERT_TYPES[number];
type AlertConditionOption = typeof ALERT_CONDITIONS[number];

function isAlertTypeOption(value: string): value is AlertTypeOption {
  return (ALERT_TYPES as readonly string[]).includes(value);
}

function isAlertConditionOption(value: string): value is AlertConditionOption {
  return (ALERT_CONDITIONS as readonly string[]).includes(value);
}

function alertTypeLabel(t: Dictionary, value: string): string {
  return isAlertTypeOption(value) ? t.waitlist.alertTypeOptions[value] : value;
}

function alertConditionLabel(t: Dictionary, value: string): string {
  return isAlertConditionOption(value) ? t.waitlist.alertConditionOptions[value] : value;
}

function buildDownload(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function captureElementSnapshot(element: HTMLElement): Record<string, unknown> {
  const rect = element.getBoundingClientRect();
  return {
    capturedAt: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    text: element.innerText.slice(0, 4000),
    html: element.outerHTML.slice(0, 12000),
  };
}

function FeedbackTile({
  target,
  children,
}: {
  target: FeedbackTarget;
  children: ReactNode;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [items, setItems] = useState<PublicTileFeedback[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    const response = await fetch(
      `/api/feedback?ticker=${encodeURIComponent(target.ticker)}&tileId=${encodeURIComponent(target.tileId)}&limit=20`,
    );
    if (!response.ok) {
      throw new Error("Unable to load feedback");
    }
    const body = await response.json() as { feedback?: PublicTileFeedback[] };
    setItems(body.feedback ?? []);
  }, [target.ticker, target.tileId]);

  function toggleFeedback() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      void loadFeedback().catch(() => undefined);
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = feedback.trim();
    if (trimmed.length < 3) {
      setState("error");
      setMessage("Add a little more detail before submitting.");
      return;
    }

    setState("loading");
    setMessage(null);
    const screenshot = tileRef.current ? captureElementSnapshot(tileRef.current) : {};
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...target,
        pagePath: window.location.pathname + window.location.search,
        feedback: trimmed,
        screenshot,
      }),
    });

    if (!response.ok) {
      setState("error");
      setMessage("Feedback could not be submitted.");
      return;
    }

    const body = await response.json() as { feedback: PublicTileFeedback };
    setItems((current) => [body.feedback, ...current]);
    setFeedback("");
    setState("ready");
    setMessage("Feedback submitted.");
  }

  async function vote(item: PublicTileFeedback) {
    const response = await fetch(`/api/feedback/${encodeURIComponent(item.id)}/vote`, {
      method: "POST",
    });
    if (!response.ok) {
      return;
    }
    const body = await response.json() as { feedback?: PublicTileFeedback };
    if (!body.feedback) {
      return;
    }
    setItems((current) =>
      current.map((entry) => entry.id === item.id ? body.feedback as PublicTileFeedback : entry),
    );
  }

  return (
    <div ref={tileRef} className="group/feedback relative min-w-0">
      {children}
      <button
        type="button"
        onClick={toggleFeedback}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white/95 text-zinc-500 opacity-100 shadow-sm transition hover:border-teal-500 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 md:opacity-0 md:group-hover/feedback:opacity-100"
        aria-label={`Comment on ${target.tileLabel}`}
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-11 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-md border border-zinc-200 bg-white p-3 text-left shadow-xl">
          <form onSubmit={submitFeedback}>
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Feedback
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal leading-6 text-zinc-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                placeholder="What should improve on this card?"
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                This captures this card snapshot for admin review.
              </p>
              <button
                type="submit"
                disabled={state === "loading"}
                className="inline-flex h-8 items-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {state === "loading" ? "Submitting" : "Submit"}
              </button>
            </div>
            {message && (
              <p className={`mt-2 text-xs ${state === "error" ? "text-rose-700" : "text-teal-700"}`}>
                {message}
              </p>
            )}
          </form>

          <div className="mt-3 border-t border-zinc-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Public requests
            </p>
            <div className="mt-2 max-h-48 space-y-2 overflow-auto">
              {items.length ? (
                items.map((item) => (
                  <div key={item.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
                    <p className="break-words text-xs leading-5 text-zinc-700">
                      {item.feedback}
                    </p>
                    <button
                      type="button"
                      onClick={() => void vote(item)}
                      className="mt-2 inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700 hover:border-teal-500 hover:text-teal-700"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.votes}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs leading-5 text-zinc-500">
                  No public requests yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MagicLinkForm({
  t,
  locale,
  ticker,
  compact = false,
}: {
  t: Dictionary;
  locale: Locale;
  ticker?: string;
  compact?: boolean;
}) {
  const emailInputId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setState("error");
      setMessage(t.waitlist.signInFailed);
      return;
    }

    setState("loading");
    setMessage(null);
    const callbackUrl = `/${locale}${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ""}`;
    const result = await signIn("email", {
      email: normalizedEmail,
      callbackUrl,
      redirect: false,
    }).catch(() => null);

    if (!result || result.error) {
      setState("error");
      setMessage(t.waitlist.signInFailed);
      return;
    }

    setState("ready");
    setMessage(t.waitlist.signInSent);
  }

  return (
    <form
      onSubmit={submit}
      className={compact ? "mt-3 grid min-w-0 gap-2" : "mt-4 grid gap-2"}
      data-activity="auth.magic_link.form"
    >
      {!compact && (
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {t.waitlist.signInEmailTitle}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            {t.waitlist.signInEmailHelp}
          </p>
        </div>
      )}
      <label className="sr-only" htmlFor={emailInputId}>
        {t.waitlist.emailPlaceholder}
      </label>
      <div
        className={
          compact
            ? "grid min-w-0 grid-cols-1 gap-2"
            : "flex flex-col gap-2 sm:flex-row"
        }
      >
        <input
          id={emailInputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.waitlist.emailPlaceholder}
          className="h-10 w-full min-w-0 flex-1 rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={`inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 ${
            compact ? "w-full min-w-0" : "shrink-0"
          }`}
          data-activity="auth.magic_link.submit"
        >
          {state === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="h-4 w-4" aria-hidden="true" />
          )}
          {state === "loading" ? t.waitlist.signInSending : t.waitlist.signInSend}
        </button>
      </div>
      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state === "error"
              ? "bg-rose-50 text-rose-800"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

function useActivityTracker({
  viewer,
  locale,
  ticker,
}: {
  viewer: Viewer | null;
  locale: Locale;
  ticker?: string;
}) {
  const queueRef = useRef<ClientActivityEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (!viewer || queueRef.current.length === 0) {
      return;
    }

    const events = queueRef.current.splice(0, 25);
    void fetch("/api/activity/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    }).catch(() => undefined);
  }, [viewer]);

  const enqueue = useCallback((event: Omit<ClientActivityEvent, "path" | "locale">) => {
    if (!viewer) {
      return;
    }

    queueRef.current.push({
      ...event,
      path: `${window.location.pathname}${window.location.search}`,
      locale,
      ticker: event.ticker ?? ticker,
    });

    if (queueRef.current.length >= 10) {
      flush();
      return;
    }

    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = window.setTimeout(flush, 2500);
  }, [flush, locale, ticker, viewer]);

  useEffect(() => {
    if (!viewer) {
      return undefined;
    }

    enqueue({
      eventName: "client.page_view",
      metadata: { route: window.location.pathname },
    });

    function trackInteraction(event: MouseEvent | Event, interactionType: "click" | "change") {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const element = target.closest<HTMLElement>("[data-activity]");
      const eventName = element?.dataset.activity;
      if (!eventName) {
        return;
      }
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const elementRect = element.getBoundingClientRect();
      const selectedValue =
        element instanceof HTMLSelectElement ? element.value.trim().toUpperCase() : "";
      const activityTicker = element.dataset.activityTicker?.trim().toUpperCase() || selectedValue;
      const clickEvent = event instanceof MouseEvent ? event : null;
      const clickX = clickEvent?.clientX ?? elementRect.left + elementRect.width / 2;
      const clickY = clickEvent?.clientY ?? elementRect.top + elementRect.height / 2;

      enqueue({
        eventName,
        ticker: activityTicker || undefined,
        metadata: {
          interactionType,
          role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
          disabled: element.getAttribute("aria-disabled") === "true",
          metricId: element.dataset.activityMetricId,
          metricSource: element.dataset.activityMetricSource,
          clickX: Math.round(clickX),
          clickY: Math.round(clickY),
          viewportWidth,
          viewportHeight,
          clickPercentX: Math.round((clickX / Math.max(viewportWidth, 1)) * 1000) / 10,
          clickPercentY: Math.round((clickY / Math.max(viewportHeight, 1)) * 1000) / 10,
          heatmapZone: heatmapZoneFromPoint(
            clickX,
            clickY,
            viewportWidth,
            viewportHeight,
          ),
          elementLeft: Math.round(elementRect.left),
          elementTop: Math.round(elementRect.top),
          elementWidth: Math.round(elementRect.width),
          elementHeight: Math.round(elementRect.height),
        },
      });
    }

    function onClick(event: MouseEvent) {
      trackInteraction(event, "click");
    }

    function onChange(event: Event) {
      trackInteraction(event, "change");
    }

    window.addEventListener("click", onClick);
    window.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("change", onChange);
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
      flush();
    };
  }, [enqueue, flush, viewer]);
}

function formatValuationMetric(
  value: number | null,
  fallback: string,
  options: { compact?: boolean; percent?: boolean } = {},
) {
  if (value === null || Number.isNaN(value)) {
    return fallback;
  }

  if (options.percent) {
    return formatPercent(value / 100);
  }

  if (options.compact) {
    return compactNumber(value);
  }

  return compactCurrency(value);
}

function formatLocaleDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(
    locale === "th" ? "th-TH" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="currentColor"
    >
      <path d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 0 0 7.865 10.925c.575.105.785-.25.785-.55 0-.27-.01-1.13-.015-2.04-3.196.695-3.872-1.542-3.872-1.542-.523-1.33-1.277-1.684-1.277-1.684-1.044-.714.08-.7.08-.7 1.154.082 1.761 1.184 1.761 1.184 1.026 1.757 2.693 1.25 3.35.955.104-.742.401-1.25.73-1.54-2.555-.29-5.243-1.277-5.243-5.69 0-1.255.447-2.282 1.18-3.086-.118-.29-.51-1.455.111-3.034 0 0 .963-.308 3.155 1.18a10.96 10.96 0 0 1 5.746 0c2.19-1.488 3.15-1.18 3.15-1.18.623 1.58.231 2.744.113 3.034.734.804 1.178 1.831 1.178 3.086 0 4.425-2.693 5.397-5.258 5.68.412.356.78 1.056.78 2.127 0 1.537-.014 2.778-.014 3.154 0 .303.205.66.79.548A11.5 11.5 0 0 0 23.5 12C23.5 5.648 18.352.5 12 .5Z" />
    </svg>
  );
}

type Sp500Constituent = {
  ticker: string;
  name: string;
  sector?: string;
};

const STARTER_TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "META"];
const DEFAULT_TICKER = "AAPL";

function heatmapZoneFromPoint(x: number, y: number, width: number, height: number): string {
  const columns = ["left", "center", "right"];
  const rows = ["top", "middle", "bottom"];
  const columnIndex = Math.min(2, Math.max(0, Math.floor((x / Math.max(width, 1)) * 3)));
  const rowIndex = Math.min(2, Math.max(0, Math.floor((y / Math.max(height, 1)) * 3)));
  return `${rows[rowIndex]}-${columns[columnIndex]}`;
}

function signalClasses(signal: TrendSignal): string {
  if (signal === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (signal === "negative") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (signal === "unknown") {
    return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

type SignalIconVariant = "status" | "trend";
type MeaningTone = "sky" | "teal" | "emerald" | "amber" | "zinc";

function signalIcon(signal: TrendSignal, variant: SignalIconVariant = "status") {
  if (variant === "trend") {
    if (signal === "positive") {
      return <TrendingUp className="h-4 w-4" aria-hidden="true" />;
    }

    if (signal === "negative") {
      return <TrendingDown className="h-4 w-4" aria-hidden="true" />;
    }

    if (signal === "unknown") {
      return <CircleHelp className="h-4 w-4" aria-hidden="true" />;
    }

    return <Minus className="h-4 w-4" aria-hidden="true" />;
  }

  if (signal === "positive") {
    return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  }

  if (signal === "negative") {
    return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  }

  if (signal === "unknown") {
    return <CircleHelp className="h-4 w-4" aria-hidden="true" />;
  }

  return <ShieldCheck className="h-4 w-4" aria-hidden="true" />;
}

function signalTooltip(
  signal: TrendSignal,
  variant: SignalIconVariant,
  t: Dictionary,
): string {
  const tooltipSet =
    variant === "trend"
      ? t.advisor.signalTooltips.trend
      : t.advisor.signalTooltips.status;

  return tooltipSet[signal];
}

function SignalBadge({
  signal,
  variant = "status",
  label,
  t,
  className = "p-1.5",
  tooltipAlign = "left",
}: {
  signal: TrendSignal;
  variant?: SignalIconVariant;
  label: string;
  t: Dictionary;
  className?: string;
  tooltipAlign?: "left" | "right";
}) {
  const tooltipId = useId();
  const tooltip = signalTooltip(signal, variant, t);
  const alignClass = tooltipAlign === "right" ? "right-0" : "left-0";

  return (
    <span
      className={`group relative inline-flex shrink-0 rounded-md border ${className} ${signalClasses(signal)} outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2`}
      role="img"
      tabIndex={0}
      aria-label={`${label}: ${signal}. ${tooltip}`}
      aria-describedby={tooltipId}
      title={tooltip}
    >
      {signalIcon(signal, variant)}
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute ${alignClass} top-full z-30 mt-2 hidden w-64 max-w-[calc(100vw-2rem)] break-words rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-lg group-hover:block group-focus-visible:block`}
      >
        {tooltip}
      </span>
    </span>
  );
}

function meaningClasses(tone: MeaningTone): string {
  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (tone === "teal") {
    return "border-teal-200 bg-teal-50 text-teal-800";
  }

  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function MeaningBadge({
  Icon,
  label,
  tooltip,
  tone = "zinc",
  className = "p-1.5",
  tooltipAlign = "left",
}: {
  Icon: LucideIcon;
  label: string;
  tooltip: string;
  tone?: MeaningTone;
  className?: string;
  tooltipAlign?: "left" | "right";
}) {
  const tooltipId = useId();
  const alignClass = tooltipAlign === "right" ? "right-0" : "left-0";

  return (
    <span
      className={`group relative inline-flex shrink-0 rounded-md border ${className} ${meaningClasses(tone)} outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2`}
      role="img"
      tabIndex={0}
      aria-label={`${label}. ${tooltip}`}
      aria-describedby={tooltipId}
      title={tooltip}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute ${alignClass} top-full z-30 mt-2 hidden w-64 max-w-[calc(100vw-2rem)] break-words rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-lg group-hover:block group-focus-visible:block`}
      >
        {tooltip}
      </span>
    </span>
  );
}

function MeaningPill({
  Icon,
  label,
  tooltip,
  tone = "zinc",
}: {
  Icon: LucideIcon;
  label: string;
  tooltip: string;
  tone?: MeaningTone;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold ${meaningClasses(tone)}`}
    >
      <MeaningBadge
        Icon={Icon}
        label={label}
        tooltip={tooltip}
        tone={tone}
        className="p-0.5"
      />
      {label}
    </div>
  );
}

function metricTone(metric: FinancialMetric): string {
  if (metric.signal === "positive") {
    return "text-emerald-700";
  }

  if (metric.signal === "negative") {
    return "text-rose-700";
  }

  return "text-zinc-800";
}

function metricValue(snapshot: CompanySnapshot, id: string): number | null {
  return snapshot.metrics.find((metric) => metric.id === id)?.value ?? null;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function describeChange(label: string, value: number | null, t: Dictionary): string {
  if (!hasNumber(value)) {
    return t.advisor.noComparable(label);
  }

  if (Math.abs(value) < 0.005) {
    return t.advisor.flat(label);
  }

  const direction = value > 0 ? t.advisor.increased : t.advisor.declined;
  return t.advisor.changed(label, direction, formatPercent(Math.abs(value)));
}

function metricSignal(snapshot: CompanySnapshot, id: string): TrendSignal {
  return snapshot.metrics.find((metric) => metric.id === id)?.signal ?? "unknown";
}

function growthEarningsSignal(snapshot: CompanySnapshot): TrendSignal {
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");
  const values = [revenueGrowth, netIncomeGrowth].filter(hasNumber);

  if (!values.length) {
    return "unknown";
  }

  const hasDecline = values.some((value) => value < -0.005);
  const hasGrowth = values.some((value) => value > 0.005);

  if (hasDecline && !hasGrowth) {
    return "negative";
  }

  if (hasGrowth && !hasDecline) {
    return "positive";
  }

  return "neutral";
}

function roundedPercentValue(value: number | null): string {
  return hasNumber(value) ? formatPercent(value) : "n/a";
}

function qualityRead(snapshot: CompanySnapshot, t: Dictionary): string {
  const grossMargin = metricValue(snapshot, "gross-margin");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const fcfMargin = metricValue(snapshot, "free-cash-flow-margin");

  if (!hasNumber(grossMargin) && !hasNumber(operatingMargin) && !hasNumber(fcfMargin)) {
    return t.advisor.profitabilityUnavailable;
  }

  const strongProfit =
    (hasNumber(operatingMargin) && operatingMargin >= 0.15) ||
    (hasNumber(fcfMargin) && fcfMargin >= 0.08);
  const weakProfit =
    (hasNumber(operatingMargin) && operatingMargin < 0.03) ||
    (hasNumber(fcfMargin) && fcfMargin < 0);

  if (strongProfit) {
    return t.advisor.profitabilityStrong(
      roundedPercentValue(grossMargin),
      roundedPercentValue(operatingMargin),
      roundedPercentValue(fcfMargin),
    );
  }

  if (weakProfit) {
    return t.advisor.profitabilityWeak(
      roundedPercentValue(grossMargin),
      roundedPercentValue(operatingMargin),
      roundedPercentValue(fcfMargin),
    );
  }

  return t.advisor.profitabilityMixed(
    roundedPercentValue(grossMargin),
    roundedPercentValue(operatingMargin),
    roundedPercentValue(fcfMargin),
  );
}

function balanceSheetRead(snapshot: CompanySnapshot, t: Dictionary): string {
  const debtToEquity = metricValue(snapshot, "debt-to-equity");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");

  if (!hasNumber(debtToEquity) && !hasNumber(liabilitiesToAssets)) {
    return t.advisor.leverageUnavailable;
  }

  const leverageText = [
    hasNumber(debtToEquity)
      ? t.advisor.debtToEquity(formatMetricValue(debtToEquity, "ratio"))
      : null,
    hasNumber(liabilitiesToAssets)
      ? t.advisor.liabilitiesToAssets(formatPercent(liabilitiesToAssets))
      : null,
  ].filter(Boolean);

  const elevated =
    (hasNumber(debtToEquity) && debtToEquity > 1) ||
    (hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7);

  return `${leverageText.join(t.advisor.leverageJoiner)}; ${
    elevated ? t.advisor.leverageElevated : t.advisor.leverageManageable
  }`;
}

function decisionTakeaway(snapshot: CompanySnapshot, t: Dictionary): string {
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const fcfMargin = metricValue(snapshot, "free-cash-flow-margin");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");
  const debtToEquity = metricValue(snapshot, "debt-to-equity");

  const growthPressure = hasNumber(revenueGrowth) && revenueGrowth < -0.005;
  const qualitySupport =
    (hasNumber(operatingMargin) && operatingMargin >= 0.15) ||
    (hasNumber(fcfMargin) && fcfMargin >= 0.08);
  const balanceRisk =
    (hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7) ||
    (hasNumber(debtToEquity) && debtToEquity > 1);

  if (growthPressure && qualitySupport && balanceRisk) {
    return t.advisor.takeaways.qualityGrowthBalance;
  }

  if (growthPressure && qualitySupport) {
    return t.advisor.takeaways.qualityGrowth;
  }

  if (growthPressure) {
    return t.advisor.takeaways.growthPressure;
  }

  if (qualitySupport && balanceRisk) {
    return t.advisor.takeaways.qualityBalance;
  }

  if (qualitySupport) {
    return t.advisor.takeaways.qualitySupport;
  }

  return t.advisor.takeaways.needsMoreEvidence;
}

function advisorReads(snapshot: CompanySnapshot, t: Dictionary) {
  const latest = snapshot.periods[0];
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");

  return [
    {
      title: t.advisor.readLabels.trend,
      body: `${t.advisor.latestFacts(
        snapshot.identity.name,
        compactCurrency(latest?.revenue),
        compactCurrency(latest?.netIncome),
        compactCurrency(latest?.freeCashFlow),
        latest?.fiscalYear ? String(latest.fiscalYear) : t.advisor.latestPeriod,
      )} ${describeChange(t.advisor.labels.revenue, revenueGrowth, t)} ${
        t.advisor.and
      } ${describeChange(t.advisor.labels.netIncome, netIncomeGrowth, t)}.`,
      signal: growthEarningsSignal(snapshot),
      iconVariant: "trend" as const,
    },
    {
      title: t.advisor.readLabels.quality,
      body: qualityRead(snapshot, t),
      signal: metricSignal(snapshot, "operating-margin"),
      iconVariant: "status" as const,
    },
    {
      title: t.advisor.readLabels.balance,
      body: balanceSheetRead(snapshot, t),
      signal: metricSignal(snapshot, "liabilities-to-assets"),
      iconVariant: "status" as const,
    },
    {
      title: t.advisor.readLabels.decision,
      body: decisionTakeaway(snapshot, t),
      signal: "neutral" as const,
      iconVariant: "status" as const,
    },
  ];
}

function advisorQuestionAnswers(snapshot: CompanySnapshot, t: Dictionary) {
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");
  const debtToEquity = metricValue(snapshot, "debt-to-equity");
  const fcfMargin = metricValue(snapshot, "free-cash-flow-margin");

  return [
    {
      question:
        hasNumber(revenueGrowth) && revenueGrowth < -0.005
          ? t.advisor.questions.revenueDecline
          : t.advisor.questions.revenueContinue,
      answer:
        hasNumber(revenueGrowth) && revenueGrowth < -0.005
          ? t.advisor.answers.revenueDecline(formatPercent(Math.abs(revenueGrowth)))
          : t.advisor.answers.revenueContinue(
              hasNumber(revenueGrowth) ? formatPercent(revenueGrowth) : "n/a",
            ),
      signal: metricSignal(snapshot, "revenue-growth"),
    },
    {
      question:
        hasNumber(netIncomeGrowth) && netIncomeGrowth < -0.005
          ? t.advisor.questions.netIncomeLower
          : t.advisor.questions.earningsDurable,
      answer:
        hasNumber(netIncomeGrowth) && netIncomeGrowth < -0.005
          ? t.advisor.answers.netIncomeLower(formatPercent(Math.abs(netIncomeGrowth)))
          : t.advisor.answers.earningsDurable(
              hasNumber(netIncomeGrowth) ? formatPercent(netIncomeGrowth) : "n/a",
            ),
      signal: metricSignal(snapshot, "net-income-growth"),
    },
    {
      question:
        hasNumber(operatingMargin) && operatingMargin > 0.15
          ? t.advisor.questions.marginsDefensible
          : t.advisor.questions.operatingLeverage,
      answer:
        hasNumber(operatingMargin) && operatingMargin > 0.15
          ? t.advisor.answers.marginsDefensible(
              formatPercent(operatingMargin),
              roundedPercentValue(fcfMargin),
            )
          : t.advisor.answers.operatingLeverage(roundedPercentValue(operatingMargin)),
      signal: metricSignal(snapshot, "operating-margin"),
    },
    {
      question:
        hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7
          ? t.advisor.questions.balanceFlex
          : t.advisor.questions.priceReflect,
      answer:
        hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7
          ? t.advisor.answers.balanceFlex(
              formatPercent(liabilitiesToAssets),
              hasNumber(debtToEquity) ? formatMetricValue(debtToEquity, "ratio") : "n/a",
            )
          : t.advisor.answers.priceReflect,
      signal: metricSignal(snapshot, "liabilities-to-assets"),
    },
  ];
}

function makeChartRows(snapshot: CompanySnapshot | null) {
  return (
    snapshot?.periods
      .slice()
      .reverse()
      .map((period) => ({
        year: String(period.fiscalYear),
        revenue: period.revenue ?? 0,
        netIncome: period.netIncome ?? 0,
        freeCashFlow: period.freeCashFlow ?? 0,
        assets: period.assets ?? 0,
        liabilities: period.liabilities ?? 0,
      })) ?? []
  );
}

function AdvisorSummary({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  const reads = advisorReads(snapshot, t);
  const questions = advisorQuestionAnswers(snapshot, t);

  return (
    <section className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,390px)]">
        <div className="min-w-0 max-w-full">
          <MeaningPill
            Icon={ShieldCheck}
            label={t.advisor.badge}
            tooltip={t.advisor.badgeTooltip}
            tone="teal"
          />
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {t.advisor.heading}
          </h3>
          <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
            {t.advisor.intro}
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {reads.map((read) => (
              <FeedbackTile
                key={read.title}
                target={{
                  ticker: snapshot.identity.ticker,
                  locale,
                  tileId: `advisor-read:${read.title}`,
                  tileLabel: read.title,
                }}
              >
                <article className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 pr-12">
                  <div className="flex items-center gap-2">
                    <SignalBadge
                      signal={read.signal}
                      variant={read.iconVariant}
                      label={read.title}
                      t={t}
                      className="shrink-0 p-1.5"
                    />
                    <h4 className="min-w-0 break-words text-sm font-semibold text-zinc-950">
                      {read.title}
                    </h4>
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
                    {read.body}
                  </p>
                </article>
              </FeedbackTile>
            ))}
          </div>
          <p className="mt-3 break-words text-xs leading-5 text-zinc-500">
            {t.advisor.closing}
          </p>
        </div>

        <div className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h4 className="text-sm font-semibold text-zinc-950">
            {t.advisor.questionsTitle}
          </h4>
          <div className="mt-3 space-y-3">
            {questions.map((item) => (
              <FeedbackTile
                key={item.question}
                target={{
                  ticker: snapshot.identity.ticker,
                  locale,
                  tileId: `advisor-question:${item.question}`,
                  tileLabel: item.question,
                }}
              >
                <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-3 pr-12">
                  <div className="flex items-center gap-2">
                    <SignalBadge
                      signal={item.signal}
                      label={item.question}
                      t={t}
                      className="shrink-0 p-1"
                    />
                    <p className="min-w-0 break-words text-sm font-semibold leading-5 text-zinc-950">
                      {item.question}
                    </p>
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
                    {item.answer}
                  </p>
                </article>
              </FeedbackTile>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventImpactCard({
  event,
  locale,
  t,
  ticker,
  viewer,
  curating,
  onCurate,
}: {
  event: CompanyEventImpact;
  locale: Locale;
  t: Dictionary;
  ticker: string;
  viewer: Viewer | null;
  curating: boolean;
  onCurate: (eventId: string, action: EventCurationAction) => void;
}) {
  const eventType = recordValue(t.events.typeLabels, event.eventType, event.eventType);
  const impact = recordValue(t.events.impactLabels, event.impact, event.impact);
  const horizon = recordValue(t.events.horizonLabels, event.horizon, event.horizon);
  const confidence = recordValue(
    t.events.confidenceLabels,
    event.confidence,
    event.confidence,
  );
  const watchMetric = recordValue(
    t.events.watchMetrics,
    event.watchMetric,
    event.watchMetric,
  );
  const driverLabels = event.drivers.map((driver) =>
    recordValue(t.events.driverLabels, driver, driver),
  );
  const driverSummary = driverLabels.join(", ");
  const localizedEventBrief = t.events.whatHappenedSummary(
    eventType,
    driverSummary,
    impact,
    watchMetric,
  );
  const eventBrief = locale === "th" ? localizedEventBrief : event.summary || localizedEventBrief;
  const localizedImpactSummary = t.events.impactSummary(
    impact,
    driverSummary,
    watchMetric,
    confidence,
  );
  const localizedInvestorMeaning = t.events.investorMeaning(
    impact,
    driverSummary,
    horizon,
  );
  const impactSummary =
    locale === "th" ? localizedImpactSummary : event.impactSummary || localizedImpactSummary;
  const investorMeaning =
    locale === "th"
      ? localizedInvestorMeaning
      : event.investorMeaning || localizedInvestorMeaning;
  const publishedAt = new Date(event.publishedAt).toLocaleString(
    locale === "th" ? "th-TH" : "en-US",
  );
  const analysisLabel =
    event.analysisMode === "ai"
      ? t.events.aiAnalysis
      : t.events.deterministicAnalysis;
  const visibilityLabel =
    event.visibility === "private" ? t.events.privateAnalysis : t.events.publicAnalysis;

  return (
    <FeedbackTile
      target={{
        ticker,
        locale,
        tileId: `event:${event.id}`,
        tileLabel: event.title,
      }}
    >
    <article
      className={`min-w-0 rounded-md border bg-white p-4 ${
        event.isFeatured ? "border-sky-300" : "border-zinc-200"
      } ${event.isHidden ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <SignalBadge
          signal={event.impact}
          label={`${event.title}: ${impact}`}
          t={t}
          className="mt-0.5 p-1.5"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            {t.events.whatHappened}
          </p>
          <h4 className="mt-1 break-words text-sm font-semibold leading-6 text-zinc-950">
            {event.title}
          </h4>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700">
              {analysisLabel}
            </span>
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700">
              {visibilityLabel}
            </span>
            {event.isFeatured && (
              <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">
                {t.events.featured}
              </span>
            )}
            {event.isHidden && (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
                {t.events.hidden}
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-sm leading-6 text-zinc-600">
            {eventBrief}
          </p>

          <dl className="mt-4 grid gap-3 text-xs text-zinc-600 md:grid-cols-2">
            <div>
              <dt className="font-semibold text-zinc-500">{t.events.analysis}</dt>
              <dd className="mt-1 font-semibold text-zinc-900">
                {analysisLabel}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-500">{t.events.eventType}</dt>
              <dd className="mt-1 font-semibold text-zinc-900">{eventType}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-500">{t.events.likelyImpact}</dt>
              <dd className="mt-1 font-semibold text-zinc-900">{impact}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-500">{t.events.horizon}</dt>
              <dd className="mt-1 font-semibold text-zinc-900">{horizon}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-500">{t.events.confidence}</dt>
              <dd className="mt-1 font-semibold text-zinc-900">{confidence}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-semibold text-zinc-500">
                {t.events.potentialDrivers}
              </dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {driverLabels.map((driver) => (
                  <span
                    key={driver}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 font-semibold text-zinc-700"
                  >
                    {driver}
                  </span>
                ))}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-semibold text-zinc-500">{t.events.watchNext}</dt>
              <dd className="mt-1 font-semibold text-zinc-900">{watchMetric}</dd>
            </div>
          </dl>

          <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div>
              <p className="text-xs font-semibold text-zinc-500">
                {t.events.impactSummaryLabel}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-zinc-700">
                {impactSummary}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">
                {t.events.investorMeaningLabel}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-zinc-700">
                {investorMeaning}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 text-xs font-medium text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {publishedAt}
            </span>
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-1 font-semibold text-teal-700 hover:text-teal-900"
            >
              <span className="truncate">
                {t.events.source}: {event.sourceName}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          </div>
          {viewer?.isAdmin && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
              <button
                type="button"
                disabled={curating}
                onClick={() =>
                  onCurate(event.id, event.isFeatured ? "unfeature" : "feature")
                }
                className="inline-flex h-8 items-center justify-center rounded-md border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-800 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {curating
                  ? t.events.analysis
                  : event.isFeatured
                    ? t.events.unfeature
                    : t.events.feature}
              </button>
              <button
                type="button"
                disabled={curating}
                onClick={() => onCurate(event.id, event.isHidden ? "unhide" : "hide")}
                className="inline-flex h-8 items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {curating
                  ? t.events.analysis
                  : event.isHidden
                    ? t.events.unhide
                    : t.events.hide}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
    </FeedbackTile>
  );
}

function EventImpactPanel({
  events,
  state,
  privateState,
  adminState,
  error,
  privateError,
  adminError,
  locale,
  ticker,
  t,
  viewer,
  curatingEventId,
  onGeneratePrivate,
  onPublishPublic,
  onCurate,
}: {
  events: CompanyEventImpact[];
  state: LoadState;
  privateState: MemoState;
  adminState: MemoState;
  error: string | null;
  privateError: string | null;
  adminError: string | null;
  locale: Locale;
  ticker?: string;
  t: Dictionary;
  viewer: Viewer | null;
  curatingEventId: string | null;
  onGeneratePrivate: () => void;
  onPublishPublic: () => void;
  onCurate: (eventId: string, action: EventCurationAction) => void;
}) {
  const signedIn = Boolean(viewer);
  const isAdmin = Boolean(viewer?.isAdmin);

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <MeaningPill
            Icon={Newspaper}
            label={t.events.badge}
            tooltip={t.events.badgeTooltip}
            tone="sky"
          />
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {t.events.title}
          </h3>
          <p className="mt-1 break-words text-sm leading-6 text-zinc-600">
            {t.events.subtitle}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {signedIn ? (
            <button
              type="button"
              disabled={privateState === "loading" || state === "loading"}
              onClick={onGeneratePrivate}
              data-activity="events.generate_private"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {privateState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t.events.generatePrivate}
            </button>
          ) : (
            <div className="w-full min-w-0 sm:w-72">
              <MagicLinkForm t={t} locale={locale} compact />
            </div>
          )}
          {isAdmin && (
            <button
              type="button"
              disabled={adminState === "loading" || state === "loading"}
              onClick={onPublishPublic}
              data-activity="admin.events.publish_public"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:border-amber-500 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {adminState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t.events.publishPublic}
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {t.events.adminPublishHint}
        </p>
      )}

      {privateError && (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {privateError}
        </p>
      )}

      {adminError && (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {adminError}
        </p>
      )}

      {state === "loading" && (
        <p className="mt-4 rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          {t.events.loading}
        </p>
      )}

      {state === "error" && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {error || t.events.unavailable}
        </p>
      )}

      {state !== "loading" && state !== "error" && events.length === 0 && (
        <p className="mt-4 rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600">
          {t.events.empty}
        </p>
      )}

      {events.length > 0 && (
        <div className="mt-4 space-y-3">
          {events.map((event) => (
              <EventImpactCard
                key={event.id}
                event={event}
                locale={locale}
                ticker={ticker ?? ""}
                t={t}
                viewer={viewer}
                curating={curatingEventId === event.id}
              onCurate={onCurate}
            />
          ))}
        </div>
      )}

      <p className="mt-4 break-words text-xs leading-5 text-zinc-500">
        {t.events.sourceNote}
      </p>
    </section>
  );
}

function ResearchToolbar({
  locale,
  t,
  query,
  setQuery,
  results,
  sp500Constituents,
  sp500State,
  loading,
  activeTicker,
  onSelectTicker,
  onSubmit,
}: {
  locale: Locale;
  t: Dictionary;
  query: string;
  setQuery: (value: string) => void;
  results: CompanyIdentity[];
  sp500Constituents: Sp500Constituent[];
  sp500State: LoadState;
  loading: boolean;
  activeTicker: string;
  onSelectTicker: (ticker: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const alternateLocale = getAlternateLocale(locale);
  const languageHref = `/${alternateLocale}?ticker=${encodeURIComponent(activeTicker)}`;
  const repoUrl =
    process.env.NEXT_PUBLIC_GITHUB_REPO_URL ?? "https://github.com/hongthana/finari";

  return (
    <section className="relative z-40 border-b border-zinc-200 bg-white/95 shadow-sm shadow-zinc-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:sticky lg:top-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-white sm:h-9 sm:w-9">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
                  {t.toolbar.product}
                </p>
                <h1 className="text-lg font-semibold leading-tight tracking-normal text-zinc-950 sm:text-2xl">
                  {t.toolbar.headline}
                </h1>
              </div>
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-2 text-xs font-medium text-zinc-600 sm:flex">
            <Link
              href={repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t.toolbar.githubRepo}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
            >
              <GitHubIcon className="h-3.5 w-3.5 text-zinc-900" />
              {t.toolbar.github}
            </Link>
            <Link
              href={languageHref}
              aria-label={t.toolbar.languageLabel}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
            >
              <Languages className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              {locale === "en" ? t.toolbar.thai : t.toolbar.english}
            </Link>
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <Database className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
              {t.toolbar.secBacked}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-700"
                aria-hidden="true"
              />
              {t.toolbar.educationOnly}
            </span>
          </div>
        </div>

        <div className="grid gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <form
            onSubmit={onSubmit}
            className="relative"
            data-activity="search.submit"
          >
            <Search
              className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-zinc-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.toolbar.placeholder}
              className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-14 text-base font-medium text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100 sm:pr-28"
            />
            <button
              type="submit"
              aria-label={t.toolbar.research}
              className="absolute right-1.5 top-1.5 inline-flex h-9 w-10 items-center justify-center gap-2 rounded-md bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:w-auto sm:px-4"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{t.toolbar.research}</span>
            </button>

            {results.length > 0 && (
              <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                {results.map((company) => (
                  <button
                    key={`${company.cik}-${company.ticker}`}
                    type="button"
                    data-activity="search.result_select"
                    data-activity-ticker={company.ticker}
                    onClick={() => onSelectTicker(company.ticker)}
                    className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left transition hover:bg-zinc-100"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-950">
                        {company.ticker}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {company.name}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-zinc-400"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="sr-only" htmlFor="sp500-selector">
              {t.toolbar.sp500Label}
            </label>
            <select
              id="sp500-selector"
              data-activity="search.sp500_select"
              value={
                sp500Constituents.some((company) => company.ticker === activeTicker)
                  ? activeTicker
                  : ""
              }
              onChange={(event) => {
                if (event.target.value) {
                  onSelectTicker(event.target.value);
                }
              }}
              disabled={sp500State === "loading" || !sp500Constituents.length}
              className="h-10 min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none transition hover:border-teal-500 focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 sm:w-64"
            >
              <option value="">
                {sp500State === "loading"
                  ? t.toolbar.sp500Loading
                  : t.toolbar.sp500Placeholder}
              </option>
              {sp500Constituents.map((company) => (
                <option key={company.ticker} value={company.ticker}>
                  {company.ticker} - {company.name}
                </option>
              ))}
            </select>

            <div className="hidden flex-wrap gap-2 sm:flex">
              {STARTER_TICKERS.map((ticker) => (
                <button
                  key={ticker}
                  type="button"
                  data-activity="search.starter_ticker"
                  data-activity-ticker={ticker}
                  onClick={() => onSelectTicker(ticker)}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
                >
                  {ticker}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SnapshotHeader({
  snapshot,
  loading,
  error,
  onRefresh,
  t,
  locale,
}: {
  snapshot: CompanySnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  t: Dictionary;
  locale: Locale;
}) {
  if (loading && !snapshot) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3 text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          {t.snapshot.loading}
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="rounded-md border border-rose-200 bg-rose-50 p-5 text-rose-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{t.snapshot.unavailableTitle}</h2>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  const latest = snapshot.periods[0];
  const latestFinancialFiling = snapshot.latestFinancialFiling ?? snapshot.latestFiling;
  const snapshotCards = [
    {
      label: t.snapshot.revenue,
      value: compactCurrency(latest?.revenue),
      Icon: TrendingUp,
      tooltip: t.snapshot.tooltips.revenue,
      tone: "teal" as const,
    },
    {
      label: t.snapshot.netIncome,
      value: compactCurrency(latest?.netIncome),
      Icon: DollarSign,
      tooltip: t.snapshot.tooltips.netIncome,
      tone: "emerald" as const,
    },
    {
      label: t.snapshot.fcf,
      value: compactCurrency(latest?.freeCashFlow),
      Icon: Download,
      tooltip: t.snapshot.tooltips.fcf,
      tone: "sky" as const,
    },
    {
      label: t.snapshot.assets,
      value: compactCurrency(latest?.assets),
      Icon: Database,
      tooltip: t.snapshot.tooltips.assets,
      tone: "zinc" as const,
    },
  ];

  return (
    <section className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex min-w-0 max-w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {snapshot.identity.exchange || t.snapshot.usListed}
            </span>
            {snapshot.identity.sicDescription && (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                {snapshot.identity.sicDescription}
              </span>
            )}
          </div>
          <div className="mt-3 flex min-w-0 items-start gap-3">
            <MeaningBadge
              Icon={Building2}
              label={snapshot.identity.name}
              tooltip={t.snapshot.tooltips.company}
              tone="sky"
              className="mt-1 p-1.5"
            />
            <h2 className="min-w-0 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              {snapshot.identity.name}
            </h2>
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            {snapshot.identity.ticker} · CIK {snapshot.identity.cik}
            {latest?.fiscalYear
              ? ` · ${t.snapshot.fiscalYear} ${latest.fiscalYear}`
              : ""}
          </p>
        </div>

        <div className="grid min-w-0 max-w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[520px] xl:shrink-0">
          {snapshotCards.map(({ label, value, Icon, tooltip, tone }) => (
            <div
              key={label}
              className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs font-medium text-zinc-500">
                  {label}
                </p>
                <MeaningBadge
                  Icon={Icon}
                  label={label}
                  tooltip={tooltip}
                  tone={tone}
                  className="p-1"
                  tooltipAlign="right"
                />
              </div>
              <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 text-sm">
        <button
          type="button"
          onClick={onRefresh}
          data-activity="research.refresh"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-700 transition hover:border-teal-500 hover:text-teal-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t.snapshot.refresh}
        </button>
        {latestFinancialFiling?.url && (
          <a
            href={latestFinancialFiling.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-700 transition hover:border-sky-500 hover:text-sky-700"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t.snapshot.latestFinancialFiling}
          </a>
        )}
        <span className="text-xs font-medium text-zinc-500">
          {t.snapshot.generated}{" "}
          {new Date(snapshot.generatedAt).toLocaleString(
            locale === "th" ? "th-TH" : "en-US",
          )}
        </span>
      </div>
    </section>
  );
}

function recordValue<T extends Record<string, string>>(
  record: T,
  key: string,
  fallback: string,
): string {
  return record[key as keyof T] ?? fallback;
}

function formatAnalysisValue(
  value: number | null | undefined,
  unit: MetricUnit,
): string {
  return formatMetricValue(value, unit);
}

function periodLabel(period: FinancialPeriod, t: Dictionary): string {
  if (period.periodType === "ttm") {
    return t.analysis.ttm;
  }

  if (period.periodType === "quarterly" && period.fiscalPeriod) {
    return `${period.fiscalYear} ${period.fiscalPeriod}`;
  }

  return `${t.snapshot.fiscalYear} ${period.fiscalYear}`;
}

function DecisionScreen({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  const framework = snapshot.decisionFramework;
  const latestFinancialFiling = snapshot.latestFinancialFiling ?? snapshot.latestFiling;
  const decisionCards = [
    {
      label: t.decision.finalTakeaway,
      value: recordValue(
        t.decision.takeaways,
        framework.takeaway,
        framework.takeaway,
      ),
      Icon: ShieldCheck,
      tooltip: t.decision.tooltips.takeaway,
      tone: "teal" as const,
      signal: framework.signal,
    },
    {
      label: t.decision.strongestEvidence,
      value: recordValue(
        t.decision.evidence,
        framework.strongestEvidence,
        framework.strongestEvidence,
      ),
      Icon: CheckCircle2,
      tooltip: t.decision.tooltips.evidence,
      tone: "emerald" as const,
      signal: "positive" as TrendSignal,
    },
    {
      label: t.decision.mainRisk,
      value: recordValue(t.decision.risks, framework.mainRisk, framework.mainRisk),
      Icon: AlertTriangle,
      tooltip: t.decision.tooltips.risk,
      tone: "amber" as const,
      signal: framework.signal === "positive" ? "neutral" : framework.signal,
    },
    {
      label: t.decision.watchNext,
      value: framework.watchMetric,
      Icon: TrendingUp,
      tooltip: t.decision.tooltips.watch,
      tone: "sky" as const,
      signal: "neutral" as TrendSignal,
    },
    {
      label: t.decision.latestFinancialFiling,
      value: latestFinancialFiling
        ? [latestFinancialFiling.form, latestFinancialFiling.filingDate]
            .filter(Boolean)
            .join(" · ")
        : t.decision.notAvailable,
      Icon: FileText,
      tooltip: t.decision.tooltips.filing,
      tone: "zinc" as const,
      signal: latestFinancialFiling ? "positive" : "unknown",
    },
    {
      label: t.decision.dataConfidence,
      value: `${t.analysis.confidenceLabels[snapshot.dataQuality.label]} · ${snapshot.dataQuality.score}/100`,
      Icon: Database,
      tooltip: t.decision.tooltips.confidence,
      tone: "zinc" as const,
      signal: snapshot.dataQuality.signal,
    },
  ];

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <MeaningPill
            Icon={ShieldCheck}
            label={t.decision.badge}
            tooltip={t.decision.badgeTooltip}
            tone="teal"
          />
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {t.decision.heading}
          </h3>
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-zinc-600">
            {t.decision.subtitle}
          </p>
        </div>
        <SignalBadge
          signal={framework.signal}
          label={t.decision.finalTakeaway}
          t={t}
          tooltipAlign="right"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {decisionCards.map((card) => (
          <FeedbackTile
            key={card.label}
            target={{
              ticker: snapshot.identity.ticker,
              locale,
              tileId: `decision:${card.label}`,
              tileLabel: card.label,
            }}
          >
            <article className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 pr-12">
              <div className="flex items-center gap-2">
                <MeaningBadge
                  Icon={card.Icon}
                  label={card.label}
                  tooltip={card.tooltip}
                  tone={card.tone}
                  className="shrink-0 p-1.5"
                />
                <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  {card.label}
                </p>
              </div>
              <p className="mt-2 break-words text-sm font-semibold leading-6 text-zinc-950">
                {card.value}
              </p>
            </article>
          </FeedbackTile>
        ))}
      </div>
    </section>
  );
}

function QuarterlyTrendPanel({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const latestQuarters = snapshot.quarterlyPeriods.slice(0, 4);
  const rows = snapshot.ttmPeriod
    ? [snapshot.ttmPeriod, ...latestQuarters]
    : latestQuarters;

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.quarterlyTitle}
          </h3>
          <p className="mt-1 break-words text-sm leading-6 text-zinc-500">
            {t.analysis.quarterlySubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={TrendingUp}
          label={t.analysis.quarterlyTitle}
          tooltip={t.analysis.tooltips.quarterly}
          tone="teal"
          tooltipAlign="right"
        />
      </div>

      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.08em] text-zinc-500">
              <tr>
                <th className="border-b border-zinc-200 py-2 pr-4 font-semibold">
                  {t.analysis.quarter}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.revenue}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.netIncome}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.fcf}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.opMargin}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((period) => (
                <tr key={`${period.periodType}-${period.fiscalYear}-${period.fiscalPeriod}`}>
                  <td className="py-3 pr-4 font-semibold text-zinc-950">
                    {periodLabel(period, t)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {compactCurrency(period.revenue)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {compactCurrency(period.netIncome)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {compactCurrency(period.freeCashFlow)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatPercent(
                      period.operatingIncome && period.revenue
                        ? period.operatingIncome / period.revenue
                        : null,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!snapshot.ttmPeriod && (
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              {t.analysis.noTtm}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t.analysis.noComparable}
        </p>
      )}
    </section>
  );
}

function ChangeCard({
  item,
  t,
}: {
  item: ChangeItem;
  t: Dictionary;
}) {
  const label = recordValue(t.analysis.changeLabels, item.id, item.label);
  const description = recordValue(
    t.analysis.changeDescriptions,
    item.id,
    item.description,
  );

  return (
    <article className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start gap-3">
        <SignalBadge
          signal={item.signal}
          variant="trend"
          label={label}
          t={t}
          className="mt-0.5 p-1.5"
        />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">
            {label}
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {description}
          </p>
          <dl className="mt-2 grid gap-2 text-xs text-zinc-600 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-zinc-500">{t.analysis.current}</dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatAnalysisValue(item.currentValue, item.unit)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">{t.analysis.previous}</dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatAnalysisValue(item.previousValue, item.unit)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">{t.analysis.change}</dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatPercent(item.change)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

function CaveatChangePanel({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  const caveatChange = snapshot.caveatChangeAnalysis ?? {
    status: "baseline" as const,
    newCaveats: [],
    resolvedCaveats: [],
    unchangedCaveats: snapshot.caveats,
  };
  const hasDeltas =
    caveatChange.newCaveats.length || caveatChange.resolvedCaveats.length;

  const renderList = (title: string, caveats: string[]) =>
    caveats.length ? (
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {title}
        </h5>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-700">
          {caveats.map((caveat) => (
            <li key={caveat} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              <span className="min-w-0 break-words">
                {translateCaveat(caveat, locale)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h4 className="text-sm font-semibold text-zinc-950">
        {t.analysis.caveatChangesTitle}
      </h4>
      {caveatChange.status === "baseline" ? (
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t.analysis.caveatBaseline}
        </p>
      ) : hasDeltas ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {renderList(t.analysis.newCaveats, caveatChange.newCaveats)}
          {renderList(t.analysis.resolvedCaveats, caveatChange.resolvedCaveats)}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t.analysis.caveatUnchanged}
        </p>
      )}
      {caveatChange.unchangedCaveats.length > 0 && (
        <div className="mt-4">
          {renderList(t.analysis.unchangedCaveats, caveatChange.unchangedCaveats)}
        </div>
      )}
    </div>
  );
}

function ChangeAnalysisPanel({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.changeTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.changeSubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={RefreshCw}
          label={t.analysis.changeTitle}
          tooltip={t.analysis.tooltips.change}
          tone="sky"
          tooltipAlign="right"
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">
            {t.analysis.latestQuarter}
          </h4>
          <div className="mt-3 space-y-3">
            {snapshot.changeAnalysis.quarterly.length ? (
              snapshot.changeAnalysis.quarterly.map((item) => (
                <ChangeCard key={item.id} item={item} t={t} />
              ))
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                {t.analysis.noComparable}
              </p>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">
            {t.analysis.latestAnnual}
          </h4>
          <div className="mt-3 space-y-3">
            {snapshot.changeAnalysis.annual.length ? (
              snapshot.changeAnalysis.annual.map((item) => (
                <ChangeCard key={item.id} item={item} t={t} />
              ))
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                {t.analysis.noComparable}
              </p>
            )}
          </div>
        </div>
      </div>
      <CaveatChangePanel snapshot={snapshot} locale={locale} t={t} />
    </section>
  );
}

function BusinessDriverCard({
  driver,
  ticker,
  locale,
  t,
}: {
  driver: BusinessDriver;
  ticker: string;
  locale: Locale;
  t: Dictionary;
}) {
  const label = recordValue(t.analysis.driverLabels, driver.id, driver.id);
  const description = recordValue(
    t.analysis.driverDescriptions,
    driver.id,
    driver.id,
  );

  return (
    <FeedbackTile
      target={{
        ticker,
        locale,
        tileId: `driver:${driver.id}`,
        tileLabel: label,
      }}
    >
    <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-4 pr-12">
      <div className="flex items-start gap-3">
        <SignalBadge
          signal={driver.signal}
          label={label}
          t={t}
          className="mt-0.5 p-1.5"
        />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">{label}</h4>
          <p className="mt-1 break-words text-sm leading-6 text-zinc-600">
            {description}
          </p>
          <dl className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-500">
                {t.analysis.primaryValue}
              </dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatAnalysisValue(driver.primaryValue, driver.unit)}
              </dd>
            </div>
            {driver.secondaryValue !== undefined && (
              <div>
                <dt className="font-medium text-zinc-500">
                  {t.analysis.secondaryValue}
                </dt>
                <dd className="mt-0.5 font-semibold text-zinc-900">
                  {driver.id === "liquidity"
                    ? compactCurrency(driver.secondaryValue)
                    : formatAnalysisValue(driver.secondaryValue, "currency")}
                </dd>
              </div>
            )}
          </dl>
          {driver.details?.length ? (
            <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
              {driver.details.map((detail) => {
                const detailLabel = recordValue(
                  t.analysis.driverDetailLabels,
                  detail.id,
                  detail.id,
                );
                const detailDescription = recordValue(
                  t.analysis.driverDetailDescriptions,
                  detail.id,
                  detail.id,
                );

                return (
                  <div key={detail.id} className="flex items-start gap-2">
                    <SignalBadge
                      signal={detail.signal}
                      label={detailLabel}
                      t={t}
                      className="mt-0.5 h-6 w-6 rounded-md p-1"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h5 className="text-xs font-semibold text-zinc-950">
                          {detailLabel}
                        </h5>
                        <span className="text-xs font-semibold text-zinc-600">
                          {formatAnalysisValue(detail.value, detail.unit)}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-xs leading-5 text-zinc-500">
                        {detailDescription}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </article>
    </FeedbackTile>
  );
}

function BusinessDriversPanel({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.driversTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.driversSubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={ShieldCheck}
          label={t.analysis.driversTitle}
          tooltip={t.analysis.tooltips.drivers}
          tone="teal"
          tooltipAlign="right"
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.businessDrivers.map((driver) => (
          <BusinessDriverCard
            key={driver.id}
            driver={driver}
            ticker={snapshot.identity.ticker}
            locale={locale}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

function BalanceSheetPanel({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  const analysis = snapshot.balanceSheetAnalysis;
  const values = [
    { label: t.analysis.cash, value: compactCurrency(analysis.cash) },
    { label: t.analysis.debt, value: compactCurrency(analysis.debt) },
    { label: t.analysis.netCash, value: compactCurrency(analysis.netCash) },
    {
      label: t.analysis.workingCapital,
      value: compactCurrency(analysis.workingCapital),
    },
    {
      label: t.analysis.cashToDebt,
      value: formatMetricValue(analysis.cashToDebt, "ratio"),
    },
    {
      label: t.analysis.liabilitiesToAssets,
      value: formatPercent(analysis.liabilitiesToAssets),
    },
    {
      label: t.analysis.debtToEquity,
      value: formatMetricValue(analysis.debtToEquity, "ratio"),
    },
  ];

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.balanceTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.balanceSubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={Database}
          label={t.analysis.balanceTitle}
          tooltip={t.analysis.tooltips.balance}
          tone="sky"
          tooltipAlign="right"
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {values.map((item) => (
          <FeedbackTile
            key={item.label}
            target={{
              ticker: snapshot.identity.ticker,
              locale,
              tileId: `balance:${item.label}`,
              tileLabel: item.label,
            }}
          >
            <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3 pr-12">
              <p className="text-xs font-medium text-zinc-500">{item.label}</p>
              <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
                {item.value}
              </p>
            </article>
          </FeedbackTile>
        ))}
        <FeedbackTile
          target={{
            ticker: snapshot.identity.ticker,
            locale,
            tileId: "balance:final-takeaway",
            tileLabel: t.decision.finalTakeaway,
          }}
        >
          <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3 pr-12">
            <p className="text-xs font-medium text-zinc-500">
              {t.decision.finalTakeaway}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <SignalBadge
                signal={analysis.signal}
                label={t.analysis.balanceTitle}
                t={t}
                className="p-1"
              />
              <span className="text-sm font-semibold capitalize text-zinc-950">
                {analysis.signal}
              </span>
            </div>
          </article>
        </FeedbackTile>
      </div>
    </section>
  );
}

function PeerMetricRow({
  metric,
  t,
}: {
  metric: PeerMetricComparison;
  t: Dictionary;
}) {
  return (
    <tr>
      <td className="py-3 pr-4 font-semibold text-zinc-950">
        <div className="flex items-center gap-2">
          <SignalBadge
            signal={metric.signal}
            label={metric.label}
            t={t}
            className="p-1"
          />
          <span>{metric.label}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-700">
        {formatAnalysisValue(metric.companyValue, metric.unit)}
      </td>
      <td className="px-4 py-3 text-zinc-700">
        {formatAnalysisValue(metric.peerMedian, metric.unit)}
      </td>
    </tr>
  );
}

function PeerComparisonPanel({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const peerComparison = snapshot.peerComparison;

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.peersTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.peersSubtitle}
          </p>
          <p className="mt-2 text-xs font-semibold text-zinc-600">
            {t.analysis.peerCount(peerComparison.peerCount)}
            {peerComparison.sicDescription ? ` · ${peerComparison.sicDescription}` : ""}
          </p>
        </div>
        <MeaningBadge
          Icon={Building2}
          label={t.analysis.peersTitle}
          tooltip={t.analysis.tooltips.peers}
          tone="zinc"
          tooltipAlign="right"
        />
      </div>

      {peerComparison.status === "limited" && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          {t.analysis.limitedPeerCoverage}
        </p>
      )}

      {peerComparison.metrics.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.08em] text-zinc-500">
              <tr>
                <th className="border-b border-zinc-200 py-2 pr-4 font-semibold">
                  {t.analysis.metric}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.company}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.peerMedian}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {peerComparison.metrics.map((metric) => (
                <PeerMetricRow key={metric.id} metric={metric} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          {t.analysis.noPeerMetrics}
        </p>
      )}
    </section>
  );
}

function DataQualityCheckRow({
  check,
  ticker,
  locale,
  t,
}: {
  check: DataQualityCheck;
  ticker: string;
  locale: Locale;
  t: Dictionary;
}) {
  const label = recordValue(t.analysis.checkLabels, check.id, check.label);
  const description = recordValue(
    t.analysis.checkDescriptions,
    check.id,
    check.description,
  );

  return (
    <FeedbackTile
      target={{
        ticker,
        locale,
        tileId: `data-quality:${check.id}`,
        tileLabel: label,
      }}
    >
    <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3 pr-12">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
            check.passed
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {check.passed ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">{label}</h4>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
        </div>
      </div>
    </article>
    </FeedbackTile>
  );
}

function DataQualityPanel({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.dataQualityTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.dataQualitySubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={Database}
          label={t.analysis.dataQualityTitle}
          tooltip={t.analysis.tooltips.dataQuality}
          tone="amber"
          tooltipAlign="right"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <FeedbackTile
          target={{
            ticker: snapshot.identity.ticker,
            locale,
            tileId: "data-quality:score",
            tileLabel: t.analysis.score,
          }}
        >
          <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4 pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {t.analysis.score}
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {snapshot.dataQuality.score}/100
            </p>
            <div className="mt-3 flex items-center gap-2">
              <SignalBadge
                signal={snapshot.dataQuality.signal}
                label={t.analysis.confidence}
                t={t}
                className="p-1"
              />
              <span className="text-sm font-semibold text-zinc-800">
                {t.analysis.confidenceLabels[snapshot.dataQuality.label]}
              </span>
            </div>
          </article>
        </FeedbackTile>
        <div className="grid gap-3 lg:grid-cols-2">
          {snapshot.dataQuality.checks.map((check) => (
            <DataQualityCheckRow
              key={check.id}
              check={check}
              ticker={snapshot.identity.ticker}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricGrid({
  metrics,
  ticker,
  locale,
  t,
}: {
  metrics: FinancialMetric[];
  ticker: string;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.slice(0, 10).map((metric) => {
        const metricCopy = t.metrics[metric.id as keyof typeof t.metrics];

        return (
          <FeedbackTile
            key={metric.id}
            target={{
              ticker,
              locale,
              tileId: `metric:${metric.id}`,
              tileLabel: metricCopy?.label ?? metric.label,
            }}
          >
            <article className="rounded-md border border-zinc-200 bg-white p-4 pr-12">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    {metricCopy?.label ?? metric.label}
                  </p>
                  <p className={`mt-2 text-xl font-semibold ${metricTone(metric)}`}>
                    {formatMetricValue(metric.value, metric.unit)}
                  </p>
                </div>
                <SignalBadge
                  signal={metric.signal}
                  label={metricCopy?.label ?? metric.label}
                  t={t}
                  tooltipAlign="right"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                {metricCopy?.description ?? metric.description}
              </p>
            </article>
          </FeedbackTile>
        );
      })}
    </section>
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    function updateReady() {
      setReady((frameRef.current?.getBoundingClientRect().width ?? 0) > 0);
    }

    updateReady();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateReady);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="mt-5 h-72 min-w-0">
      {ready ? children : null}
    </div>
  );
}

function FinancialCharts({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  const chartRows = useMemo(() => makeChartRows(snapshot), [snapshot]);

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-2">
      <FeedbackTile
        target={{
          ticker: snapshot.identity.ticker,
          locale,
          tileId: "chart:revenue-net-income",
          tileLabel: t.charts.revenueNetIncome,
        }}
      >
      <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-5 pr-12">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">
              {t.charts.revenueNetIncome}
            </h3>
            <p className="text-sm text-zinc-500">
              {t.charts.annualFacts}
            </p>
          </div>
          <MeaningBadge
            Icon={TrendingUp}
            label={t.charts.revenueNetIncome}
            tooltip={t.charts.tooltips.revenueNetIncome}
            tone="teal"
            tooltipAlign="right"
          />
        </div>
        <ChartFrame>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={288}
            initialDimension={{ width: 1, height: 288 }}
          >
            <AreaChart data={chartRows} margin={{ left: 0, right: 12 }}>
              <defs>
                <linearGradient id="revenue" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => compactNumber(Number(value))}
              />
              <Tooltip formatter={(value) => compactCurrency(Number(value))} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0f766e"
                strokeWidth={2}
                fill="url(#revenue)"
                name={t.charts.revenue}
              />
              <Area
                type="monotone"
                dataKey="netIncome"
                stroke="#ea580c"
                strokeWidth={2}
                fill="transparent"
                name={t.charts.netIncome}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      </article>
      </FeedbackTile>

      <FeedbackTile
        target={{
          ticker: snapshot.identity.ticker,
          locale,
          tileId: "chart:cash-flow",
          tileLabel: t.charts.cashBalance,
        }}
      >
      <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-5 pr-12">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">
              {t.charts.cashBalance}
            </h3>
            <p className="text-sm text-zinc-500">
              {t.charts.cashBalanceSubtitle}
            </p>
          </div>
          <MeaningBadge
            Icon={Database}
            label={t.charts.cashBalance}
            tooltip={t.charts.tooltips.cashBalance}
            tone="sky"
            tooltipAlign="right"
          />
        </div>
        <ChartFrame>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={288}
            initialDimension={{ width: 1, height: 288 }}
          >
            <BarChart data={chartRows} margin={{ left: 0, right: 12 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => compactNumber(Number(value))}
              />
              <Tooltip formatter={(value) => compactCurrency(Number(value))} />
              <Bar dataKey="freeCashFlow" fill="#2563eb" name="FCF" radius={3} />
              <Bar dataKey="liabilities" fill="#f59e0b" name={t.charts.liabilities} radius={3} />
              <Bar dataKey="assets" fill="#71717a" name={t.charts.assets} radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </article>
      </FeedbackTile>
    </section>
  );
}

function FinancialTable({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.table.title}
          </h3>
          <p className="text-sm text-zinc-500">
            {t.table.subtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={FileText}
          label={t.table.title}
          tooltip={t.table.tooltip}
          tone="zinc"
          tooltipAlign="right"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.08em] text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">{t.table.fy}</th>
              <th className="px-5 py-3 font-semibold">{t.table.revenue}</th>
              <th className="px-5 py-3 font-semibold">{t.table.grossMargin}</th>
              <th className="px-5 py-3 font-semibold">{t.table.operatingMargin}</th>
              <th className="px-5 py-3 font-semibold">{t.table.netIncome}</th>
              <th className="px-5 py-3 font-semibold">{t.table.fcf}</th>
              <th className="px-5 py-3 font-semibold">{t.table.debt}</th>
              <th className="px-5 py-3 font-semibold">{t.table.eps}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {snapshot.periods.map((period) => (
              <tr key={period.fiscalYear}>
                <td className="px-5 py-3 font-semibold text-zinc-950">
                  {period.fiscalYear}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.revenue)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {formatPercent(
                    period.grossProfit && period.revenue
                      ? period.grossProfit / period.revenue
                      : null,
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {formatPercent(
                    period.operatingIncome && period.revenue
                      ? period.operatingIncome / period.revenue
                      : null,
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.netIncome)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.freeCashFlow)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.debt)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {period.epsDiluted ? `$${period.epsDiluted.toFixed(2)}` : "n/a"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MemoPanel({
  snapshot,
  memo,
  memoState,
  adminMemoState,
  error,
  adminError,
  onGenerate,
  onPublishPublic,
  viewer,
  locale,
  t,
}: {
  snapshot: CompanySnapshot | null;
  memo: ResearchMemo | null;
  memoState: MemoState;
  adminMemoState: MemoState;
  error: string | null;
  adminError: string | null;
  onGenerate: () => void;
  onPublishPublic: () => void;
  viewer: Viewer | null;
  locale: Locale;
  t: Dictionary;
}) {
  const signedIn = Boolean(viewer);
  const isAdmin = Boolean(viewer?.isAdmin);
  const title = signedIn ? t.memo.privateTitle : t.memo.publicTitle;
  const subtitle = signedIn ? t.memo.privateSubtitle : t.memo.publicSubtitle;
  const generateLabel = signedIn ? t.memo.generatePrivate : t.memo.generatePublic;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <MeaningPill
            Icon={Sparkles}
            label={t.memo.badge}
            tooltip={t.memo.badgeTooltip}
            tone="teal"
          />
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {title}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            disabled={!snapshot || memoState === "loading"}
            onClick={onGenerate}
            data-activity="memo.generate"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {memoState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {generateLabel}
          </button>
          {!signedIn && (
            <div className="w-full min-w-0 sm:w-72">
              <MagicLinkForm
                t={t}
                locale={locale}
                ticker={snapshot?.identity.ticker}
                compact
              />
            </div>
          )}
          {isAdmin && (
            <button
              type="button"
              disabled={!snapshot || adminMemoState === "loading"}
              onClick={onPublishPublic}
              data-activity="admin.memo.publish_public"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:border-amber-500 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {adminMemoState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t.memo.publishPublic}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {isAdmin && (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {t.memo.adminPublishHint}
        </p>
      )}
      {adminError && (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {adminError}
        </p>
      )}

      {memo ? (
        <div className="mt-5 space-y-3">
          {memo.mode === "fallback" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t.memo.fallbackNotice}
            </div>
          )}
          {memo.sections.map((section) => (
            <article
              key={section.title}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex items-start gap-3">
                <SignalBadge
                  signal={section.signal ?? "neutral"}
                  label={section.title}
                  t={t}
                  className="mt-0.5 p-1.5"
                />
                <div>
                  <h4 className="font-semibold text-zinc-950">{section.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-zinc-700">
                    {section.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
          <p className="text-xs leading-5 text-zinc-500">{memo.disclaimer}</p>
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
          {t.memo.empty}
        </div>
      )}
    </section>
  );
}

function ValuationMetricRow({
  metric,
  ticker,
  locale,
  t,
  isFavorite,
  onToggleFavorite,
}: {
  metric: ValuationMetric;
  ticker: string;
  locale: Locale;
  t: Dictionary;
  isFavorite: boolean;
  onToggleFavorite: (metric: ValuationMetric) => void;
}) {
  const sourceBadge = t.waitlist.valuationMetricSourceBadges[metric.source];
  const sourceLabel = t.waitlist.valuationMetricSourceLabels[metric.source];

  return (
    <FeedbackTile
      target={{
        ticker,
        locale,
        tileId: `valuation-metric:${metric.source}:${metric.id}`,
        tileLabel: metric.label,
      }}
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 px-3 py-2.5 pr-12">
        <button
          type="button"
          onClick={() => onToggleFavorite(metric)}
          aria-pressed={isFavorite}
          aria-label={
            isFavorite
              ? `${t.waitlist.valuationMetricUnfavorite}: ${metric.label}`
              : `${t.waitlist.valuationMetricFavorite}: ${metric.label}`
          }
          title={
            isFavorite
              ? t.waitlist.valuationMetricUnfavorite
              : t.waitlist.valuationMetricFavorite
          }
          data-activity="valuation.metric.favorite_toggle"
          data-activity-metric-id={metric.id}
          data-activity-metric-source={metric.source}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
            isFavorite
              ? "border-amber-300 bg-amber-50 text-amber-600"
              : "border-zinc-200 bg-white text-zinc-400 hover:border-amber-300 hover:text-amber-600"
          }`}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div className="min-w-0 pt-0.5">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="min-w-0 break-words text-sm font-medium leading-5 text-zinc-900">
              {metric.label}
            </p>
            <p className="min-w-0 break-words text-sm font-semibold leading-5 text-zinc-950 tabular-nums">
              {formatMetricValue(metric.value, metric.unit)}
            </p>
          </div>
          <span
            className="mt-1 inline-flex rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-normal text-zinc-500"
            title={sourceLabel}
          >
            {sourceBadge}
          </span>
        </div>
      </div>
    </FeedbackTile>
  );
}

function ValuationSummaryTile({
  ticker,
  locale,
  tileId,
  label,
  value,
}: {
  ticker: string;
  locale: Locale;
  tileId: string;
  label: string;
  value: string;
}) {
  return (
    <FeedbackTile
      target={{
        ticker,
        locale,
        tileId,
        tileLabel: label,
      }}
    >
      <div className="rounded-md border border-zinc-200 bg-white p-2 pr-12">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="font-semibold text-zinc-900">
          {value}
        </p>
      </div>
    </FeedbackTile>
  );
}

function ValuationMetricsPanel({
  ticker,
  locale,
  valuation,
  t,
  favoriteValuationMetricCount,
  valuationMetricQuery,
  setValuationMetricQuery,
  displayedValuationMetrics,
  favoriteValuationMetricKeys,
  toggleFavoriteValuationMetric,
  normalizedValuationMetricQuery,
  showAllValuationMetrics,
  hiddenValuationMetricCount,
  setShowAllValuationMetrics,
}: {
  ticker: string;
  locale: Locale;
  valuation: ValuationSnapshot;
  t: Dictionary;
  favoriteValuationMetricCount: number;
  valuationMetricQuery: string;
  setValuationMetricQuery: (value: string) => void;
  displayedValuationMetrics: ValuationMetric[];
  favoriteValuationMetricKeys: Set<string>;
  toggleFavoriteValuationMetric: (metric: ValuationMetric) => void;
  normalizedValuationMetricQuery: string;
  showAllValuationMetrics: boolean;
  hiddenValuationMetricCount: number;
  setShowAllValuationMetrics: (updater: (current: boolean) => boolean) => void;
}) {
  return (
    <FeedbackTile
      target={{
        ticker,
        locale,
        tileId: "valuation:all-metrics",
        tileLabel: t.waitlist.valuationMetricsTitle,
      }}
    >
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 pr-12">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {t.waitlist.valuationMetricsTitle}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {t.waitlist.valuationMetricsSubtitle}
            </p>
          </div>
          {favoriteValuationMetricCount > 0 && (
            <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              {favoriteValuationMetricCount}{" "}
              {t.waitlist.valuationMetricsFavoritesCount}
            </span>
          )}
        </div>
        <div className="mt-3">
          <label className="sr-only" htmlFor="valuation-metric-search">
            {t.waitlist.valuationMetricsSearchPlaceholder}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              id="valuation-metric-search"
              type="search"
              value={valuationMetricQuery}
              onChange={(event) => setValuationMetricQuery(event.target.value)}
              placeholder={t.waitlist.valuationMetricsSearchPlaceholder}
              className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400"
            />
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="max-h-96 divide-y divide-zinc-100 overflow-auto">
            {displayedValuationMetrics.length ? (
              displayedValuationMetrics.map((metric) => (
                <ValuationMetricRow
                  key={`${metric.source}:${metric.id}`}
                  metric={metric}
                  ticker={ticker}
                  locale={locale}
                  t={t}
                  isFavorite={favoriteValuationMetricKeys.has(
                    valuationMetricKey(metric),
                  )}
                  onToggleFavorite={toggleFavoriteValuationMetric}
                />
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-zinc-500">
                {t.waitlist.valuationMetricsEmpty}
              </p>
            )}
          </div>
        </div>
        {!normalizedValuationMetricQuery &&
          valuation.metrics.length > VALUATION_METRICS_PREVIEW_LIMIT && (
            <button
              type="button"
              onClick={() =>
                setShowAllValuationMetrics((current) => !current)
              }
              className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
            >
              {showAllValuationMetrics
                ? t.waitlist.valuationMetricsShowLess
                : `${t.waitlist.valuationMetricsShowAll} (${hiddenValuationMetricCount})`}
            </button>
          )}
      </div>
    </FeedbackTile>
  );
}

function valuationMetricKey(metric: ValuationMetric): string {
  return `${metric.source}:${metric.id}`;
}

function WaitlistPanel({
  snapshot,
  memo,
  locale,
  viewer,
  t,
}: {
  snapshot: CompanySnapshot | null;
  memo: ResearchMemo | null;
  locale: Locale;
  viewer: Viewer | null;
  t: Dictionary;
}) {
  const [email, setEmail] = useState("");
  const [investorProfile, setInvestorProfile] = useState(t.waitlist.profiles[0]);
  const [interestArea, setInterestArea] = useState(t.waitlist.interests[0]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [saveState, setSaveState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedResearch, setSavedResearch] = useState<WorkspaceSavedResearch[]>([]);
  const [savedResearchState, setSavedResearchState] = useState<WorkspacePanelState>(
    "idle",
  );
  const [savedResearchMessage, setSavedResearchMessage] = useState<string | null>(
    null,
  );
  const [watchlists, setWatchlists] = useState<WorkspaceWatchlist[]>([]);
  const [watchlistId, setWatchlistId] = useState<string | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<WorkspaceWatchlistItem[]>([]);
  const [watchlistState, setWatchlistState] = useState<WorkspacePanelState>("idle");
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const [alertsState, setAlertsState] = useState<WorkspacePanelState>("idle");
  const [alertsMessage, setAlertsMessage] = useState<string | null>(null);
  const [valuation, setValuation] = useState<WorkspaceValuation>(null);
  const [valuationState, setValuationState] = useState<WorkspacePanelState>("idle");
  const [valuationMessage, setValuationMessage] = useState<string | null>(null);
  const [valuationMetricQuery, setValuationMetricQuery] = useState("");
  const [showAllValuationMetrics, setShowAllValuationMetrics] = useState(false);
  const [favoriteValuationMetricKeys, setFavoriteValuationMetricKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [exportState, setExportState] = useState<WorkspacePanelState>("idle");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<AlertTypeOption>(ALERT_TYPES[0]);
  const [alertCondition, setAlertCondition] = useState<AlertConditionOption>(
    ALERT_CONDITIONS[0],
  );
  const [alertThreshold, setAlertThreshold] = useState("0");
  const [alertNotes, setAlertNotes] = useState("");
  const valuationMetrics = useMemo(() => valuation?.metrics ?? [], [valuation?.metrics]);
  const normalizedValuationMetricQuery = valuationMetricQuery.trim().toLowerCase();
  const filteredValuationMetrics = useMemo(() => {
    if (!normalizedValuationMetricQuery) {
      return valuationMetrics;
    }

    return valuationMetrics.filter((metric) => {
      const sourceLabel =
        t.waitlist.valuationMetricSourceLabels[metric.source].toLowerCase();
      return [
        metric.label,
        metric.id,
        metric.source,
        sourceLabel,
        formatMetricValue(metric.value, metric.unit),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedValuationMetricQuery);
    });
  }, [normalizedValuationMetricQuery, t, valuationMetrics]);
  const valuationFavoritesStorageKey =
    viewer && snapshot
      ? `${VALUATION_FAVORITES_STORAGE_PREFIX}:${viewer.id}:${snapshot.identity.ticker}`
      : null;
  const orderedFilteredValuationMetrics = useMemo(() => {
    if (!favoriteValuationMetricKeys.size) {
      return filteredValuationMetrics;
    }

    const favorites: ValuationMetric[] = [];
    const rest: ValuationMetric[] = [];
    for (const metric of filteredValuationMetrics) {
      if (favoriteValuationMetricKeys.has(valuationMetricKey(metric))) {
        favorites.push(metric);
      } else {
        rest.push(metric);
      }
    }
    return [...favorites, ...rest];
  }, [favoriteValuationMetricKeys, filteredValuationMetrics]);
  const displayedValuationMetrics =
    normalizedValuationMetricQuery || showAllValuationMetrics
      ? orderedFilteredValuationMetrics
      : orderedFilteredValuationMetrics.slice(0, VALUATION_METRICS_PREVIEW_LIMIT);
  const hiddenValuationMetricCount =
    orderedFilteredValuationMetrics.length - displayedValuationMetrics.length;
  const favoriteValuationMetricCount = valuationMetrics.filter((metric) =>
    favoriteValuationMetricKeys.has(valuationMetricKey(metric)),
  ).length;

  useEffect(() => {
    if (!valuationFavoritesStorageKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFavoriteValuationMetricKeys(new Set());
      return;
    }

    try {
      const raw = window.localStorage.getItem(valuationFavoritesStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const keys = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
      setFavoriteValuationMetricKeys(new Set(keys));
    } catch {
      setFavoriteValuationMetricKeys(new Set());
    }
  }, [valuationFavoritesStorageKey]);

  const toggleFavoriteValuationMetric = useCallback(
    (metric: ValuationMetric) => {
      const key = valuationMetricKey(metric);
      setFavoriteValuationMetricKeys((current) => {
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        if (valuationFavoritesStorageKey) {
          try {
            window.localStorage.setItem(
              valuationFavoritesStorageKey,
              JSON.stringify([...next]),
            );
          } catch {
            // Preference persistence should never block research usage.
          }
        }

        return next;
      });
    },
    [valuationFavoritesStorageKey],
  );

  const loadSavedResearch = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    setSavedResearchState("loading");
    setSavedResearchMessage(null);

    try {
      const response = await fetch("/api/research/saved");
      const payload = (await response.json().catch(() => ({}))) as {
        saved?: WorkspaceSavedResearch[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || t.waitlist.loadSavedResearchFailed);
      }

      const filtered = (payload.saved ?? []).filter(
        (item) => item.ticker === snapshot.identity.ticker,
      );
      setSavedResearch(filtered);
      setSavedResearchState("ready");
    } catch {
      setSavedResearchState("error");
      setSavedResearchMessage(t.waitlist.loadSavedResearchFailed);
    }
  }, [snapshot, t.waitlist.loadSavedResearchFailed]);

  const loadWatchlistItems = useCallback(async (watchlistId: string) => {
    const response = await fetch(
      `/api/watchlists/${encodeURIComponent(watchlistId)}/items`,
    );
    const payload = (await response.json().catch(() => ({}))) as {
      items?: WorkspaceWatchlistItem[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || t.waitlist.watchlistLoadFailed);
    }

    return payload.items ?? [];
  }, [t.waitlist.watchlistLoadFailed]);

  const loadWatchlistsAndItems = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    setWatchlistState("loading");
    setWatchlistMessage(null);

    try {
      const response = await fetch("/api/watchlists");
      const payload = (await response.json().catch(() => ({}))) as {
        watchlists?: WorkspaceWatchlist[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || t.waitlist.watchlistLoadFailed);
      }

      const items = payload.watchlists ?? [];
      setWatchlists(items);
      const activeWatchlist =
        items.find((item) => item.isDefault) ?? items[0] ?? null;
      setWatchlistId(activeWatchlist?.id ?? null);

      if (!activeWatchlist) {
        setWatchlistItems([]);
        setWatchlistState("ready");
        return;
      }

      setWatchlistState("ready");
    } catch {
      setWatchlistState("error");
      setWatchlistMessage(t.waitlist.watchlistLoadFailed);
      setWatchlistItems([]);
    }
  }, [snapshot, t.waitlist.watchlistLoadFailed]);

  const loadAlerts = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    setAlertsState("loading");
    setAlertsMessage(null);

    try {
      const response = await fetch("/api/alerts");
      const payload = (await response.json().catch(() => ({}))) as {
        alerts?: WorkspaceAlert[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || t.waitlist.alertLoadFailed);
      }

      const currentTickerAlerts = (payload.alerts ?? []).filter(
        (alert) => alert.ticker === snapshot.identity.ticker,
      );
      setAlerts(currentTickerAlerts);
      setAlertsState("ready");
    } catch {
      setAlertsState("error");
      setAlertsMessage(t.waitlist.alertLoadFailed);
    }
  }, [snapshot, t.waitlist.alertLoadFailed]);

  const loadValuation = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    setValuationState("loading");
    setValuationMessage(null);
    setValuationMetricQuery("");
    setShowAllValuationMetrics(false);

    try {
      const response = await fetch(
        `/api/valuation/${encodeURIComponent(snapshot.identity.ticker)}`,
      );
      const payload = (await response.json().catch(() => ({}))) as {
        valuation?: WorkspaceValuation;
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(t.waitlist.valuationNotConfigured);
        }
        throw new Error(payload.error || t.waitlist.valuationUnavailable);
      }

      setValuation(payload.valuation ?? null);
      setValuationState("ready");
    } catch (error) {
      setValuationState("error");
      setValuation(null);
      setValuationMessage(
        error instanceof Error
          ? error.message
          : t.waitlist.valuationUnavailable,
      );
    }
  }, [
    snapshot,
    t.waitlist.valuationNotConfigured,
    t.waitlist.valuationUnavailable,
  ]);

  const loadWorkspaceData = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    if (!viewer) {
      setSavedResearch([]);
      setAlerts([]);
      setWatchlists([]);
      setWatchlistId(null);
      setWatchlistItems([]);
      setSavedResearchState("idle");
      setAlertsState("idle");
      setWatchlistState("idle");
      setValuationState("idle");
      return;
    }

    await Promise.all([loadSavedResearch(), loadWatchlistsAndItems(), loadAlerts()]);
    void loadValuation();
  }, [
    loadAlerts,
    loadSavedResearch,
    loadValuation,
    loadWatchlistsAndItems,
    snapshot,
    viewer,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    if (!snapshot || !viewer || !watchlistId) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWatchlistState("loading");
    setWatchlistMessage(null);

    const run = async () => {
      try {
        const items = await loadWatchlistItems(watchlistId);
        setWatchlistItems(items);
        setWatchlistState("ready");
      } catch {
        setWatchlistState("error");
        setWatchlistMessage(t.waitlist.watchlistLoadFailed);
        setWatchlistItems([]);
      }
    };

    void run();
  }, [
    loadWatchlistItems,
    snapshot,
    t.waitlist.watchlistLoadFailed,
    viewer,
    watchlistId,
  ]);

  useEffect(() => {
    if (snapshot && valuationState === "idle") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadValuation();
    }
  }, [loadValuation, snapshot, valuationState]);

  async function saveResearch() {
    if (!snapshot) {
      return;
    }

    setSaveState("loading");
    setSaveMessage(null);

    try {
      const response = await fetch("/api/research/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: snapshot.identity.ticker,
          includeMemo: Boolean(memo),
          locale,
          title: `${snapshot.identity.ticker} research - ${new Date().toISOString().slice(0, 10)}`,
        }),
      });

      if (response.status === 401) {
        setSaveState("error");
        setSaveMessage(t.waitlist.signInToSave);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to save research");
      }

      setSaveState("ready");
      setSaveMessage(t.waitlist.saved);
      await loadSavedResearch();
    } catch {
      setSaveState("error");
      setSaveMessage(t.waitlist.saveFailed);
    }
  }

  async function addToWatchlist() {
    if (!snapshot || !watchlistId) {
      return;
    }

    setWatchlistState("loading");
    setWatchlistMessage(null);

    try {
      const response = await fetch(
        `/api/watchlists/${encodeURIComponent(watchlistId)}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: snapshot.identity.ticker,
          }),
        },
      );

      if (response.status === 401) {
        setWatchlistState("error");
        setWatchlistMessage(t.waitlist.signInToUse);
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        item?: WorkspaceWatchlistItem;
        error?: string;
      };

      if (!response.ok || !payload.item) {
        throw new Error(payload.error || t.waitlist.watchlistAddFailed);
      }

      setWatchlistMessage(
        response.status === 201
          ? t.waitlist.watchlistAdded
          : t.waitlist.watchlistDuplicate,
      );
      const addedItem = payload.item;
      if (!addedItem) {
        throw new Error(payload.error || t.waitlist.watchlistAddFailed);
      }

      setWatchlistItems((current) => {
        const exists = current.some((row) => row.id === addedItem.id);
        if (exists) {
          return current;
        }

        return [addedItem, ...current];
      });
      setWatchlistState("ready");
    } catch {
      setWatchlistState("error");
      setWatchlistMessage(t.waitlist.watchlistAddFailed);
    }
  }

  async function createOrUpdateAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) {
      return;
    }

    const threshold = Number(alertThreshold);
    if (!Number.isFinite(threshold)) {
      setAlertsMessage(t.waitlist.alertLoadFailed);
      return;
    }

    setAlertsState("loading");
    setAlertsMessage(null);

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: snapshot.identity.ticker,
          alertType,
          threshold,
          condition: alertCondition,
          enabled: true,
          notes: alertNotes.trim() || undefined,
        }),
      });

      if (response.status === 401) {
        setAlertsState("error");
        setAlertsMessage(t.waitlist.alertToggleDisabled);
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        alert?: WorkspaceAlert;
        error?: string;
      };

      if (!response.ok || !payload.alert) {
        throw new Error(payload.error || t.waitlist.alertLoadFailed);
      }

      const alert = payload.alert;
      if (!alert) {
        throw new Error(payload.error || t.waitlist.alertLoadFailed);
      }

      setAlerts((current) => {
        const rest = current.filter((row) => row.id !== alert.id);
        return [alert, ...rest].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      });

      setAlertsMessage(
        response.status === 201
          ? t.waitlist.alertSaved
          : t.waitlist.alertUpdated,
      );
      setAlertsState("ready");
    } catch {
      setAlertsState("error");
      setAlertsMessage(t.waitlist.alertLoadFailed);
    }
  }

  async function toggleAlert(alert: WorkspaceAlert) {
    if (!snapshot) {
      return;
    }

    setAlertsState("loading");
    setAlertsMessage(null);

    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(alert.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !alert.enabled }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        alert?: WorkspaceAlert;
        error?: string;
      };

      if (!response.ok || !payload.alert) {
        throw new Error(payload.error || t.waitlist.alertLoadFailed);
      }

      setAlerts((current) =>
        current.map((row) =>
          row.id === payload.alert?.id
            ? {
                ...row,
                enabled: payload.alert.enabled,
              }
            : row,
        ),
      );
      setAlertsState("ready");
    } catch {
      setAlertsState("error");
      setAlertsMessage(t.waitlist.alertLoadFailed);
    }
  }

  async function exportWorkspace(scope: "memo" | "snapshot", format: "json" | "csv") {
    if (!snapshot || !viewer) {
      return;
    }

    if (scope === "memo" && !memo) {
      setExportMessage(t.waitlist.exportMemoUnavailable);
      setExportState("error");
      return;
    }

    setExportState("loading");
    setExportMessage(null);

    try {
      const response = await fetch(
        `/api/workspace/export?scope=${encodeURIComponent(scope)}&ticker=${encodeURIComponent(snapshot.identity.ticker)}&locale=${locale}&format=${format}`,
      );
      if (!response.ok) {
        throw new Error(t.waitlist.exportFailed);
      }

      if (format === "csv") {
        const csv = await response.text();
        buildDownload(
          `finari-${snapshot.identity.ticker.toUpperCase()}-${scope}-export.csv`,
          csv,
          "text/csv; charset=utf-8",
        );
      } else {
        const body = (await response.json()) as {
          payload?: {
            scope: string;
            [key: string]: unknown;
          };
        };
        const payloadText = JSON.stringify(body.payload ?? body, null, 2);
        buildDownload(
          `finari-${snapshot.identity.ticker.toUpperCase()}-${scope}-export.json`,
          payloadText,
          "application/json",
        );
      }

      setExportState("ready");
      setExportMessage(t.waitlist.exportSaved);
    } catch {
      setExportState("error");
      setExportMessage(t.waitlist.exportFailed);
    }
  }

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          investorProfile,
          interestArea,
          sourceTicker: snapshot?.identity.ticker,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save waitlist lead");
      }

      setStatus("ready");
      setMessage(t.waitlist.joined);
      setEmail("");
    } catch {
      setStatus("error");
      setMessage(t.waitlist.joinFailed);
    }
  }

  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <MeaningPill
          Icon={Bookmark}
          label={t.waitlist.workspaceBadge}
          tooltip={t.waitlist.workspaceTooltip}
          tone="sky"
        />
        <h3 className="mt-3 text-base font-semibold text-zinc-950">
          {t.waitlist.saveResearchTitle}
        </h3>
        <div className="mt-4 grid gap-2">
          {!viewer && (
            <MagicLinkForm
              t={t}
              locale={locale}
              ticker={snapshot?.identity.ticker}
              compact
            />
          )}
          <button
            type="button"
            disabled={!viewer || !snapshot || saveState === "loading"}
            onClick={() => void saveResearch()}
            data-activity="workspace.save_research"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {saveState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
            {t.waitlist.saveResearch}
          </button>
        </div>
        {saveMessage && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              saveState === "error"
                ? "bg-amber-50 text-amber-900"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {saveMessage}
          </p>
        )}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <MeaningPill
          Icon={LockKeyhole}
          label={t.waitlist.earlyAccessBadge}
          tooltip={t.waitlist.earlyAccessTooltip}
        />
        <h3 className="mt-3 text-base font-semibold text-zinc-950">
          {t.waitlist.earlyAccessTitle}
        </h3>
        <form onSubmit={submitWaitlist} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.waitlist.emailPlaceholder}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <select
            value={investorProfile}
            onChange={(event) => setInvestorProfile(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          >
            {t.waitlist.profiles.map((profile) => (
              <option key={profile}>{profile}</option>
            ))}
          </select>
          <select
            value={interestArea}
            onChange={(event) => setInterestArea(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          >
            {t.waitlist.interests.map((interest) => (
              <option key={interest}>{interest}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {t.waitlist.join}
          </button>
        </form>
        {message && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              status === "error"
                ? "bg-rose-50 text-rose-800"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {message}
          </p>
        )}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.waitlist.toolsTitle}
          </h3>
          <MeaningBadge
            Icon={Bell}
            label={t.waitlist.toolsTitle}
            tooltip={t.waitlist.toolsTooltip}
            tone="amber"
            tooltipAlign="right"
          />
        </div>
        <div className="mt-4 space-y-3">
          <article className="min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <h4 className="text-sm font-semibold text-zinc-900">
              {t.waitlist.savedWorkspaceTitle}
            </h4>
            <p className="mt-1 text-xs text-zinc-600">{t.waitlist.savedWorkspaceSubtitle}</p>

            {viewer ? (
              <>
                <button
                  type="button"
                  onClick={() => void loadSavedResearch()}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800"
                >
                  {t.waitlist.viewSavedWorkspace}
                </button>
                <div className="mt-3 max-h-44 overflow-auto space-y-2">
                  {savedResearchState === "loading" ? (
                    <p className="flex items-center gap-2 text-sm text-zinc-600">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading saved research
                    </p>
                  ) : savedResearch.length ? (
                    savedResearch.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-md border border-zinc-200 bg-white p-2 text-sm"
                      >
                        <p className="font-medium text-zinc-900">{entry.title}</p>
                        <p className="text-xs text-zinc-500">
                          {entry.ticker} · {entry.companyName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">
                      {t.waitlist.savedResearchEmpty}
                    </p>
                  )}
                </div>
                {savedResearchMessage && (
                  <p
                    className={`mt-3 rounded-md px-3 py-2 text-sm ${
                      savedResearchState === "error"
                        ? "bg-rose-50 text-rose-800"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {savedResearchMessage}
                  </p>
                )}
              </>
            ) : (
              <MagicLinkForm
                t={t}
                locale={locale}
                ticker={snapshot?.identity.ticker}
                compact
              />
            )}
          </article>

          <article className="min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <h4 className="text-sm font-semibold text-zinc-900">
              {t.waitlist.watchlistTitle}
            </h4>
            <p className="mt-1 text-xs text-zinc-600">{t.waitlist.watchlistAddTitle}</p>

            {viewer ? (
              <>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">
                    {t.waitlist.watchlistListTitle}
                  </label>
                  <select
                    value={watchlistId ?? ""}
                    onChange={(event) => setWatchlistId(event.target.value || null)}
                    className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                  >
                    {watchlists.length ? (
                      watchlists.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))
                    ) : (
                      <option value="">{t.waitlist.watchlistEmpty}</option>
                    )}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!watchlistId || watchlistState === "loading"}
                  onClick={() => void addToWatchlist()}
                  data-activity="workspace.watchlist.add"
                  className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white disabled:bg-zinc-300"
                >
                  {watchlistState === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Database className="h-4 w-4" aria-hidden="true" />
                  )}
                  {watchlistState === "ready"
                    ? t.waitlist.watchlistListTitle
                    : t.waitlist.watchlistAddTitle}
                </button>

                <div className="mt-3 max-h-44 overflow-auto space-y-2">
                  {watchlistState === "loading" ? (
                    <p className="flex items-center gap-2 text-sm text-zinc-600">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading watchlist
                    </p>
                  ) : watchlistItems.length ? (
                    watchlistItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-md border border-zinc-200 bg-white p-2 text-sm"
                      >
                        <p className="font-medium text-zinc-900">
                          {item.company.ticker}
                        </p>
                        <p className="text-xs text-zinc-500">{item.company.name}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">{t.waitlist.watchlistEmpty}</p>
                  )}
                </div>

                {watchlistMessage && (
                  <p
                    className={`mt-3 rounded-md px-3 py-2 text-sm ${
                      watchlistState === "error"
                        ? "bg-rose-50 text-rose-800"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {watchlistMessage}
                  </p>
                )}
              </>
            ) : (
              <MagicLinkForm
                t={t}
                locale={locale}
                ticker={snapshot?.identity.ticker}
                compact
              />
            )}
          </article>

          <article className="min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <h4 className="text-sm font-semibold text-zinc-900">
              {t.waitlist.alertTitle}
            </h4>
            <p className="mt-1 text-xs text-zinc-600">{t.waitlist.alertSubtitle}</p>

            {viewer ? (
              <>
                <form
                  onSubmit={createOrUpdateAlert}
                  data-activity="workspace.alert.save"
                  className="mt-3 grid gap-2"
                >
                  <div className="grid gap-1">
                    <label className="text-xs font-semibold text-zinc-600">
                      {t.waitlist.alertTypeLabel}
                    </label>
                    <select
                      value={alertType}
                      onChange={(event) => setAlertType(event.target.value as typeof ALERT_TYPES[number])}
                      className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                    >
                      {ALERT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {alertTypeLabel(t, type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-semibold text-zinc-600">
                      {t.waitlist.alertConditionLabel}
                    </label>
                    <select
                      value={alertCondition}
                      onChange={(event) => setAlertCondition(event.target.value as typeof ALERT_CONDITIONS[number])}
                      className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                    >
                      {ALERT_CONDITIONS.map((condition) => (
                        <option key={condition} value={condition}>
                          {alertConditionLabel(t, condition)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-semibold text-zinc-600">
                      {t.waitlist.alertThresholdLabel}
                    </label>
                    <input
                      type="text"
                      value={alertThreshold}
                      onChange={(event) => setAlertThreshold(event.target.value)}
                      className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-semibold text-zinc-600">
                      {t.waitlist.alertNotesLabel}
                    </label>
                    <textarea
                      value={alertNotes}
                      onChange={(event) => setAlertNotes(event.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={alertsState === "loading"}
                    className="mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-sky-700 px-3 text-sm font-medium text-white disabled:bg-zinc-300"
                  >
                    {alertsState === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Bell className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t.waitlist.alertCreate}
                  </button>
                </form>

                <div className="mt-3 max-h-44 space-y-2 overflow-auto">
                  {alertsState === "loading" && !alerts.length ? (
                    <p className="flex items-center gap-2 text-sm text-zinc-600">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading alerts
                    </p>
                  ) : alerts.length ? (
                    alerts.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-md border border-zinc-200 bg-white p-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-zinc-900">
                              {alertTypeLabel(t, item.alertType)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {item.ticker} · {alertConditionLabel(t, item.config.condition)}{" "}
                              {item.config.threshold}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleAlert(item)}
                            data-activity="workspace.alert.toggle"
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800"
                          >
                            {item.enabled
                              ? t.waitlist.alertDisable
                              : t.waitlist.alertEnable}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">{t.waitlist.alertLoadFailed}</p>
                  )}
                </div>

                {alertsMessage && (
                  <p
                    className={`mt-3 rounded-md px-3 py-2 text-sm ${
                      alertsState === "error"
                        ? "bg-rose-50 text-rose-800"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {alertsMessage}
                  </p>
                )}
              </>
            ) : (
              <MagicLinkForm
                t={t}
                locale={locale}
                ticker={snapshot?.identity.ticker}
                compact
              />
            )}
          </article>

          <article className="min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <h4 className="text-sm font-semibold text-zinc-900">
              {t.waitlist.valuationTitle}
            </h4>
            <p className="mt-1 text-xs text-zinc-600">{t.waitlist.valuationDisclaimer}</p>

            {valuationState === "loading" && (
              <p className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t.waitlist.valuationLoading}
              </p>
            )}

            {valuationState === "error" && (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {valuationMessage}
              </p>
            )}

            {snapshot && valuation && valuationState === "ready" && (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-zinc-500">
                  {t.waitlist.valuationAsOf}: {formatLocaleDate(valuation.asOf, locale)}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ValuationSummaryTile
                    ticker={snapshot.identity.ticker}
                    locale={locale}
                    tileId="valuation:market-cap"
                    label="Market cap"
                    value={formatValuationMetric(valuation.marketCap, "—")}
                  />
                  <ValuationSummaryTile
                    ticker={snapshot.identity.ticker}
                    locale={locale}
                    tileId="valuation:pe"
                    label="P/E"
                    value={formatValuationMetric(valuation.priceToEarnings, "—", {
                      compact: true,
                    })}
                  />
                  <ValuationSummaryTile
                    ticker={snapshot.identity.ticker}
                    locale={locale}
                    tileId="valuation:pb"
                    label="P/B"
                    value={formatValuationMetric(valuation.priceToBook, "—", {
                      compact: true,
                    })}
                  />
                  <ValuationSummaryTile
                    ticker={snapshot.identity.ticker}
                    locale={locale}
                    tileId="valuation:ev-ebitda"
                    label="EV/EBITDA"
                    value={formatValuationMetric(valuation.enterpriseValueToEbitda, "—", {
                      compact: true,
                    })}
                  />
                  <ValuationSummaryTile
                    ticker={snapshot.identity.ticker}
                    locale={locale}
                    tileId="valuation:debt-equity"
                    label="Debt/Equity"
                    value={formatValuationMetric(valuation.debtToEquity, "—", {
                      compact: true,
                    })}
                  />
                  <ValuationSummaryTile
                    ticker={snapshot.identity.ticker}
                    locale={locale}
                    tileId="valuation:roe"
                    label="ROE"
                    value={
                      valuation.returnOnEquity === null
                        ? "—"
                        : formatPercent(valuation.returnOnEquity / 100)
                    }
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  {t.waitlist.valuationSourceLabel}: {valuation.source}
                </p>
                {valuation.metrics.length > 0 && (
                  <ValuationMetricsPanel
                    ticker={snapshot.identity.ticker}
                    locale={locale}
                    valuation={valuation}
                    t={t}
                    favoriteValuationMetricCount={favoriteValuationMetricCount}
                    valuationMetricQuery={valuationMetricQuery}
                    setValuationMetricQuery={setValuationMetricQuery}
                    displayedValuationMetrics={displayedValuationMetrics}
                    favoriteValuationMetricKeys={favoriteValuationMetricKeys}
                    toggleFavoriteValuationMetric={toggleFavoriteValuationMetric}
                    normalizedValuationMetricQuery={normalizedValuationMetricQuery}
                    showAllValuationMetrics={showAllValuationMetrics}
                    hiddenValuationMetricCount={hiddenValuationMetricCount}
                    setShowAllValuationMetrics={setShowAllValuationMetrics}
                  />
                )}
              </div>
            )}
          </article>

          <article className="min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <h4 className="text-sm font-semibold text-zinc-900">
              {t.waitlist.exportTitle}
            </h4>
            <p className="mt-1 text-xs text-zinc-600">{t.waitlist.exportSubtitle}</p>

            {viewer ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void exportWorkspace("memo", "json")}
                    disabled={exportState === "loading" || !memo}
                    data-activity="workspace.export.memo_json"
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-sky-700 px-3 text-sm font-medium text-white disabled:bg-zinc-300"
                  >
                    {exportState === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t.waitlist.exportJson} (memo)
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportWorkspace("memo", "csv")}
                    disabled={exportState === "loading" || !memo}
                    data-activity="workspace.export.memo_csv"
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                  >
                    {exportState === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t.waitlist.exportCsv} (memo)
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportWorkspace("snapshot", "json")}
                    disabled={exportState === "loading"}
                    data-activity="workspace.export.snapshot_json"
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800"
                  >
                    {exportState === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t.waitlist.exportJson} (snapshot)
                  </button>
                </div>

                {exportMessage && (
                  <p
                    className={`mt-3 rounded-md px-3 py-2 text-sm ${
                      exportState === "error"
                        ? "bg-rose-50 text-rose-800"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {exportMessage}
                  </p>
                )}
              </>
            ) : (
              <MagicLinkForm
                t={t}
                locale={locale}
                ticker={snapshot?.identity.ticker}
                compact
              />
            )}
          </article>
        </div>
      </section>
    </aside>
  );
}

function SourcesAndCaveats({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.sources.title}
          </h3>
          <MeaningBadge
            Icon={FileText}
            label={t.sources.title}
            tooltip={t.sources.titleTooltip}
            tone="sky"
            tooltipAlign="right"
          />
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.citations.map((citation) => (
            <a
              key={`${citation.label}-${citation.url}`}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-sky-400"
            >
              <span>
                <span className="block text-sm font-semibold text-zinc-800">
                  {citation.label}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {[citation.form, citation.filedDate].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ArrowUpRight
                className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      </article>

      <article className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.sources.caveatsTitle}
          </h3>
          <MeaningBadge
            Icon={AlertTriangle}
            label={t.sources.caveatsTitle}
            tooltip={t.sources.caveatsTooltip}
            tone="amber"
            tooltipAlign="right"
          />
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.caveats.length ? (
            snapshot.caveats.map((caveat) => (
              <div
                key={caveat}
                className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{translateCaveat(caveat, locale)}</span>
              </div>
            ))
          ) : (
            <div className="flex gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{t.sources.coreFactsAvailable}</span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

export function FinariApp({
  locale,
  initialTicker = DEFAULT_TICKER,
  initialViewer = null,
}: {
  locale: Locale;
  initialTicker?: string;
  initialViewer?: Viewer | null;
}) {
  const t = getDictionary(locale);
  const normalizedInitialTicker = initialTicker.trim().toUpperCase() || DEFAULT_TICKER;
  const [query, setQuery] = useState(normalizedInitialTicker);
  const [results, setResults] = useState<CompanyIdentity[]>([]);
  const [sp500Constituents, setSp500Constituents] = useState<Sp500Constituent[]>([]);
  const [sp500State, setSp500State] = useState<LoadState>("idle");
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [events, setEvents] = useState<CompanyEventImpact[]>([]);
  const [eventsState, setEventsState] = useState<LoadState>("idle");
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [privateEventsState, setPrivateEventsState] = useState<MemoState>("idle");
  const [adminEventsState, setAdminEventsState] = useState<MemoState>("idle");
  const [privateEventsError, setPrivateEventsError] = useState<string | null>(null);
  const [adminEventsError, setAdminEventsError] = useState<string | null>(null);
  const [curatingEventId, setCuratingEventId] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState(normalizedInitialTicker);
  const [memo, setMemo] = useState<ResearchMemo | null>(null);
  const [memoState, setMemoState] = useState<MemoState>("idle");
  const [adminMemoState, setAdminMemoState] = useState<MemoState>("idle");
  const [memoError, setMemoError] = useState<string | null>(null);
  const [adminMemoError, setAdminMemoError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(initialViewer);

  const loading = loadState === "loading";
  const showSearchResults =
    query.trim().length > 0 && query.trim().toUpperCase() !== activeTicker;
  const visibleResults = showSearchResults ? results : [];

  useActivityTracker({
    viewer,
    locale,
    ticker: snapshot?.identity.ticker ?? activeTicker,
  });

  const loadEvents = useCallback(async (ticker: string, includeHidden = false) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    setEvents([]);
    setEventsState("loading");
    setEventsError(null);

    try {
      const params = new URLSearchParams({ locale });
      if (includeHidden) {
        params.set("includeHidden", "1");
      }
      const response = await fetch(
        `/api/company/${encodeURIComponent(normalized)}/events?${params.toString()}`,
      );
      const payload = (await response.json()) as {
        events?: CompanyEventImpact[];
        error?: string;
      };

      if (!response.ok || !payload.events) {
        throw new Error(payload.error || t.events.unavailable);
      }

      setEvents(payload.events);
      setEventsState("ready");
    } catch (error) {
      setEvents([]);
      setEventsState("error");
      setEventsError(error instanceof Error ? error.message : t.events.unavailable);
    }
  }, [locale, t.events.unavailable]);

  const loadCompany = useCallback(async (ticker: string, options: { forceRefresh?: boolean } = {}) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    setActiveTicker(normalized);
    setQuery(normalized);
    setResults([]);
    setMemo(null);
    setMemoState("idle");
    setAdminMemoState("idle");
    setMemoError(null);
    setAdminMemoError(null);
    setEvents([]);
    setEventsState("idle");
    setEventsError(null);
    setPrivateEventsState("idle");
    setAdminEventsState("idle");
    setPrivateEventsError(null);
    setAdminEventsError(null);
    setCuratingEventId(null);
    setLoadState("loading");
    setLoadError(null);

    try {
      const params = new URLSearchParams();
      if (options.forceRefresh) {
        params.set("refresh", "1");
      }
      const response = await fetch(
        `/api/company/${encodeURIComponent(normalized)}${
          params.size ? `?${params.toString()}` : ""
        }`,
      );
      const payload = (await response.json()) as {
        snapshot?: CompanySnapshot;
        error?: string;
      };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || t.errors.loadCompany);
      }

      setSnapshot(payload.snapshot);
      setLoadState("ready");
      window.history.replaceState(null, "", `/${locale}?ticker=${normalized}`);
      void loadEvents(normalized);
    } catch (error) {
      setLoadState("error");
      setEvents([]);
      setEventsState("idle");
      setLoadError(
        error instanceof Error
          ? error.message
          : t.errors.loadFacts,
      );
    }
  }, [loadEvents, locale, t.errors.loadCompany, t.errors.loadFacts]);

  async function generateMemo() {
    if (!snapshot) {
      return;
    }

    setMemoState("loading");
    setMemoError(null);

    try {
      const memoEndpoint = viewer
        ? `/api/me/company/${encodeURIComponent(snapshot.identity.ticker)}/memo?locale=${locale}`
        : `/api/company/${encodeURIComponent(snapshot.identity.ticker)}/memo?locale=${locale}`;
      const response = await fetch(
        memoEndpoint,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        memo?: ResearchMemo;
        error?: string;
      };

      if (!response.ok || !payload.memo) {
        throw new Error(payload.error || t.errors.generateMemo);
      }

      setMemo(payload.memo);
      setMemoState("ready");
    } catch (error) {
      setMemoState("error");
      setMemoError(
        error instanceof Error
          ? error.message
          : t.memo.error,
      );
    }
  }

  async function publishPublicMemo() {
    if (!snapshot || !viewer?.isAdmin) {
      return;
    }

    setAdminMemoState("loading");
    setAdminMemoError(null);

    try {
      const response = await fetch(
        `/api/admin/company/${encodeURIComponent(snapshot.identity.ticker)}/memo?locale=${locale}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        memo?: ResearchMemo;
        error?: string;
      };

      if (!response.ok || !payload.memo) {
        throw new Error(payload.error || t.errors.generateMemo);
      }

      setMemo(payload.memo);
      setAdminMemoState("ready");
    } catch (error) {
      setAdminMemoState("error");
      setAdminMemoError(
        error instanceof Error
          ? error.message
          : t.memo.error,
      );
    }
  }

  async function generatePrivateEventAnalysis() {
    if (!snapshot || !viewer) {
      return;
    }

    setPrivateEventsState("loading");
    setPrivateEventsError(null);

    try {
      const response = await fetch(
        `/api/me/company/${encodeURIComponent(snapshot.identity.ticker)}/events/analysis?locale=${locale}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        events?: CompanyEventImpact[];
        error?: string;
      };

      if (!response.ok || !payload.events) {
        throw new Error(payload.error || t.events.analysisFailed);
      }

      setEvents(payload.events);
      setPrivateEventsState("ready");
    } catch (error) {
      setPrivateEventsState("error");
      setPrivateEventsError(
        error instanceof Error ? error.message : t.events.analysisFailed,
      );
    }
  }

  async function publishPublicEventAnalysis() {
    if (!snapshot || !viewer?.isAdmin) {
      return;
    }

    setAdminEventsState("loading");
    setAdminEventsError(null);

    try {
      const response = await fetch(
        `/api/admin/company/${encodeURIComponent(snapshot.identity.ticker)}/events/refresh?locale=${locale}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        events?: CompanyEventImpact[];
        error?: string;
      };

      if (!response.ok || !payload.events) {
        throw new Error(payload.error || t.events.analysisFailed);
      }

      setEvents(payload.events);
      setAdminEventsState("ready");
    } catch (error) {
      setAdminEventsState("error");
      setAdminEventsError(
        error instanceof Error ? error.message : t.events.analysisFailed,
      );
    }
  }

  async function curateEvent(eventId: string, action: EventCurationAction) {
    if (!snapshot || !viewer?.isAdmin) {
      return;
    }

    setCuratingEventId(eventId);
    setAdminEventsError(null);

    try {
      const response = await fetch(
        `/api/admin/company/${encodeURIComponent(snapshot.identity.ticker)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || t.events.curationFailed);
      }

      await loadEvents(snapshot.identity.ticker, true);
    } catch (error) {
      setAdminEventsError(
        error instanceof Error ? error.message : t.events.curationFailed,
      );
    } finally {
      setCuratingEventId(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadViewer() {
      try {
        const response = await fetch("/api/me");
        const payload = (await response.json()) as { user?: Viewer | null };
        if (mounted) {
          setViewer(payload.user ?? null);
        }
      } catch {
        if (mounted) {
          setViewer(null);
        }
      }
    }

    void loadViewer();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSp500Constituents() {
      setSp500State("loading");
      try {
        const response = await fetch("/api/sp500");
        const payload = (await response.json()) as {
          constituents?: Sp500Constituent[];
        };
        if (!response.ok || !payload.constituents) {
          throw new Error("Unable to load S&P 500 constituents");
        }

        if (mounted) {
          setSp500Constituents(payload.constituents);
          setSp500State("ready");
        }
      } catch {
        if (mounted) {
          setSp500Constituents([]);
          setSp500State("error");
        }
      }
    }

    void loadSp500Constituents();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCompany(normalizedInitialTicker);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadCompany, normalizedInitialTicker]);

  useEffect(() => {
    if (viewer?.isAdmin && snapshot) {
      const timeout = window.setTimeout(() => {
        void loadEvents(snapshot.identity.ticker, true);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [loadEvents, snapshot, viewer?.isAdmin]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1 || trimmed.toUpperCase() === activeTicker) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          results?: CompanyIdentity[];
        };
        setResults(payload.results ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeTicker, query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTicker = results[0]?.ticker ?? query;
    void loadCompany(nextTicker);
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 [overflow-x:clip]">
      <ResearchToolbar
        locale={locale}
        t={t}
        query={query}
        setQuery={setQuery}
        results={visibleResults}
        sp500Constituents={sp500Constituents}
        sp500State={sp500State}
        loading={loading}
        activeTicker={activeTicker}
        onSelectTicker={(ticker) => void loadCompany(ticker)}
        onSubmit={submitSearch}
      />

      <main className="mx-auto grid min-w-0 w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <SnapshotHeader
            snapshot={snapshot}
            loading={loading}
            error={loadError}
            onRefresh={() =>
              void loadCompany(snapshot?.identity.ticker ?? activeTicker, {
                forceRefresh: true,
              })
            }
            t={t}
            locale={locale}
          />

          {snapshot && (
            <>
              <DecisionScreen snapshot={snapshot} locale={locale} t={t} />
              <AdvisorSummary snapshot={snapshot} locale={locale} t={t} />
              <EventImpactPanel
                events={events}
                state={eventsState}
                privateState={privateEventsState}
                adminState={adminEventsState}
                error={eventsError}
                privateError={privateEventsError}
                adminError={adminEventsError}
                locale={locale}
                ticker={snapshot.identity.ticker}
                t={t}
                viewer={viewer}
                curatingEventId={curatingEventId}
                onGeneratePrivate={() => void generatePrivateEventAnalysis()}
                onPublishPublic={() => void publishPublicEventAnalysis()}
                onCurate={(eventId, action) => void curateEvent(eventId, action)}
              />
              <QuarterlyTrendPanel snapshot={snapshot} t={t} />
              <ChangeAnalysisPanel snapshot={snapshot} locale={locale} t={t} />
              <BusinessDriversPanel snapshot={snapshot} locale={locale} t={t} />
              <BalanceSheetPanel snapshot={snapshot} locale={locale} t={t} />
              <PeerComparisonPanel snapshot={snapshot} t={t} />
              <DataQualityPanel snapshot={snapshot} locale={locale} t={t} />
              <MetricGrid
                metrics={snapshot.metrics}
                ticker={snapshot.identity.ticker}
                locale={locale}
                t={t}
              />
              <FinancialCharts snapshot={snapshot} locale={locale} t={t} />
              <FinancialTable snapshot={snapshot} t={t} />
              <MemoPanel
                snapshot={snapshot}
                memo={memo}
                memoState={memoState}
                adminMemoState={adminMemoState}
                error={memoError}
                adminError={adminMemoError}
                onGenerate={() => void generateMemo()}
                onPublishPublic={() => void publishPublicMemo()}
                viewer={viewer}
                locale={locale}
                t={t}
              />
              <SourcesAndCaveats snapshot={snapshot} locale={locale} t={t} />
            </>
          )}
        </div>

        <div className="min-w-0">
          <WaitlistPanel
            snapshot={snapshot}
            memo={memo}
            locale={locale}
            viewer={viewer}
            t={t}
          />
        </div>
      </main>
    </div>
  );
}
