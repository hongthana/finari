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

  it("blocks anonymous users when invitation-only mode is enabled", async () => {
    vi.stubEnv("FINARI_INVITATION_ONLY", "true");
    getCurrentUser.mockResolvedValueOnce(null);

    const response = await requireInvitationAccess();

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "Authentication required" });
  });

  it("allows signed-in users when invitation-only mode is enabled", async () => {
    vi.stubEnv("FINARI_INVITATION_ONLY", "true");
    getCurrentUser.mockResolvedValueOnce({
      id: "user_1",
      email: "investor@example.com",
      isAdmin: false,
    });

    await expect(requireInvitationAccess()).resolves.toBeNull();
  });
});
