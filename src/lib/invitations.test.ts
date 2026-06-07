import { afterEach, describe, expect, it, vi } from "vitest";

import { isInvitedEmail } from "@/lib/invitations";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isInvitedEmail", () => {
  it("allows any email when invitation-only mode is disabled", () => {
    vi.stubEnv("FINARI_INVITATION_ONLY", "false");
    vi.stubEnv("FINARI_INVITED_EMAILS", "");

    expect(isInvitedEmail("investor@example.com")).toBe(true);
  });

  it("allows only invited emails when an allowlist is configured", () => {
    vi.stubEnv("FINARI_INVITED_EMAILS", "founder@example.com, INVESTOR@example.com ");

    expect(isInvitedEmail("investor@example.com")).toBe(true);
    expect(isInvitedEmail("other@example.com")).toBe(false);
  });

  it("allows admin emails when invitation-only mode is enabled", () => {
    vi.stubEnv("FINARI_INVITATION_ONLY", "true");
    vi.stubEnv("FINARI_INVITED_EMAILS", "");
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");

    expect(isInvitedEmail("admin@example.com")).toBe(true);
    expect(isInvitedEmail("guest@example.com")).toBe(false);
  });
});
