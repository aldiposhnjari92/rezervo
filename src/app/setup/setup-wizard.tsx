"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkingHoursEditor, validateWorkingHours } from "@/components/working-hours-editor";
import { createClient } from "@/lib/supabase/client";
import { isReservedSlug, isValidSlug, slugify, withSuffix } from "@/lib/slug";
import { isValidAlbanianPhone } from "@/lib/phone";
import { DEFAULT_WORKING_HOURS, type WorkingHours } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createBusiness } from "@/lib/actions";

type SlugState = "idle" | "checking" | "free" | "taken" | "invalid" | "reserved";

export function SetupWizard() {

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [saving, setSaving] = useState(false);

  // Slug-u ndjek emrin derisa përdoruesi ta ndryshojë vetë.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Kontroll i disponueshmërisë me debounce.
  const checkSeq = useRef(0);
  useEffect(() => {
    if (!slug) {
      setSlugState("idle");
      return;
    }
    if (!isValidSlug(slug)) {
      setSlugState("invalid");
      return;
    }
    if (isReservedSlug(slug)) {
      setSlugState("reserved");
      return;
    }

    setSlugState("checking");
    const seq = ++checkSeq.current;

    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_slug_available", { p_slug: slug });

      // Injoro përgjigjet e vjetruara (përdoruesi ka shkruar më tej ndërkohë).
      if (seq !== checkSeq.current) return;

      if (error) setSlugState("idle");
      else setSlugState(data ? "free" : "taken");
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  async function suggestFreeSlug() {
    const base = slugify(name) || "dyqani";
    const supabase = createClient();

    for (let i = 2; i <= 20; i++) {
      const candidate = withSuffix(base, i);
      const { data } = await supabase.rpc("is_slug_available", { p_slug: candidate });
      if (data) {
        setSlugTouched(true);
        setSlug(candidate);
        return;
      }
    }
    toast.error("Provo një emër tjetër për linkun.");
  }

  function goToStepTwo() {
    if (name.trim().length < 2) {
      toast.error("Shkruaj emrin e biznesit.");
      return;
    }
    if (!isValidSlug(slug)) {
      toast.error("Linku lejon vetëm shkronja të vogla, numra dhe vizë (të paktën 3 karaktere).");
      return;
    }
    if (slugState === "taken") {
      toast.error("Ky link është i zënë. Zgjidh një tjetër.");
      return;
    }
    if (isReservedSlug(slug)) {
      toast.error("Ky link është i rezervuar nga sistemi. Zgjidh një tjetër.");
      return;
    }
    if (phone.trim() && !isValidAlbanianPhone(phone)) {
      toast.error("Numri i telefonit nuk është i saktë. Shembull: 069 123 4567");
      return;
    }
    setStep(2);
  }

  async function handleFinish() {
    const hoursError = validateWorkingHours(hours);
    if (hoursError) {
      toast.error(hoursError);
      return;
    }

    setSaving(true);

    // Në sukses, `createBusiness` ridrejton te /services?welcome=1 dhe React-i e
    // zgjidh premtimin me `undefined`. Pra: vlerë e kthyer == gabim. Nuk e ulim
    // `saving` në sukses, që butoni të mos pulsojë ndërsa navigimi është në rrugë.
    const result = await createBusiness({ name, slug, phone, workingHours: hours });

    if (result) {
      toast.error(result.error);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------- progresi */}
      <div className="grid grid-cols-2">
        {[
          { n: 1, label: "Biznesi" },
          { n: 2, label: "Orari" },
        ].map(({ n, label }) => (
          <div
            key={n}
            className={cn(
              "flex items-center gap-3 border-t-[3px] pb-1 pt-3 transition-colors",
              step >= n ? "border-primary" : "border-border",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {step > n ? <Check className="h-3 w-3" /> : n}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                step >= n ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <h1 className="text-balance text-2xl font-bold tracking-tight">Të dhënat e biznesit</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Kjo është ajo që shohin klientët kur hapin linkun tënd.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Emri i biznesit</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p.sh. Berberi Ilir"
                autoFocus
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Linku yt</Label>
              <div className="flex items-center rounded-lg border border-border focus-within:ring-2 focus-within:ring-ring">
                <span className="shrink-0 pl-3 text-sm text-muted-foreground">rezervo.al/</span>
                <input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="berberi-ilir"
                  maxLength={40}
                  className="h-11 w-full min-w-0 bg-transparent px-1 text-base focus:outline-none sm:text-sm"
                />
                <span className="flex w-9 shrink-0 items-center justify-center">
                  {slugState === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {slugState === "free" && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  {(slugState === "taken" ||
                    slugState === "invalid" ||
                    slugState === "reserved") && <X className="h-4 w-4 text-destructive" />}
                </span>
              </div>

              {slugState === "taken" ? (
                <p className="text-sm text-destructive">
                  Ky link është i zënë.{" "}
                  <button
                    type="button"
                    onClick={suggestFreeSlug}
                    className="font-medium underline"
                  >
                    Sugjero një të lirë
                  </button>
                </p>
              ) : slugState === "reserved" ? (
                <p className="text-sm text-destructive">
                  Ky emër i përket sistemit. Provo diçka si &quot;{slugify(name) || "dyqani"}-tirane&quot;.
                </p>
              ) : slugState === "invalid" ? (
                <p className="text-sm text-destructive">
                  Lejohen vetëm shkronja të vogla, numra dhe vizë (të paktën 3 karaktere).
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ky është adresa që u dërgon klientëve. Nuk ndryshohet më vonë.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Telefoni <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="069 123 4567"
              />
            </div>

            <Button
              size="lg"
              className="w-full rounded-full shadow-lg shadow-primary/25"
              onClick={goToStepTwo}
            >
              Vazhdo
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <h1 className="text-balance text-2xl font-bold tracking-tight">Orari i punës</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Klientët do të mund të rezervojnë vetëm brenda këtyre orareve.
            </p>
          </div>

          <div className="space-y-6">
            <WorkingHoursEditor value={hours} onChange={setHours} disabled={saving} />

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(1)}
                disabled={saving}
                className="shrink-0 rounded-full"
              >
                <ArrowLeft className="h-4 w-4" />
                Prapa
              </Button>
              <Button
                size="lg"
                className="flex-1 rounded-full shadow-lg shadow-primary/25"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Krijo dyqanin
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
