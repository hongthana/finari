import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import EmailProvider from "next-auth/providers/email";

import { getDb, hasDatabase } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { hashActivityValue, recordActivityEvent } from "@/lib/activity";
import { sendMagicLinkEmail } from "@/lib/email";
import { getAuthSecret, getEmailFrom } from "@/lib/env";

export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const AUTH_SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export function getAuthOptions(): NextAuthOptions {
  const databaseEnabled = hasDatabase();

  return {
    adapter: databaseEnabled
      ? (DrizzleAdapter(getDb(), {
          usersTable: users,
          accountsTable: accounts,
          sessionsTable: sessions,
          verificationTokensTable: verificationTokens,
        }) as Adapter)
      : undefined,
    callbacks: {
      signIn() {
        return true;
      },
      session({ session, user }) {
        if (session.user) {
          session.user.id = user.id;
        }
        return session;
      },
    },
    providers: [
      EmailProvider({
        from: getEmailFrom(),
        sendVerificationRequest: ({ identifier, url }) =>
          sendMagicLinkEmail({ identifier, url }),
      }),
    ],
    pages: {
      signIn: "/auth/signin",
    },
    secret: getAuthSecret(),
    session: {
      strategy: databaseEnabled ? "database" : "jwt",
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
      updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
    },
    jwt: {
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    },
    events: {
      async signIn({ user, isNewUser }) {
        await recordActivityEvent({
          userId: user.id,
          emailHash: hashActivityValue(user.email),
          category: "auth",
          eventName: "auth.sign_in.success",
          status: "ok",
          metadata: { isNewUser },
        });
      },
    },
  };
}
