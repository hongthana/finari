import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb, hasDatabase } from "@/db/client";
import { companyEvents, eventImpacts } from "@/db/schema";
import { stableHash } from "@/lib/cache";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { findCompanyIdByTicker, persistCompanyIdentities } from "@/lib/research-store";
import type {
  CompanyEventImpact,
  CompanyIdentity,
  EventAnalysisMode,
  EventConfidence,
  EventHorizon,
  EventImpactDriver,
  EventVisibility,
  RawCompanyEvent,
  TrendSignal,
} from "@/lib/types";

export type EventScopeInput = {
  visibility?: EventVisibility;
  ownerUserId?: string | null;
  publishedByUserId?: string | null;
};

export type StoredCompanyEvent = {
  eventId: string;
  companyId: string;
  sourceFingerprint: string;
  event: RawCompanyEvent;
  isHidden: boolean;
  isFeatured: boolean;
};

export type StoredEventImpact = {
  impactId: string;
  companyEventId: string;
  companyId: string;
  locale: Locale;
  visibility: EventVisibility;
  ownerUserId: string | null;
  analysisMode: EventAnalysisMode;
  model: string;
  promptHash: string;
  eventType: CompanyEventImpact["eventType"];
  drivers: EventImpactDriver[];
  impact: TrendSignal;
  horizon: EventHorizon;
  watchMetric: string;
  confidence: EventConfidence;
  impactSummary: string;
  investorMeaning: string;
  generatedAt: string;
  publishedAt: string | null;
  publishedByUserId: string | null;
};

const EVENT_PROMPT_VERSION = "finari_event_impact_v1";

const memoryState = globalThis as typeof globalThis & {
  __finariCompanyEvents?: Map<string, StoredCompanyEvent>;
  __finariEventImpacts?: Map<string, StoredEventImpact>;
};

function getCompanyEventMemory() {
  memoryState.__finariCompanyEvents ??= new Map();
  return memoryState.__finariCompanyEvents;
}

