import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  computeMemoPromptHash,
  computeSnapshotSourceHash,
  getFreshStoredSnapshot,
  getStoredMemo,
  isSnapshotExpired,
  persistMemo,
  persistSnapshot,
  recordAiUsageEvent,
  resetResearchStoreForTests,
} from "@/lib/research-store";
import { fixtureSnapshot } from "@/test/fixtures";

beforeEach(() => {
  delete process.env.DATABASE_URL;
  resetResearchStoreForTests();
});

afterEach(() => {
  resetResearchStoreForTests();
});

describe("research store", () => {
  it("computes stable source and memo hashes", () => {
    expect(computeSnapshotSourceHash(fixtureSnapshot)).toEqual(
      computeSnapshotSourceHash(fixtureSnapshot),
    );
    expect(computeMemoPromptHash(fixtureSnapshot)).toEqual(
      computeMemoPromptHash(fixtureSnapshot),
    );
    expect(computeMemoPromptHash(fixtureSnapshot, "th")).not.toEqual(
      computeMemoPromptHash(fixtureSnapshot, "en"),
    );
  });

  it("stores and retrieves a fresh snapshot from the memory fallback", async () => {
    const freshSnapshot = {
      ...fixtureSnapshot,
      generatedAt: new Date().toISOString(),
    };
    const stored = await persistSnapshot(freshSnapshot);
    const fetched = await getFreshStoredSnapshot(freshSnapshot.identity.ticker);

    expect(fetched).toMatchObject({
      snapshotId: stored.snapshotId,
      companyId: stored.companyId,
      sourceHash: stored.sourceHash,
    });
    expect(fetched?.snapshot.identity.ticker).toBe(freshSnapshot.identity.ticker);
  });

  it("does not treat expired snapshots as fresh", () => {
    const expired = {
      ...fixtureSnapshot,
      generatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    };

    expect(isSnapshotExpired(expired)).toBe(true);
  });

  it("reuses a memo by snapshot, locale, model, and prompt hash", async () => {
    const snapshot = await persistSnapshot(fixtureSnapshot);
    const memo = {
      company: fixtureSnapshot.identity,
      generatedAt: new Date().toISOString(),
      mode: "fallback" as const,
      disclaimer: "Educational research only.",
      sections: [{ title: "Business", body: "Grounded in filings.", signal: "neutral" as const }],
      citations: fixtureSnapshot.citations,
    };

    const stored = await persistMemo(snapshot, memo, "en");
    const fetched = await getStoredMemo(snapshot, "en");

    expect(fetched).toEqual(stored);
    expect(await getStoredMemo(snapshot, "th")).toBeNull();
  });

  it("keeps public and private memos in separate cache scopes", async () => {
    const snapshot = await persistSnapshot(fixtureSnapshot);
    const memo = {
      company: fixtureSnapshot.identity,
      generatedAt: new Date().toISOString(),
      mode: "fallback" as const,
      disclaimer: "Educational research only.",
      sections: [{ title: "Business", body: "Grounded in filings.", signal: "neutral" as const }],
      citations: fixtureSnapshot.citations,
    };

    const publicMemo = await persistMemo(snapshot, memo, "en", { visibility: "public" });
    const privateMemo = await persistMemo(snapshot, memo, "en", {
      visibility: "private",
      ownerUserId: "user_1",
    });

    expect(publicMemo.memo.visibility).toBe("public");
    expect(privateMemo.memo.visibility).toBe("private");
    expect(privateMemo.memoId).not.toEqual(publicMemo.memoId);
    expect(await getStoredMemo(snapshot, "en", { visibility: "public" })).toEqual(publicMemo);
    expect(
      await getStoredMemo(snapshot, "en", {
        visibility: "private",
        ownerUserId: "user_1",
      }),
    ).toEqual(privateMemo);
    expect(
      await getStoredMemo(snapshot, "en", {
        visibility: "private",
        ownerUserId: "user_2",
      }),
    ).toBeNull();
  });

  it("records AI usage events in the memory fallback", async () => {
    const snapshot = await persistSnapshot(fixtureSnapshot);
    const event = await recordAiUsageEvent({
      userId: "user_1",
      companyId: snapshot.companyId,
      snapshotId: snapshot.snapshotId,
      model: "gpt-4.1-mini",
      promptHash: computeMemoPromptHash(fixtureSnapshot),
      locale: "en",
      purpose: "private_memo",
      status: "fallback",
      errorMessage: "OPENAI_API_KEY is not configured",
    });

    expect(event).toMatchObject({
      userId: "user_1",
      companyId: snapshot.companyId,
      snapshotId: snapshot.snapshotId,
      status: "fallback",
      errorMessage: "OPENAI_API_KEY is not configured",
    });
  });
});
