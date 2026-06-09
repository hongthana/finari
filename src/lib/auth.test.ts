import { describe, expect, it } from "vitest";

import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  AUTH_SESSION_UPDATE_AGE_SECONDS,
  getAuthOptions,
} from "@/lib/auth";

describe("getAuthOptions", () => {
  it("allows any valid email to request/sign in with email auth", async () => {
    const options = getAuthOptions();
    const result = await options.callbacks?.signIn?.({
      user: { id: "user_1", email: "guest@example.com" },
      account: null,
      profile: undefined,
      email: { verificationRequest: true },
      credentials: undefined,
    });

    expect(result).toBe(true);
  });

  it("keeps signed-in users remembered on the same browser", () => {
    const options = getAuthOptions();

    expect(options.session?.maxAge).toBe(AUTH_SESSION_MAX_AGE_SECONDS);
    expect(options.session?.updateAge).toBe(AUTH_SESSION_UPDATE_AGE_SECONDS);
    expect(options.jwt?.maxAge).toBe(AUTH_SESSION_MAX_AGE_SECONDS);
  });
});
