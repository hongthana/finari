"use client";

import { Loader2, Mail, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

type AuthSignInPageProps = {
  callbackUrl: string;
};

function LockedResearchPreview() {
  const metrics = [
    ["Market cap", "$3.8T"],
    ["P/E", "36.2"],
    ["P/B", "41.7"],
    ["EV/EBITDA", "27.9"],
    ["Debt/Equity", "0.8"],
    ["ROE", "1.5%"],
  ];
  const valuationRows = [
    ["Average inventory", "$6.5B"],
    ["Average payables", "$69.4B"],
    ["Average receivables", "$69.6B"],
    ["Capex / depreciation", "108.7%"],
  ];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden bg-zinc-50 text-zinc-950"
    >
      <div className="mx-auto min-h-screen w-full max-w-7xl px-6 py-7 opacity-95 blur-[1px]">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                Finari
              </p>
              <h1 className="text-2xl font-semibold tracking-normal">
                งานวิจัยหุ้นระดับสถาบัน สำหรับนักลงทุนรายย่อย
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            {["GitHub", "EN", "อ้างอิง SEC", "เพื่อการศึกษา"].map((item) => (
              <div key={item} className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold">
                {item}
              </div>
            ))}
          </div>
        </header>

        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_250px] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_100px_100px_100px_100px] gap-2">
              <div className="flex h-12 items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 text-lg font-semibold">
                <Search className="h-5 w-5 text-zinc-400" aria-hidden="true" />
                AAPL
              </div>
              {["AAPL", "MSFT", "NVDA", "AMZN"].map((ticker) => (
                <div key={ticker} className="flex h-12 items-center justify-center rounded-md border border-zinc-200 bg-white text-sm font-semibold">
                  {ticker}
                </div>
              ))}
            </div>

            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
                    ผลกระทบจากเหตุการณ์
                  </div>
                  <h2 className="mt-5 text-xl font-semibold">
                    เหตุการณ์ล่าสุดและผลกระทบทางการเงินที่อาจเกิดขึ้น
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                    แปลงเหตุการณ์ล่าสุดของบริษัท อุตสาหกรรม ภาพรวมเศรษฐกิจ กฎหมาย/กฎเกณฑ์ และ filing ให้เป็นปัจจัยทางการเงินที่นักลงทุนควรติดตาม
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="rounded-md bg-teal-700 px-4 py-2 text-center text-sm font-semibold text-white">
                    สร้างบทวิเคราะห์เหตุการณ์ส่วนตัว
                  </div>
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900">
                    เผยแพร่บทวิเคราะห์เหตุการณ์สาธารณะ
                  </div>
                </div>
              </div>

              {[0, 1].map((item) => (
                <article key={item} className="mt-5 rounded-md border border-zinc-200 bg-white p-4">
                  <p className="text-xs font-semibold text-zinc-500">เกิดอะไรขึ้น</p>
                  <h3 className="mt-1 text-base font-semibold">
                    {item === 0
                      ? "Apple answers Wall Street's biggest AI concern"
                      : "Why Did AAPL, OSCR, LLY Stocks Hit 52-Week Highs Today?"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    เหตุการณ์นี้ประเภทเฉพาะบริษัทที่อาจสำคัญ เพราะเป็นสัญญาณยังไม่ชัดต่อ Revenue นักลงทุนควรรอดู Revenue growth ใน filing ถัดไป
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {["การวิเคราะห์", "ประเภทเหตุการณ์", "ผลกระทบที่น่าจะเป็น", "กรอบเวลา"].map((label) => (
                      <div key={label}>
                        <p className="text-xs font-semibold text-zinc-500">{label}</p>
                        <p className="mt-1 text-sm font-semibold">ยังไม่ชัด</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          </div>

          <aside className="space-y-3">
            <section className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-semibold">ประเมินมูลค่า</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {metrics.map(([label, value]) => (
                  <div key={label} className="rounded-md border border-zinc-200 bg-white p-2">
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p className="font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="font-semibold">ตัวชี้วัด valuation ทั้งหมด</p>
              <p className="mt-1 text-xs text-zinc-600">
                รวมจาก FMP key metrics, ratios, และ quote data
              </p>
              <div className="mt-3 rounded-md border border-zinc-200 bg-white">
                {valuationRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-zinc-100 px-3 py-3 last:border-b-0">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
      <div className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm" />
    </div>
  );
}

export function AuthSignInPage({ callbackUrl }: AuthSignInPageProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setState("error");
      return;
    }

    setState("loading");
    const result = await signIn("email", {
      email: normalizedEmail,
      callbackUrl,
      redirect: false,
    }).catch(() => null);

    setState(!result || result.error ? "error" : "ready");
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-zinc-950">
      <LockedResearchPreview />
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-8">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-zinc-950/90 p-6 text-white shadow-2xl shadow-zinc-950/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-zinc-950">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
                Finari
              </p>
              <h1 className="text-lg font-semibold">Sign in with email</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-300">
            Use one magic link to unlock this browser. Finari keeps you signed in
            for 30 days unless you sign out or clear cookies.
          </p>

          <label className="mt-5 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@example.com"
            className="mt-2 h-12 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/30"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-blue-500 px-4 text-base font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {state === "loading" ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="h-5 w-5" aria-hidden="true" />
            )}
            {state === "loading" ? "Sending link..." : "Sign in with Email"}
          </button>

          {state === "ready" && (
            <p className="mt-3 rounded-md bg-teal-500/15 px-3 py-2 text-sm text-teal-100">
              Check your email for the Finari sign-in link. After you open it,
              this browser stays signed in for 30 days.
            </p>
          )}
          {state === "error" && (
            <p className="mt-3 rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              Unable to send a sign-in link. Check the email and try again.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
