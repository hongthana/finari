export function getSecUserAgent(): string {
  return (
    process.env.SEC_USER_AGENT?.trim() ||
    "Finari/0.1 (development research app; contact=dev@finari.local)"
  );
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function getDatabasePath(): string {
  return process.env.FINARI_DB_PATH?.trim() || ".data/finari.sqlite";
}

export function getAuthSecret(): string {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
}

export function getAuthUrl(): string {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  );
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "Finari <research@finari.local>";
}
