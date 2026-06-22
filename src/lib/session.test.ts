import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getAuthOptions: vi.fn(() => ({})),
  getServerSession: vi.fn(),
  isAdminEmail: vi.fn((email?: string | null) => email === "admin@example.com"),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  getAuthOptions: mocks.getAuthOptions,
}));

vi.mock("@/lib/env", () => ({
  isAdminEmail: mocks.isAdminEmail,
}));

import { getCurrentUser } from "@/lib/session";

function cookieStore(cookies: { name: string; value: string }[]) {
  return {
    getAll: () => cookies,
  };
}

beforeEach(() => {
  mocks.cookies.mockReset();
  mocks.cookies.mockResolvedValue(cookieStore([]));
  mocks.getAuthOptions.mockClear();
  mocks.getServerSession.mockReset();
  mocks.isAdminEmail.mockClear();
});

describe("getCurrentUser", () => {
  it("skips NextAuth session work when no session cookie is present", async () => {
    await expect(getCurrentUser()).resolves.toBeNull();

    expect(mocks.getServerSession).not.toHaveBeenCalled();
    expect(mocks.getAuthOptions).not.toHaveBeenCalled();
  });

  it("loads the session when a NextAuth session cookie exists", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore([{ name: "next-auth.session-token", value: "token" }]),
    );
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user_1", email: "admin@example.com" },
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "user_1",
      email: "admin@example.com",
      isAdmin: true,
    });

    expect(mocks.getServerSession).toHaveBeenCalledWith({});
  });

  it("recognizes chunked secure session cookies", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore([{ name: "__Secure-next-auth.session-token.0", value: "chunk" }]),
    );
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user_2", email: "user@example.com" },
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "user_2",
      email: "user@example.com",
      isAdmin: false,
    });
  });
});
