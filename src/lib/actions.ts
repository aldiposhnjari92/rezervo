"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isReservedSlug, isValidSlug } from "@/lib/slug";
import { normalizeAlbanianPhone } from "@/lib/phone";
import { getT } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/sq";
import { suspensionError } from "@/lib/suspension";
import { DAY_KEYS, type BookingStatus, type WorkingHours } from "@/lib/types";

/**
 * Mesazhet e gabimeve në gjuhën e përdoruesit.
 *
 * `getT()` thirret në çastin e përdorimit, jo në ngarkim të modulit: cookie-t
 * ekzistojnë vetëm brenda një kërkese.
 */
const t = (key: DictKey) => getT()(key);

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Tipi i kthimit për veprimet që ridrejtojnë vetë kur ia dalin.
 *
 * `redirect()` hedh një përjashtim që Next-i e përkthen në navigim, ndaj në
 * rastin e suksesit funksioni NUK kthen asgjë — runtime-i i React-it e zgjidh
 * premtimin me `undefined` te klienti. Prandaj: çdo vlerë e kthyer është gabim.
 * Duke e shkruar `| void` te tipi, TypeScript-i e detyron klientin ta kontrollojë.
 */
type ActionError = { ok: false; error: string };

const VALID_STATUSES: BookingStatus[] = ["confirmed", "cancelled", "completed", "no_show"];

/** Pastron dhe validon objektin e orarit përpara se të shkojë në bazë. */
function sanitizeWorkingHours(input: unknown): WorkingHours | null {
  if (typeof input !== "object" || input === null) return null;
  const source = input as Record<string, unknown>;
  const result = {} as WorkingHours;

  for (const day of DAY_KEYS) {
    const value = source[day];
    if (!value || typeof value !== "object") {
      result[day] = null;
      continue;
    }

    const { start, end } = value as { start?: unknown; end?: unknown };
    const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (typeof start !== "string" || typeof end !== "string") return null;
    if (!pattern.test(start) || !pattern.test(end)) return null;
    if (end <= start) return null; // krahasimi si tekst funksionon për "HH:mm"

    result[day] = { start, end };
  }

  return result;
}

// ---------------------------------------------------------------------------
//  Biznesi
// ---------------------------------------------------------------------------

export async function createBusiness(input: {
  name: string;
  slug: string;
  phone: string;
  workingHours: unknown;
}): Promise<ActionError | void> {
  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: t("err.session") };

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();

  if (name.length < 2) return { ok: false, error: t("err.nameShort") };
  if (!isValidSlug(slug))
    return {
      ok: false,
      error: t("err.slugInvalid"),
    };
  if (isReservedSlug(slug))
    return { ok: false, error: t("err.slugReserved") };

  const phone = input.phone.trim() ? normalizeAlbanianPhone(input.phone) : null;
  if (input.phone.trim() && !phone)
    return { ok: false, error: t("err.phone") };

  const workingHours = sanitizeWorkingHours(input.workingHours);
  if (!workingHours) return { ok: false, error: t("err.hours") };

  const { error } = await supabase.from("businesses").insert({
    owner_id: user.id,
    owner_email: user.email,
    name,
    slug,
    phone,
    working_hours: workingHours,
  });

  if (error) {
    if (error.code === "23505") {
      // owner_id unik -> biznesi ekziston; slug unik -> linku është i zënë
      return error.message.includes("owner_id")
        ? { ok: false, error: t("err.businessExists") }
        : { ok: false, error: t("err.slugTaken") };
    }
    return { ok: false, error: t("err.businessSave") };
  }

  // Layout-i i panelit lexon biznesin, ndaj duhet rifreskuar i gjithë pema.
  revalidatePath("/", "layout");

  // Ridrejtimi bëhet KËTU, në server, jo në klient.
  //
  // Më parë klienti bënte `router.replace(...)` menjëherë pas veprimit, ndërsa
  // rirenderimi i faqes /setup — që tani sheh një biznes ekzistues — niste
  // ridrejtimin e vet. Dy navigime njëkohësisht e çonin router-in në gabim
  // ("missing required error components, refreshing...").
  redirect("/services?welcome=1");
}