function getEventImpactMemory() {
  memoryState.__finariEventImpacts ??= new Map();
  return memoryState.__finariEventImpacts;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function dateFromIso(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeEventScope(scope: EventScopeInput = {}) {
  const visibility = scope.visibility ?? "public";
  const ownerUserId = visibility === "private" ? (scope.ownerUserId ?? null) : null;

  if (visibility === "private" && !ownerUserId) {
    throw new Error("Private event impacts require an owner user id");
  }

  return {
    visibility,
    ownerUserId,
    publishedByUserId:
      visibility === "public" ? (scope.publishedByUserId ?? null) : null,
  };
}

function eventMemoryKey(companyId: string, sourceFingerprint: string) {
  return `${companyId}:${sourceFingerprint}`;
}

function impactMemoryKey(input: {
  companyEventId: string;
  locale: Locale;
  model: string;
  promptHash: string;
  visibility: EventVisibility;
  ownerUserId: string | null;
}) {
  return [
    input.companyEventId,
    input.locale,
    input.model,
    input.promptHash,
    input.visibility,
    input.ownerUserId ?? "public",
  ].join(":");
}

export function computeCompanyEventFingerprint(
  identity: CompanyIdentity,
  event: RawCompanyEvent,
): string {
  return stableHash({
    cik: identity.cik,
    provider: event.provider,
    sourceType: event.sourceType,
    form: event.form,
    url: event.url.trim().toLowerCase(),
    title: event.title.trim().toLowerCase(),
    publishedAt: event.publishedAt,
  });
}

export function computeEventImpactPromptHash(input: {
  event: RawCompanyEvent;
  sourceFingerprint: string;
  locale?: Locale;
  model: string;
  analysisMode: EventAnalysisMode;
}): string {
  return stableHash({
    version: EVENT_PROMPT_VERSION,
    locale: input.locale ?? DEFAULT_LOCALE,
    model: input.model,
    analysisMode: input.analysisMode,
    sourceFingerprint: input.sourceFingerprint,
    title: input.event.title,
    summary: input.event.summary,
    sourceType: input.event.sourceType,
    provider: input.event.provider,
    form: input.event.form,
    publishedAt: input.event.publishedAt,
  });
}

async function companyIdForIdentity(identity: CompanyIdentity): Promise<string> {
  await persistCompanyIdentities([identity]);
  return (
    (await findCompanyIdByTicker(identity.ticker)) ??
    stableHash({ cik: identity.cik, ticker: normalizeTicker(identity.ticker) })
  );
}

function storedEventFromRow(row: {
  id: string;
  companyId: string;
  provider: string;
  sourceType: string;
  sourceName: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: Date;
  form: string | null;
  sourceFingerprint: string;
  isHidden: boolean;
  isFeatured: boolean;
}): StoredCompanyEvent {
  return {
    eventId: row.id,
    companyId: row.companyId,
    sourceFingerprint: row.sourceFingerprint,
    event: {
      title: row.title,
      summary: row.summary ?? undefined,
      url: row.url,
      sourceName: row.sourceName,
      publishedAt: row.publishedAt.toISOString(),
      sourceType: row.sourceType === "filing" ? "filing" : "news",
      provider: row.provider,
      form: row.form ?? undefined,
    },
    isHidden: row.isHidden,
    isFeatured: row.isFeatured,
  };
}

function storedImpactFromRow(row: {
  id: string;
  companyEventId: string;
  companyId: string;
  locale: string;
  visibility: string;
  ownerUserId: string | null;
  analysisMode: string;
  model: string;
  promptHash: string;
  eventType: string;
  driversJson: string[];
  impact: string;
  horizon: string;
  watchMetric: string;
  confidence: string;
  impactSummary: string;
  investorMeaning: string;
  generatedAt: Date;
  publishedAt: Date | null;
  publishedByUserId: string | null;
}): StoredEventImpact {
  return {
    impactId: row.id,
    companyEventId: row.companyEventId,
    companyId: row.companyId,
    locale: row.locale === "th" ? "th" : "en",
    visibility: row.visibility === "private" ? "private" : "public",
    ownerUserId: row.ownerUserId,
    analysisMode: row.analysisMode === "ai" ? "ai" : "deterministic",
    model: row.model,
    promptHash: row.promptHash,
    eventType:
      row.eventType === "industry" ||
      row.eventType === "macro" ||
      row.eventType === "legal-regulatory" ||
      row.eventType === "filing-related"
        ? row.eventType
        : "company-specific",
    drivers: row.driversJson as EventImpactDriver[],
    impact:
      row.impact === "positive" ||
      row.impact === "negative" ||
      row.impact === "unknown"
        ? row.impact
        : "neutral",
    horizon:
      row.horizon === "short-term" ||
      row.horizon === "long-term" ||
      row.horizon === "both"
        ? row.horizon
        : "uncertain",
    watchMetric: row.watchMetric,
    confidence:
      row.confidence === "High" || row.confidence === "Low"
        ? row.confidence
        : "Medium",
    impactSummary: row.impactSummary,
    investorMeaning: row.investorMeaning,
    generatedAt: row.generatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedByUserId: row.publishedByUserId,
  };
}

export async function upsertCompanyEvents(
  identity: CompanyIdentity,
  events: RawCompanyEvent[],
): Promise<StoredCompanyEvent[]> {
  const companyId = await companyIdForIdentity(identity);

  if (!hasDatabase()) {
    const memory = getCompanyEventMemory();
    return events.map((event) => {
      const sourceFingerprint = computeCompanyEventFingerprint(identity, event);
      const key = eventMemoryKey(companyId, sourceFingerprint);
      const existing = memory.get(key);
      const stored: StoredCompanyEvent = {
        eventId: existing?.eventId ?? stableHash({ companyId, sourceFingerprint }),
        companyId,
        sourceFingerprint,
        event,
        isHidden: existing?.isHidden ?? false,
        isFeatured: existing?.isFeatured ?? false,
      };
      memory.set(key, stored);
      return stored;
    });
  }

  const db = getDb();
  const stored: StoredCompanyEvent[] = [];
  for (const event of events) {
    const sourceFingerprint = computeCompanyEventFingerprint(identity, event);
    const [row] = await db
      .insert(companyEvents)
      .values({
        companyId,
        provider: event.provider,
        sourceType: event.sourceType,
        sourceName: event.sourceName,
        title: event.title,
        summary: event.summary,
        url: event.url,
        publishedAt: dateFromIso(event.publishedAt),
        form: event.form,
        sourceFingerprint,
        metadataJson: {
          ticker: identity.ticker,
          cik: identity.cik,
        },
      })
      .onConflictDoUpdate({
        target: [companyEvents.companyId, companyEvents.sourceFingerprint],
        set: {
          provider: event.provider,
          sourceType: event.sourceType,
          sourceName: event.sourceName,
          title: event.title,
          summary: event.summary,
          url: event.url,
          publishedAt: dateFromIso(event.publishedAt),
          form: event.form,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: companyEvents.id,
        companyId: companyEvents.companyId,
        provider: companyEvents.provider,
        sourceType: companyEvents.sourceType,
        sourceName: companyEvents.sourceName,
        title: companyEvents.title,
        summary: companyEvents.summary,
        url: companyEvents.url,
        publishedAt: companyEvents.publishedAt,
        form: companyEvents.form,
        sourceFingerprint: companyEvents.sourceFingerprint,
        isHidden: companyEvents.isHidden,
        isFeatured: companyEvents.isFeatured,
      });
    stored.push(storedEventFromRow(row));
  }

  return stored;
}

export async function getStoredEventImpact(
  event: StoredCompanyEvent,
  locale: Locale,
  model: string,
  promptHash: string,
  scopeInput: EventScopeInput = {},
): Promise<StoredEventImpact | null> {
  const scope = normalizeEventScope(scopeInput);

  if (!hasDatabase()) {
    return (
      getEventImpactMemory().get(
        impactMemoryKey({
          companyEventId: event.eventId,
          locale,
          model,
          promptHash,
          visibility: scope.visibility,
          ownerUserId: scope.ownerUserId,
        }),
      ) ?? null
    );
  }

  const ownerPredicate =
    scope.visibility === "private"
      ? eq(eventImpacts.ownerUserId, scope.ownerUserId as string)
      : isNull(eventImpacts.ownerUserId);
  const [row] = await getDb()
    .select()
    .from(eventImpacts)
    .where(
      and(
        eq(eventImpacts.companyEventId, event.eventId),
        eq(eventImpacts.locale, locale),
        eq(eventImpacts.visibility, scope.visibility),
        eq(eventImpacts.model, model),
        eq(eventImpacts.promptHash, promptHash),
        ownerPredicate,
      ),
    )
    .limit(1);

  return row ? storedImpactFromRow(row) : null;
}

export async function persistEventImpact(
  event: StoredCompanyEvent,
  impact: CompanyEventImpact,
  locale: Locale,
  model: string,
  promptHash: string,
  scopeInput: EventScopeInput = {},
): Promise<StoredEventImpact> {
  const scope = normalizeEventScope(scopeInput);
  const generatedAt = impact.generatedAt ? dateFromIso(impact.generatedAt) : new Date();

  if (!hasDatabase()) {
    const stored: StoredEventImpact = {
      impactId: stableHash({
        companyEventId: event.eventId,
        locale,
        model,
        promptHash,
        visibility: scope.visibility,
        ownerUserId: scope.ownerUserId,
      }),
      companyEventId: event.eventId,
      companyId: event.companyId,
      locale,
      visibility: scope.visibility,
      ownerUserId: scope.ownerUserId,
      analysisMode: impact.analysisMode,
      model,
      promptHash,
      eventType: impact.eventType,
      drivers: impact.drivers,
      impact: impact.impact,
      horizon: impact.horizon,
      watchMetric: impact.watchMetric,
      confidence: impact.confidence,
      impactSummary: impact.impactSummary,
      investorMeaning: impact.investorMeaning,
      generatedAt: generatedAt.toISOString(),
      publishedAt: scope.visibility === "public" ? generatedAt.toISOString() : null,
      publishedByUserId: scope.publishedByUserId,
    };
    getEventImpactMemory().set(
      impactMemoryKey({
        companyEventId: event.eventId,
        locale,
        model,
        promptHash,
        visibility: scope.visibility,
        ownerUserId: scope.ownerUserId,
      }),
      stored,
    );
    return stored;
  }

  const values = {
    companyEventId: event.eventId,
    companyId: event.companyId,
    locale,
    visibility: scope.visibility,
    ownerUserId: scope.ownerUserId,
    analysisMode: impact.analysisMode,
    model,
    promptHash,
    eventType: impact.eventType,
    driversJson: impact.drivers,
    impact: impact.impact,
    horizon: impact.horizon,
    watchMetric: impact.watchMetric,
    confidence: impact.confidence,
    impactSummary: impact.impactSummary,
    investorMeaning: impact.investorMeaning,
    generatedAt,
    publishedAt: scope.visibility === "public" ? generatedAt : null,
    publishedByUserId: scope.publishedByUserId,
  };
  const setValues = {
    analysisMode: impact.analysisMode,
    eventType: impact.eventType,
    driversJson: impact.drivers,
    impact: impact.impact,
    horizon: impact.horizon,
    watchMetric: impact.watchMetric,
    confidence: impact.confidence,
    impactSummary: impact.impactSummary,
    investorMeaning: impact.investorMeaning,
    generatedAt,
    publishedAt: scope.visibility === "public" ? generatedAt : null,
    publishedByUserId: scope.publishedByUserId,
  };

  if (scope.visibility === "private") {
    const [row] = await getDb()
      .insert(eventImpacts)
      .values(values)
      .onConflictDoUpdate({
        target: [
          eventImpacts.companyEventId,
          eventImpacts.locale,
          eventImpacts.model,
          eventImpacts.promptHash,
          eventImpacts.ownerUserId,
        ],
        targetWhere: sql`${eventImpacts.visibility} = 'private' and ${eventImpacts.ownerUserId} is not null`,
        set: setValues,
      })
      .returning();
    return storedImpactFromRow(row);
  }

  const [row] = await getDb()
    .insert(eventImpacts)
    .values(values)
    .onConflictDoUpdate({
      target: [
        eventImpacts.companyEventId,
        eventImpacts.locale,
        eventImpacts.model,
        eventImpacts.promptHash,
      ],
      targetWhere: sql`${eventImpacts.visibility} = 'public'`,
      set: setValues,
    })
    .returning();
  return storedImpactFromRow(row);
}

export function mergeStoredEventImpact(
  identity: CompanyIdentity,
  event: StoredCompanyEvent,
  impact: StoredEventImpact,
): CompanyEventImpact {
  return {
    id: event.eventId,
    ticker: identity.ticker,
    title: event.event.title,
    summary: event.event.summary,
    url: event.event.url,
    sourceName: event.event.sourceName,
    sourceType: event.event.sourceType,
    provider: event.event.provider,
    publishedAt: event.event.publishedAt,
    eventType: impact.eventType,
    drivers: impact.drivers,
    impact: impact.impact,
    horizon: impact.horizon,
    watchMetric: impact.watchMetric,
    confidence: impact.confidence,
    impactSummary: impact.impactSummary,
    investorMeaning: impact.investorMeaning,
    analysisMode: impact.analysisMode,
    visibility: impact.visibility,
    isFeatured: event.isFeatured,
    isHidden: event.isHidden,
    generatedAt: impact.generatedAt,
    publishedAtAnalysis: impact.publishedAt ?? undefined,
  };
}

export async function updateCompanyEventCuration(input: {
  eventId: string;
  companyId: string;
  adminUserId: string;
  action: "feature" | "unfeature" | "hide" | "unhide";
}): Promise<boolean> {
  const curatedAt = new Date();
  const update = {
    isFeatured:
      input.action === "feature"
        ? true
        : input.action === "unfeature"
          ? false
          : undefined,
    isHidden:
      input.action === "hide"
        ? true
        : input.action === "unhide"
          ? false
          : undefined,
  };

  if (!hasDatabase()) {
    const event = Array.from(getCompanyEventMemory().values()).find(
      (candidate) =>
        candidate.eventId === input.eventId && candidate.companyId === input.companyId,
    );
    if (!event) {
      return false;
    }
    getCompanyEventMemory().set(eventMemoryKey(event.companyId, event.sourceFingerprint), {
      ...event,
      isFeatured: update.isFeatured ?? event.isFeatured,
      isHidden: update.isHidden ?? event.isHidden,
    });
    return true;
  }

  const [row] = await getDb()
    .update(companyEvents)
    .set({
      ...(update.isFeatured !== undefined ? { isFeatured: update.isFeatured } : {}),
      ...(update.isHidden !== undefined ? { isHidden: update.isHidden } : {}),
      curatedByUserId: input.adminUserId,
      curatedAt,
      updatedAt: curatedAt,
    })
    .where(and(eq(companyEvents.id, input.eventId), eq(companyEvents.companyId, input.companyId)))
    .returning({ id: companyEvents.id });

  return Boolean(row);
}

export function eventBatchUsageId(events: StoredCompanyEvent[]): string {
  return stableHash({
    version: EVENT_PROMPT_VERSION,
    events: events.map((event) => ({
      sourceFingerprint: event.sourceFingerprint,
      title: event.event.title,
      publishedAt: event.event.publishedAt,
    })),
  });
}
