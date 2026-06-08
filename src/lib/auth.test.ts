import { describe, expect, it } from "vitest";

import { getAuthOptions } from "@/lib/auth";

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
});
