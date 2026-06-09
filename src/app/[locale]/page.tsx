import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FinariApp } from "@/components/finari-app";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ ticker?: string | string[] }>;
};

function normalizeTicker(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const ticker = raw?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9.-]{1,12}$/.test(ticker) ? ticker : "AAPL";
}

async function getLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  return getDictionary(locale).metadata;
}

export default async function LocalizedHome({ params, searchParams }: PageProps) {
  const locale = await getLocale(params);
  const resolvedSearchParams = await searchParams;
  const ticker = normalizeTicker(resolvedSearchParams?.ticker);
  const viewer = await getCurrentUser();

  if (!viewer) {
    redirect(
      `/api/auth/signin?callbackUrl=${encodeURIComponent(
        `/${locale}?ticker=${encodeURIComponent(ticker)}`,
      )}`,
    );
  }

  return (
    <FinariApp
      locale={locale}
      initialTicker={ticker}
      initialViewer={viewer}
    />
  );
}
