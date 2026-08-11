"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarOff, Check, Clock, Loader2, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { LanguageToggle } from "@/components/language-switcher";
import { MonthCalendar } from "@/components/month-calendar";
import { useFormat, useT } from "@/lib/i18n/provider";
import type { DictKey } from "@/lib/i18n/sq";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isValidAlbanianPhone } from "@/lib/phone";
import {
  BOOKING_WINDOW_DAYS,
  buildAvailability,
  todayInTirane,
} from "@/lib/availability";
import {
  type PublicBusiness,
  type PublicService,
  type TakenSlot,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { submitBooking, type CreatedBooking } from "./actions";

export function BookingFlow({ business }: { business: PublicBusiness }) {
  const t = useT();
  const fmt = useFormat();
  // `now` vendoset vetëm pas montimit: kështu shmangim mospërputhjen server/klient
  // (serveri dhe telefoni nuk e kanë kurrë të njëjtin sekond).
  const [now, setNow] = useState<Date | null>(null);
  const [taken, setTaken] = useState<TakenSlot[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [service, setService] = useState<PublicService | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slotIso, setSlotIso] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreatedBooking | null>(null);

  const timeRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Rregullat vijnë nga biznesi; serveri i rizbaton gjithsesi te create_booking().
  const windowDays = business.booking_window_days || BOOKING_WINDOW_DAYS;
  const rules = useMemo(
    () => ({
      bufferMinutes: business.buffer_minutes,
      minNoticeMinutes: business.min_notice_minutes,
      bookingWindowDays: windowDays,
      breakStart: business.break_start,
      breakEnd: business.break_end,
      closures: business.closures ?? [],
    }),
    [
      business.buffer_minutes,
      business.min_notice_minutes,
      windowDays,
      business.break_start,
      business.break_end,
      business.closures,
    ],
  );

  // ---------------------------------------------------------------- ngarkimi
  async function loadTakenSlots() {
    const supabase = createClient();
    const from = new Date();
    const to = new Date(from.getTime() + (windowDays + 1) * 86_400_000);

    const { data, error } = await supabase.rpc("get_taken_slots", {
      p_business_id: business.id,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });

    if (error) {
      setLoadError(true);
      return;
    }

    setLoadError(false);
    setTaken((data as TakenSlot[]) ?? []);
    setNow(new Date());
  }

  useEffect(() => {
    loadTakenSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id]);

  // ------------------------------------------------------- disponueshmëria
  const availability = useMemo(() => {
    if (!service || !now || !taken) return null;
    return buildAvailability({
      workingHours: business.working_hours,
      durationMinutes: service.duration_minutes,
      taken,
      rules,
      days: windowDays,
      now,
    });
  }, [service, now, taken, business.working_hours, rules, windowDays]);

  /**
   * Kalendari pyet për një datë njëherësh, ndaj lista bëhet hartë: me 30 ditë
   * dritare një `find()` për çdo qelizë do të ishte 42 kalime mbi listën.
   */
  const byDate = useMemo(
    () => new Map((availability ?? []).map((day) => [day.date, day])),
    [availability],
  );

  const selectedDay = date ? (byDate.get(date) ?? null) : null;
  const firstDate = availability?.[0]?.date ?? null;
  const lastDate = availability?.[availability.length - 1]?.date ?? null;
  const anyDayOpen = (availability ?? []).some((day) => day.availableCount > 0);

  /** Mbyllur, e shkuar ose e zënë plot — të gjitha bien njësoj për klientin. */
  const isDayUnavailable = (day: string) => (byDate.get(day)?.availableCount ?? 0) === 0;

  /**
   * Orët ndahen sipas pjesës së ditës: një ditë e plotë jep 24 kopsa gjysmë-ore,
   * dhe një mur i vetëm numrash nuk lexohet dot me sy.
   */
  const slotGroups = useMemo(() => {
    if (!selectedDay || selectedDay.isClosed) return [];
    const groups: { label: DictKey; slots: typeof selectedDay.slots }[] = [
      { label: "public.morning", slots: [] },
      { label: "public.afternoon", slots: [] },
      { label: "public.evening", slots: [] },
    ];

    for (const slot of selectedDay.slots) {
      const hour = Number(slot.label.slice(0, 2));
      groups[hour < 12 ? 0 : hour < 17 ? 1 : 2].slots.push(slot);
    }
    return groups.filter((group) => group.slots.length > 0);
  }, [selectedDay]);

  /**
   * Dita e parë e lirë zgjidhet vetë — por këtu, jo te klikimi i shërbimit.
   *
   * Te klikimi, orët e zëna mund të mos kenë mbërritur ende nga serveri: kush e
   * prekte shërbimin para se të mbaronte kërkesa mbetej pa asnjë ditë të zgjedhur
   * dhe faqja i thoshte "mbyllur këtë ditë" për një ditë që s'e kishte zgjedhur
   * kurrë. Këtu llogaritja ka mbaruar tashmë.
   */
  useEffect(() => {
    if (!availability || date) return;
    const first = availability.find((day) => day.availableCount > 0);
    if (first) setDate(first.date);
  }, [availability, date]);

  function chooseService(next: PublicService) {
    setService(next);
    // Dita e vjetër mund të mos ketë vend për shërbimin e ri; zgjidhet sërish.
    setDate(null);
    setSlotIso(null);
    setSubmitError(null);

    requestAnimationFrame(() =>
      timeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function chooseSlot(iso: string) {
    setSlotIso(iso);
    setSubmitError(null);
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  // ------------------------------------------------------------- dërgimi
  async function handleSubmit() {
    if (!service || !slotIso || submitting) return;

    const nextErrors: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) nextErrors.name = t("public.nameRequired");
    if (!isValidAlbanianPhone(phone)) nextErrors.phone = "Shembull: 069 123 4567";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await submitBooking({
      slug: business.slug,
      serviceId: service.id,
      customerName: name,
      customerPhone: phone,
      startTime: slotIso,
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      // Ndoshta ora u zu ndërkohë — rifreskojmë listën e orëve të lira.
      setSlotIso(null);
      loadTakenSlots();
      return;
    }

    setSuccess(result.booking);
  }

  // ------------------------------------------------------------ SUKSESI
  if (success) {
    return <SuccessScreen booking={success} businessPhone={business.phone} />;
  }

  const hasServices = business.services.length > 0;
  const canSubmit = Boolean(service && slotIso && name.trim() && phone.trim());

  return (
    <div className="min-h-screen bg-muted/30 pb-36">
      {/* ------------------------------------------------------------ header */}
      <header className="relative overflow-hidden border-b border-border bg-card">
        {/* njolla e butë e ngjyrës — e njëjta gjuhë vizuale me faqen e shitjes */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.16),transparent_70%)] blur-2xl"
        />
        <div className="container relative flex max-w-lg items-start justify-between gap-3 py-7">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{business.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("public.tagline")}</p>
          </div>
          <LanguageToggle className="-mr-2 shrink-0" />
        </div>
      </header>

      <main className="container max-w-lg space-y-7 py-6">
        {!hasServices ? (
          <EmptyState
            icon={CalendarOff}
            title={t("public.notAcceptingTitle")}
            description={t("public.notAcceptingBody")}
          />
        ) : (
          <>
            {/* ------------------------------------------------- 1. shërbimi */}
            <section>
              <SectionTitle step={1} title={t("public.step1")} />

              <div className="space-y-2">
                {business.services.map((item) => {
                  const selected = service?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseService(item)}
                      aria-pressed={selected}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-all",
                        selected
                          ? "border-primary shadow-md shadow-primary/10 ring-1 ring-primary"
                          : "border-border shadow-sm hover:border-foreground/20 active:bg-muted",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {fmt.duration(item.duration_minutes)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-medium tabular-nums">
                          {fmt.price(item.price)}
                        </span>
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                            selected ? "border-primary bg-primary" : "border-border",
                          )}
                        >
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ----------------------------------------------------- 2. data */}
            {service && (
              <section ref={timeRef} className="scroll-mt-4">
                <SectionTitle step={2} title={t("public.stepDate")} />

                {loadError ? (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("public.slotsFailed")}
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={loadTakenSlots}>
                      {t("common.retry")}
                    </Button>
                  </div>
                ) : !availability || !firstDate || !lastDate ? (
                  <CalendarSkeleton />
                ) : !anyDayOpen ? (
                  <ClosedNotice text={t("public.noDaysAvailable")} />
                ) : (
                  <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                    {/*
                      Kalendar, jo shiriti i shtatë ditëve: dritarja tani është një
                      muaj, dhe një klient që do "pas dy javësh" duhet ta shohë dot
                      atë ditë pa rrëshqitur nëpër tridhjetë kopsa.
                    */}
                    <MonthCalendar
                      value={date ?? ""}
                      min={firstDate}
                      max={lastDate}
                      isUnavailable={isDayUnavailable}
                      showToday={false}
                      onPick={(day) => {
                        setDate(day);
                        setSlotIso(null);
                      }}
                    />
                  </div>
                )}
              </section>
            )}

            {/* ------------------------------------------------------ 3. ora */}
            {service && availability && anyDayOpen && (
              <section className="scroll-mt-4">
                <SectionTitle step={3} title={t("public.step2")} />

                {!selectedDay || selectedDay.isClosed ? (
                  <ClosedNotice text={t("public.closedDay")} />
                ) : selectedDay.availableCount === 0 ? (
                  <ClosedNotice text={t("public.noSlots")} />
                ) : (
                  <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {fmt.day(selectedDay.dayKey)}, {fmt.dayMonth(selectedDay.date)}
                      </span>
                      {" · "}
                      {t("public.freeSlots", { count: selectedDay.availableCount })}
                    </p>

                    {slotGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t(group.label)}
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {group.slots.map((slot) => {
                            const selected = slotIso === slot.iso;
                            return (
                              <button
                                key={slot.iso}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => chooseSlot(slot.iso)}
                                className={cn(
                                  "h-11 rounded-lg border text-sm font-medium tabular-nums transition-all",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : slot.available
                                      ? "border-border bg-background hover:border-foreground/25 active:bg-muted"
                                      : "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through",
                                )}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* --------------------------------------------------- 3. kontakti */}
            {service && slotIso && (
              <section ref={formRef} className="scroll-mt-4">
                <SectionTitle step={4} title={t("public.step3")} />

                <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">{t("public.fullName")}</Label>
                    <Input
                      id="customer-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      placeholder={t("public.namePlaceholder")}
                      autoComplete="name"
                      maxLength={80}
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">{t("public.phone")}</Label>
                    <Input
                      id="customer-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setErrors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      placeholder="069 123 4567"
                      autoComplete="tel"
                      aria-invalid={Boolean(errors.phone)}
                    />
                    {errors.phone ? (
                      <p className="text-sm text-destructive">{errors.phone}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Do ta përdorim vetëm për kujtesën e takimit.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ------------------------------------------------- shiriti i poshtëm */}
      {hasServices && service && slotIso && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="container max-w-lg py-3">
            {submitError && (
              <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                {service.name} · {fmt.dayMonth(date ?? "")} · {fmt.time(slotIso)}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {fmt.price(service.price)}
              </span>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("public.confirm")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Pjesë ndihmëse
// ---------------------------------------------------------------------------

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
        {step}
      </span>
      <h2 className="font-semibold">{title}</h2>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="mx-auto mb-3 h-5 w-28 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

function ClosedNotice({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SuccessScreen({
  booking,
  businessPhone,
}: {
  booking: CreatedBooking;
  businessPhone: string | null;
}) {
  const t = useT();
  const fmt = useFormat();
  const day = fmt.dayMonthFromInstant(booking.start_time);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <main className="container flex max-w-lg flex-1 flex-col items-center justify-center py-10">
        <SuccessBurst />

        <h1 className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards text-center text-2xl font-semibold tracking-tight delay-300 duration-500">
          {t("public.confirmedTitle")}
        </h1>
        <p className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards mt-2 flex items-center gap-2 text-center text-sm text-muted-foreground delay-[400ms] duration-500">
          <MessageCircle className="h-4 w-4 shrink-0" />
          {t("public.reminderNote")}
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards mt-7 w-full rounded-2xl border border-border bg-card p-5 shadow-sm delay-500 duration-500">
          <Row label={t("public.business")} value={booking.business_name} />
          <Row label={t("public.service")} value={booking.service_name} />
          <Row label={t("public.date")} value={day} />
          <Row
            label={t("public.time")}
            value={`${fmt.time(booking.start_time)} – ${fmt.time(booking.end_time)}`}
          />
          <Row label={t("public.name")} value={booking.customer_name} />
          <Row label={t("public.toPay")} value={fmt.price(booking.price)} last />
        </div>

        {businessPhone && (
          <Button variant="outline" className="mt-4 w-full" asChild>
            <a href={`tel:${businessPhone}`}>
              <Phone className="h-4 w-4" />
              {t("public.callBusiness")}
            </a>
          </Button>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nëse nuk mund të vini, ju lutem njoftoni biznesin sa më parë.
        </p>
      </main>

      <footer className="pb-8 text-center text-xs text-muted-foreground">
        Mundësuar nga <span className="font-medium">Rezervo.al</span>
      </footer>
    </div>
  );
}

/**
 * Momenti i konfirmimit.
 *
 * Rezervimi është e vetmja gjë që klienti erdhi të bëjë, dhe deri tani mbaronte
 * me një shenjë të palëvizshme. Shenja tani vizatohet, unaza shpërndahet dhe
 * pak letra bien — gjysmë sekonde, sa për të thënë "u krye", pa e mbajtur peng.
 *
 * Gjithçka me CSS: asnjë bibliotekë, dhe kush ka kërkuar më pak lëvizje te
 * sistemi nuk merr asgjë prej saj.
 */
function SuccessBurst() {
  return (
    <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
      {/* unaza që shpërndahet nga qendra */}
      <span
        aria-hidden
        className="animate-ring-out motion-reduce:hidden absolute inset-0 rounded-full bg-emerald-500/25"
      />

      {CONFETTI.map((piece, i) => (
        <span
          key={i}
          aria-hidden
          style={piece.style}
          className={cn(
            // Nisen nga qendra, prapa shenjës — pa `left/top` do të binin nga qoshja.
            "animate-confetti motion-reduce:hidden absolute left-1/2 top-1/2 h-2 w-2 rounded-[2px]",
            piece.color,
          )}
        />
      ))}

      <span className="animate-badge-pop motion-reduce:animate-none relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        >
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            // 32 ≈ gjatësia e vijës; vizatimi nis nga fundi i saj.
            strokeDasharray="32"
            className="animate-check-draw motion-reduce:animate-none"
          />
        </svg>
      </span>
    </div>
  );
}

/** Drejtimi jepet si variabla CSS, të cilat `CSSProperties` nuk i njeh vetë. */
type ConfettiStyle = React.CSSProperties & Record<"--dx" | "--dy" | "--spin", string>;

/**
 * Drejtimi i secilës letër është i fiksuar — rastësia do të ndryshonte çdo render.
 *
 * Distancat janë më të gjata se rrezja e shenjës (32px): përndryshe letrat e
 * kalojnë gjithë jetën e tyre pas saj dhe nuk shihet asnjëra.
 */
const CONFETTI: { style: ConfettiStyle; color: string }[] = [
  { style: { "--dx": "-84px", "--dy": "-62px", "--spin": "180deg", animationDelay: "160ms" }, color: "bg-emerald-500" },
  { style: { "--dx": "80px", "--dy": "-54px", "--spin": "-160deg", animationDelay: "210ms" }, color: "bg-primary" },
  { style: { "--dx": "-96px", "--dy": "32px", "--spin": "140deg", animationDelay: "260ms" }, color: "bg-amber-400" },
  { style: { "--dx": "94px", "--dy": "44px", "--spin": "-200deg", animationDelay: "230ms" }, color: "bg-emerald-400" },
  { style: { "--dx": "-32px", "--dy": "-94px", "--spin": "120deg", animationDelay: "300ms" }, color: "bg-primary/70" },
  { style: { "--dx": "40px", "--dy": "-88px", "--spin": "-120deg", animationDelay: "180ms" }, color: "bg-amber-500" },
];

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2.5",
        !last && "border-b border-border",
      )}
    >
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
