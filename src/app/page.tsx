import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  MessageCircle,
  Quote,
  Shield,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import {
  BrowserFrame,
  CalendarSpread,
  EarningsPanel,
  FloatingEarnings,
  FloatingNotification,
  PhoneBooking,
} from "./landing-visual";

const HIGHLIGHTS = [
  { icon: CalendarCheck, title: "Rezervime 24/7", body: "Edhe kur dyqani është mbyllur." },
  { icon: MessageCircle, title: "Kujtesa automatike", body: "Klienti nuk harron më takimin." },
  { icon: BarChart3, title: "Të ardhurat, të qarta", body: "Sa bëri dita, java, muaji." },
  { icon: Shield, title: "Pa komision", body: "Pagesa bëhet në dyqan, te ti." },
];

const SECTIONS = [
  {
    tag: "Për klientët",
    tagIcon: Users,
    title: "Rezervojnë vetë, në 20 sekonda",
    body: "Një link në bio të Instagram-it. Klienti zgjedh shërbimin, sheh vetëm orët e lira dhe konfirmon. Pa aplikacion, pa llogari, pa telefonata në mes të punës.",
    points: [
      "Oraret e zëna zhduken automatikisht",
      "Dy klientë në të njëjtën orë janë të pamundur",
      "Punon njësoj në çdo telefon",
    ],
  },
  {
    tag: "Për ty",
    tagIcon: BarChart3,
    title: "E di saktësisht si po shkon dyqani",
    body: "Të ardhurat e ditës dhe të muajit, shërbimet që sjellin më shumë, oraret që mbushen të parat dhe sa po të kushtojnë klientët që nuk shfaqen.",
    points: [
      "Krahasim automatik me periudhën e kaluar",
      "Shërbimet dhe oraret më të kërkuara",
      "Sa humbet nga mosardhjet",
    ],
  },
];

/*
 * PLACEHOLDER — këto nuk janë dëshmi të vërteta.
 * Zëvendësoji me citime reale (me leje) PARA se ta publikosh faqen,
 * ose hiqe fare seksionin. Mos publiko dëshmi të sajuara.
 */
const TESTIMONIALS = [
  {
    quote:
      "Më parë humbisja dy-tre klientë në javë sepse nuk përgjigjesha në telefon. Tani rezervojnë vetë ndërsa unë punoj.",
    name: "Emri Mbiemri",
    role: "Berber, Tiranë",
  },
  {
    quote:
      "Gjëja që më pëlqen më shumë është që në fund të ditës e di saktësisht sa bëra, pa e llogaritur me dorë.",
    name: "Emri Mbiemri",
    role: "Sallon thonjsh, Durrës",
  },
  {
    quote:
      "Kujtesa në WhatsApp e ka ulur ndjeshëm numrin e klientëve që nuk shfaqen. Vetëm kjo ia vlen.",
    name: "Emri Mbiemri",
    role: "Sallon bukurie, Vlorë",
  },
];

const INCLUDED = [
  "Rezervime dhe shërbime të pakufizuara",
  "Kalendar ditor, javor dhe mujor",
  "Panel me të ardhurat dhe statistikat",
  "Listë klientësh me historikun e plotë",
  "Kujtesa në WhatsApp për klientët",
  "Rezervime me dorë për telefonatat",
  "Ditë pushimi, festa dhe orar dreke",
  "Mbështetje në shqip",
];

const FAQ = [
  [
    "A duhet të shkarkojnë diçka klientët?",
    "Jo. Hapin linkun, zgjedhin orën, shkruajnë emrin dhe numrin. Mbaron aty — pa aplikacion, pa llogari, pa fjalëkalim.",
  ],
  [
    "Po klienti që telefonon ose vjen direkt?",
    "E shton vetë në kalendar me dy prekje. Orari i punës nuk të pengon dhe numri i telefonit nuk është i detyrueshëm.",
  ],
  [
    "A merrni komision nga çmimet e mia?",
    "Asnjë. Pagesa bëhet në dyqan, mes teje dhe klientit. Ne marrim vetëm abonimin mujor prej 1.000 Lek.",
  ],
  [
    "Po kur mbyll për pushime ose festa?",
    "I shënon datat një herë te rregullimet dhe ato ditë zhduken automatikisht nga faqja jote publike.",
  ],
  [
    "A mund ta anuloj kur të dua?",
    "Në çdo moment, pa kontratë dhe pa penalitet. Muaji i parë është falas dhe nuk kërkohet kartë krediti.",
  ],
];

export default function LandingPage() {
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
              Hyr
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              Fillo falas
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
                Ndërtuar për bizneset e vogla shqiptare
              </div>

              <h1 className="mt-7 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Rezervo online,{" "}
                <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                  pa telefonata
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Berber, sallon, dentist apo lavazh — merr rezervime 24 orë në ditë përmes një
                linku të vetëm, dhe humb shumë më pak klientë se sa humbisje dje.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/login?mode=signup"
                  className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/40 sm:w-auto"
                >
                  Krijo dyqanin tënd falas
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="#si-funksionon"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-card px-7 text-sm font-semibold shadow-sm transition-colors hover:bg-muted sm:w-auto"
                >
                  Shiko si funksionon
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Muaji i parë falas
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Pa kartë krediti
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Gati për 2 minuta
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
                <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
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
                    {tag}
                  </span>
                  <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                    {title}
                  </h2>
                  <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{body}</p>

                  <ul className="mt-7 space-y-3">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </span>
                        <span className="text-sm">{point}</span>
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
              Bërë për njerëz që punojnë me duar
            </h2>
            <p className="mt-4 text-muted-foreground">
              Jo për zyra. Për dyqane ku telefoni bie ndërsa ke gërshërët në dorë.
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
                  {quote}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/20 text-sm font-semibold">
                    {name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{role}</span>
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
              Një çmim. Asgjë e fshehur.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sa kushton një klient që nuk erdhi? Ndoshta më shumë se një muaj Rezervo.
            </p>
          </div>

          <div className="relative mx-auto mt-12 max-w-lg">
            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-br from-primary/50 to-emerald-500/40 opacity-60 blur" />
            <div className="relative rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-primary/10">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Gjithçka e përfshirë
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Muaji i parë falas
                </span>
              </div>

              <div className="mt-7 flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight tabular-nums">1.000</span>
                <span className="text-lg text-muted-foreground">Lek / muaj</span>
              </div>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login?mode=signup"
                className="group mt-8 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/40"
              >
                Krijo dyqanin tënd falas
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Pa kontratë · Anulo kur të duash · Pa kartë krediti
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- faq */}
        <section className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-6 sm:pb-28">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Pyetje të shpeshta
          </h2>

          <div className="mt-12 space-y-3">
            {FAQ.map(([q, a]) => (
              <details
                key={q}
                className="group rounded-2xl border border-border bg-card px-6 py-5 shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold tracking-tight">
                  {q}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{a}</p>
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
                Dyqani yt mund të pranojë rezervime sonte
              </h2>
              <p className="mx-auto mt-4 max-w-md text-pretty text-white/80">
                Krijo llogarinë, shto shërbimet, ndaj linkun. Nuk ka hap të katërt.
              </p>
              <Link
                href="/login?mode=signup"
                className="group mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-primary shadow-xl transition-transform hover:scale-[1.02]"
              >
                Fillo falas
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
              © {new Date().getFullYear()} · Bërë në Shqipëri
            </p>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Hyr në llogari
          </Link>
        </div>
      </footer>
    </div>
  );
}
