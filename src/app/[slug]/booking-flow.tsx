"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarOff, Check, Clock, Loader2, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isValidAlbanianPhone } from "@/lib/phone";
import {
  BOOKING_WINDOW_DAYS,
  buildAvailability,
  dayOfMonth,
  formatDayMonth,
  formatDayMonthFromInstant,
  formatDuration,
  formatPrice,
  formatTime,
  todayInTirane,
  upcomingDates,
} from "@/lib/availability";
import {
  DAY_LABELS_SHORT_SQ,
  type PublicBusiness,
  type PublicService,
  type TakenSlot,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { submitBooking, type CreatedBooking } from "./actions";

export function BookingFlow({ business }: { business: PublicBusiness }) {
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

  const dayList = useMemo(
    () => (now ? upcomingDates(windowDays, now) : []),
    [now, windowDays],
  );

  const selectedDay = availability?.find((d) => d.date === date) ?? null;

  /** Kur zgjidhet një shërbim: hap ditën e parë me vende të lira. */
  function chooseService(next: PublicService) {
    setService(next);
    setSlotIso(null);
    setSubmitError(null);

    if (now && taken) {
      const days = buildAvailability({
        workingHours: business.working_hours,
        durationMinutes: next.duration_minutes,
        taken,
        rules,
        days: windowDays,
        now,
      });
      setDate((days.find((d) => d.availableCount > 0) ?? days[0])?.date ?? todayInTirane(now));
    }

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
    if (name.trim().length < 2) nextErrors.name = "Shkruani emrin tuaj.";
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
    <div className="min-h-screen bg-muted/30 pb-32">
      {/* ------------------------------------------------------------ header */}
      <header className="border-b border-border bg-background">
        <div className="container max-w-lg py-6">
          <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Zgjidh shërbimin dhe orën. Pagesa bëhet në dyqan.
          </p>
        </div>
      </header>

      <main className="container max-w-lg space-y-8 py-6">
        {!hasServices ? (
          <EmptyState
            icon={CalendarOff}
            title="Ende nuk pranohen rezervime"
            body="Ky biznes nuk ka shtuar shërbime. Provo sërish më vonë ose kontaktoje me telefon."
          />
        ) : (
          <>
            {/* ------------------------------------------------- 1. shërbimi */}
            <section>
              <SectionTitle step={1} title="Zgjidh shërbimin" />

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
                        "flex w-full items-center justify-between gap-3 rounded-xl border bg-background p-4 text-left transition-colors",
                        selected
                          ? "border-primary ring-1 ring-primary"
                          : "border-border active:bg-muted",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(item.duration_minutes)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-medium tabular-nums">
                          {formatPrice(item.price)}
                        </span>
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
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

            {/* ------------------------------------------------------ 2. ora */}
            {service && (
              <section ref={timeRef} className="scroll-mt-4">
                <SectionTitle step={2} title="Zgjidh orën" />

                {loadError ? (
                  <div className="rounded-xl border border-border bg-background p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nuk u ngarkuan dot oraret e lira.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={loadTakenSlots}>
                      Provo sërish
                    </Button>
                  </div>
                ) : !availability ? (
                  <SlotsSkeleton />
                ) : (
                  <>
                    {/* ditët */}
                    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
                      {dayList.map((day) => {
                        const info = availability.find((d) => d.date === day);
                        const selected = date === day;
                        const disabled = !info || info.availableCount === 0;

                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setDate(day);
                              setSlotIso(null);
                            }}
                            className={cn(
                              "flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background",
                              disabled && "opacity-40",
                            )}
                          >
                            <span className="text-[11px] uppercase tracking-wide">
                              {info ? DAY_LABELS_SHORT_SQ[info.dayKey] : ""}
                            </span>
                            <span className="text-lg font-semibold tabular-nums leading-tight">
                              {dayOfMonth(day)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* orët */}
                    {!selectedDay || selectedDay.isClosed ? (
                      <ClosedNotice text="Mbyllur këtë ditë. Zgjidh një ditë tjetër." />
                    ) : selectedDay.availableCount === 0 ? (
                      <ClosedNotice text="Nuk ka orë të lira këtë ditë. Provo një ditë tjetër." />
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {selectedDay.slots.map((slot) => {
                          const selected = slotIso === slot.iso;
                          return (
                            <button
                              key={slot.iso}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => chooseSlot(slot.iso)}
                              className={cn(
                                "h-11 rounded-lg border text-sm font-medium tabular-nums transition-colors",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : slot.available
                                    ? "border-border bg-background active:bg-muted"
                                    : "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through",
                              )}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* --------------------------------------------------- 3. kontakti */}
            {service && slotIso && (
              <section ref={formRef} className="scroll-mt-4">
                <SectionTitle step={3} title="Të dhënat e tua" />

                <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Emri dhe mbiemri</Label>
                    <Input
                      id="customer-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      placeholder="p.sh. Ana Hoxha"
                      autoComplete="name"
                      maxLength={80}
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">Numri i telefonit</Label>
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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
          <div className="container max-w-lg py-3">
            {submitError && (
              <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                {service.name} · {formatDayMonth(date ?? "")} në {formatTime(slotIso)}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatPrice(service.price)}
              </span>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Konfirmo Rezervimin
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

function SlotsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-14 shrink-0 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

function ClosedNotice({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CalendarOff;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-background px-6 py-14 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
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
  const day = formatDayMonthFromInstant(booking.start_time);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <main className="container flex max-w-lg flex-1 flex-col items-center justify-center py-10">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        </div>

        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Rezervimi u konfirmua!
        </h1>
        <p className="mt-2 flex items-center gap-2 text-center text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4 shrink-0" />
          Do të merrni një kujtesë në WhatsApp.
        </p>

        <div className="mt-7 w-full rounded-xl border border-border bg-background p-5">
          <Row label="Biznesi" value={booking.business_name} />
          <Row label="Shërbimi" value={booking.service_name} />
          <Row label="Data" value={day} />
          <Row
            label="Ora"
            value={`${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`}
          />
          <Row label="Emri" value={booking.customer_name} />
          <Row label="Për të paguar" value={`${formatPrice(booking.price)} (në dyqan)`} last />
        </div>

        {businessPhone && (
          <Button variant="outline" className="mt-4 w-full" asChild>
            <a href={`tel:${businessPhone}`}>
              <Phone className="h-4 w-4" />
              Telefono biznesin
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
