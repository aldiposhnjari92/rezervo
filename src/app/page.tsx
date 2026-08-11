import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarCheck,
  Check,
  Quote,
  Shield,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { getT } from "@/lib/i18n";
import {
  BrowserFrame,
  CalendarSpread,
  EarningsPanel,
  FloatingEarnings,
  FloatingNotification,
  PhoneBooking,
} from "./landing-visual";

const HIGHLIGHTS = [
  { icon: CalendarCheck, title: "landing.f1Title", body: "landing.f1Body" },
  { icon: Bell, title: "landing.f2Title", body: "landing.f2Body" },
  { icon: BarChart3, title: "landing.f3Title", body: "landing.f3Body" },
  { icon: Shield, title: "landing.f4Title", body: "landing.f4Body" },
] as const;

const SECTIONS = [
  {
    tag: "landing.s1Tag",
    tagIcon: Users,
    title: "landing.s1Title",
    body: "landing.s1Body",
    points: ["landing.s1p1", "landing.s1p2", "landing.s1p3"],
  },
  {
    tag: "landing.s2Tag",
    tagIcon: BarChart3,
    title: "landing.s2Title",
    body: "landing.s2Body",
    points: ["landing.s2p1", "landing.s2p2", "landing.s2p3"],
  },
] as const;

/*
 * PLACEHOLDER — këto nuk janë dëshmi të vërteta.
 * Zëvendësoji me citime reale (me leje) PARA se ta publikosh faqen,
 * ose hiqe fare seksionin. Mos publiko dëshmi të sajuara.
 */
const TESTIMONIALS = [
  { quote: "landing.t1", name: "landing.placeholderName", role: "landing.t1Role" },
  { quote: "landing.t2", name: "landing.placeholderName", role: "landing.t2Role" },
  { quote: "landing.t3", name: "landing.placeholderName", role: "landing.t3Role" },
] as const;

const INCLUDED = [
  "landing.inc1", "landing.inc2", "landing.inc3", "landing.inc4",
  "landing.inc5", "landing.inc6", "landing.inc7", "landing.inc8",
  "landing.inc9", "landing.inc10",
] as const;

const FAQ = [
  ["landing.q1", "landing.a1"],
  ["landing.q2", "landing.a2"],
  ["landing.q3", "landing.a3"],
  ["landing.q4", "landing.a4"],
  ["landing.q5", "landing.a5"],
] as const;

export default function LandingPage() {
  const t = getT();

  return (
    <div className="min-h-screen bg-background">
      {/* ------------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Rezervo<span className="text-primary">.al</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("landing.signIn")}
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              {t("landing.startFree")}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ----------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden">
          {/* shtresa e ngjyrës: dy njolla të buta, jo një gradient i sheshtë */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.20),transparent_65%)] blur-3xl" />
            <div className="absolute right-[-10rem] top-40 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,hsl(160_84%_39%/0.14),transparent_65%)] blur-3xl" />
          </div>

          <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-16 sm:px-6 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t("landing.badge")}
              </div>

              <h1 className="mt-7 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                {t("landing.heroA")}{" "}
                <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                  {t("landing.heroB")}
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("landing.heroBody")}
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/login?mode=signup"
                  className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/40 sm:w-auto"
                >
                  {t("landing.ctaPrimary")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="#si-funksionon"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-card px-7 text-sm font-semibold shadow-sm transition-colors hover:bg-muted sm:w-auto"
                >
                  {t("landing.ctaSecondary")}
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t("landing.perkFree")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t("landing.perkNoCard")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t("landing.perkFast")}
                </span>
              </div>
            </div>

            {/* pamja e produktit, me kartela që notojnë mbi të */}
            <div className="relative mx-auto mt-16 max-w-4xl">
              <BrowserFrame url="rezervo.al/calendar">
                <CalendarSpread />
              </BrowserFrame>

              <FloatingNotification className="absolute -left-6 top-24 hidden animate-in fade-in slide-in-from-left-4 duration-700 lg:block" />
              <FloatingEarnings className="absolute -right-8 bottom-16 hidden animate-in fade-in slide-in-from-right-4 duration-700 lg:block" />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- pikat */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{t(title)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- seksionet kryesore */}
        <section id="si-funksionon" className="mx-auto w-full max-w-6xl px-5 sm:px-6">
          <div className="space-y-20 py-8 sm:space-y-28 sm:py-12">
            {SECTIONS.map(({ tag, tagIcon: TagIcon, title, body, points }, i) => (
              <div
                key={tag}
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <TagIcon className="h-3.5 w-3.5" />
                    {t(tag)}
                  </span>
                  <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                    {t(title)}
                  </h2>
                  <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{t(body)}</p>

                  <ul className="mt-7 space-y-3">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </span>
                        <span className="text-sm">{t(point)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                  {i === 0 ? <PhoneBooking /> : <EarningsPanel />}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ dëshmitë */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex items-center justify-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.testimonialsTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t("landing.testimonialsBody")}
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role }, i) => (
              <figure
                key={i}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <Quote className="h-6 w-6 text-primary/30" />
                <blockquote className="mt-4 flex-1 text-pretty leading-relaxed">
                  {t(quote)}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/20 text-sm font-semibold">
                    {name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t(name)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t(role)}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------------- çmimi */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.pricingTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t("landing.pricingBody")}
            </p>
          </div>

          <div className="relative mx-auto mt-12 max-w-lg">
            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-br from-primary/50 to-emerald-500/40 opacity-60 blur" />
            <div className="relative rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-primary/10">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {t("landing.included")}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {t("landing.perkFree")}
                </span>
              </div>

              <div className="mt-7 flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight tabular-nums">1.000</span>
                <span className="text-lg text-muted-foreground">{t("landing.perMonth")}</span>
              </div>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login?mode=signup"
                className="group mt-8 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/40"
              >
                {t("landing.ctaPrimary")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t("landing.noContract")}
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- faq */}
        <section className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-6 sm:pb-28">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("landing.faqTitle")}
          </h2>

          <div className="mt-12 space-y-3">
            {FAQ.map(([q, a]) => (
              <details
                key={q}
                className="group rounded-2xl border border-border bg-card px-6 py-5 shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold tracking-tight">
                  {t(q)}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{t(a)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------------- cta */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6 sm:pb-28">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-blue-700 px-8 py-16 text-center shadow-2xl shadow-primary/30 sm:px-16">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-emerald-400/20 blur-2xl" />
            </div>

            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {t("landing.finalTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-pretty text-white/80">
                {t("landing.finalBody")}
              </p>
              <Link
                href="/login?mode=signup"
                className="group mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-primary shadow-xl transition-transform hover:scale-[1.02]"
              >
                {t("landing.startFree")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row sm:px-6">
          <div className="text-center sm:text-left">
            <p className="text-lg font-bold tracking-tight">
              Rezervo<span className="text-primary">.al</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              © {new Date().getFullYear()} · {t("landing.madeIn")}
            </p>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("landing.signInFooter")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
