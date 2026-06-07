import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import EmailProvider from "next-auth/providers/email";

import { getDb, hasDatabase } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { sendMagicLinkEmail } from "@/lib/email";
import { getAuthSecret, getEmailFrom } from "@/lib/env";
import { isInvitedEmail } from "@/lib/invitations";

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
      signIn({ user }) {
        return isInvitedEmail(user.email);
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
    secret: getAuthSecret(),
    session: {
      strategy: databaseEnabled ? "database" : "jwt",
    },
  };
}
