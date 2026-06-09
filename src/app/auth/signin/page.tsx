import type { Metadata } from "next";

import { AuthSignInPage } from "@/components/auth-signin-page";

export const metadata: Metadata = {
  title: "Sign in | Finari",
};

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = await searchParams ?? {};
  const callbackUrl = firstParam(resolvedSearchParams, "callbackUrl") || "/th?ticker=AAPL";

  return <AuthSignInPage callbackUrl={callbackUrl} />;
}
