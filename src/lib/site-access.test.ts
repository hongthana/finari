import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getCurrentUser,
  };
});

import { requireInvitationAccess } from "@/lib/site-access";

afterEach(() => {
  vi.unstubAllEnvs();
  getCurrentUser.mockReset();
});

describe("requireInvitationAccess", () => {
  it("does not check sessions when invitation-only mode is disabled", async () => {
    vi.stubEnv("FINARI_INVITATION_ONLY", "false");
    vi.stubEnv("FINARI_INVITED_EMAILS", "");

    await expect(requireInvitationAccess()).resolves.toBeNull();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("keeps public research routes open even when legacy invitation env vars are set", async () => {
    vi.stubEnv("FINARI_INVITATION_ONLY", "true");
    vi.stubEnv("FINARI_INVITED_EMAILS", "founder@example.com");

    await expect(requireInvitationAccess()).resolves.toBeNull();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});
