import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  computeMemoPromptHash,
  computeSnapshotSourceHash,
  getFreshStoredSnapshot,
  getStoredMemo,
  isSnapshotExpired,
  persistMemo,
  persistSnapshot,
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
    const stored = await persistSnapshot(fixtureSnapshot);
    const fetched = await getFreshStoredSnapshot(fixtureSnapshot.identity.ticker);

    expect(fetched).toMatchObject({
      snapshotId: stored.snapshotId,
      companyId: stored.companyId,
      sourceHash: stored.sourceHash,
    });
    expect(fetched?.snapshot.identity.ticker).toBe(fixtureSnapshot.identity.ticker);
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
});