export async function updateBusiness(input: {
  name: string;
  phone: string;
  workingHours: unknown;
  /** Hyjnë te koka e faturës; të dyja opsionale. */
  nipt?: string;
  address?: string;
}): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: t("err.session") };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: t("err.nameShort") };

  const phone = input.phone.trim() ? normalizeAlbanianPhone(input.phone) : null;
  if (input.phone.trim() && !phone)
    return { ok: false, error: t("err.phone") };

  const workingHours = sanitizeWorkingHours(input.workingHours);
  if (!workingHours) return { ok: false, error: t("err.hours") };

  /**
   * NIPT-i dhe adresa shkruhen VETËM kur dërgohen.
   *
   * Skedat e rregullimeve e thërrasin këtë veprim secila me fushat e veta: skeda
   * e orarit dërgon vetëm orarin. Po t'i kthenim fushat që mungojnë në `null`,
   * ruajtja e orarit do të fshinte NIPT-in e shkruar te skeda tjetër — pa asnjë
   * gabim në ekran, dhe pronari do ta merrte vesh nga një faturë pa kokë.
   */
  const patch: Record<string, unknown> = { name, phone, working_hours: workingHours };

  if (input.nipt !== undefined) {
    // NIPT-i shqiptar: shkronjë, 8 shifra, shkronjë. E njëjta rregull si te baza.
    const nipt = input.nipt.trim().toUpperCase() || null;
    if (nipt && !/^[A-Z][0-9]{8}[A-Z]$/.test(nipt))
      return { ok: false, error: t("err.nipt") };
    patch.nipt = nipt;
  }

  if (input.address !== undefined) {
    const address = input.address.trim() || null;
    if (address && address.length > 160) return { ok: false, error: t("err.address") };
    patch.address = address;
  }

  const { error } = await supabase
    .from("businesses")
    .update(patch)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: t("err.saveFailed") };

  revalidatePath("/calendar", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Shërbimet
// ---------------------------------------------------------------------------

function validateService(input: {
  name: string;
  durationMinutes: number;
  price: number;
}): { ok: true; name: string } | { ok: false; error: string } {
  const name = input.name.trim();

  if (name.length < 2) return { ok: false, error: t("err.serviceName") };
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 5 ||
    input.durationMinutes > 480
  )
    return { ok: false, error: t("err.duration") };
  if (!Number.isInteger(input.price) || input.price < 0)
    return { ok: false, error: t("err.price") };

  return { ok: true, name };
}

export async function createService(input: {
  name: string;
  durationMinutes: number;
  price: number;
}): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: t("err.session") };

  const validation = validateService(input);
  if (!validation.ok) return validation;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: t("err.businessFirst") };

  const { error } = await supabase.from("services").insert({
    business_id: business.id,
    name: validation.name,
    duration_minutes: input.durationMinutes,
    price: input.price,
  });

  if (error) return { ok: false, error: t("err.serviceAdd") };

  revalidatePath("/services");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function updateService(input: {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();

  const validation = validateService(input);
  if (!validation.ok) return validation;

  // RLS siguron që përdoruesi prek vetëm shërbimet e biznesit të vet.
  const { error } = await supabase
    .from("services")
    .update({
      name: validation.name,
      duration_minutes: input.durationMinutes,
      price: input.price,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: t("err.serviceSave") };

  revalidatePath("/services");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function setServiceActive(id: string, isActive: boolean): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const { error } = await supabase.from("services").update({ is_active: isActive }).eq("id", id);

  if (error) return { ok: false, error: t("err.serviceToggle") };

  revalidatePath("/services");
  return { ok: true };
}

export async function deleteService(id: string): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) {
    // on delete restrict -> shërbimi ka rezervime historike
    if (error.code === "23503")
      return {
        ok: false,
        error: t("err.serviceInUse"),
      };
    return { ok: false, error: t("err.serviceDelete") };
  }

  revalidatePath("/services");
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Rezervimet
// ---------------------------------------------------------------------------

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<Result> {
  if (!VALID_STATUSES.includes(status)) return { ok: false, error: t("err.status") };

  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);

  if (error) {
    // 23P01 = exclusion_violation: rikthimi i një rezervimi të anuluar në një orë
    // që ndërkohë e ka zënë dikush tjetër.
    if (error.code === "23P01")
      return { ok: false, error: t("err.slotTaken") };
    // RZ001 = trigger-i i historisë: e kaluara nuk rikthehet dhe nuk zhvendoset.
    if (error.code === "RZ001")
      return {
        ok: false,
        error: t("err.bookingPast"),
      };
    return { ok: false, error: t("err.bookingUpdate") };
  }

  revalidatePath("/calendar");
  return { ok: true };
}
