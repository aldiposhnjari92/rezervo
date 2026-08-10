"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isReservedSlug, isValidSlug } from "@/lib/slug";
import { normalizeAlbanianPhone } from "@/lib/phone";
import { suspensionError } from "@/lib/suspension";
import { DAY_KEYS, type BookingStatus, type WorkingHours } from "@/lib/types";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesioni skadoi. Hyr sërish." };

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();

  if (name.length < 2) return { ok: false, error: "Emri i biznesit është shumë i shkurtër." };
  if (!isValidSlug(slug))
    return {
      ok: false,
      error: "Linku lejon vetëm shkronja të vogla, numra dhe vizë (3–40 karaktere).",
    };
  if (isReservedSlug(slug))
    return { ok: false, error: "Ky link është i rezervuar nga sistemi. Zgjidh një tjetër." };

  const phone = input.phone.trim() ? normalizeAlbanianPhone(input.phone) : null;
  if (input.phone.trim() && !phone)
    return { ok: false, error: "Numri i telefonit nuk është i saktë. Shembull: 069 123 4567" };

  const workingHours = sanitizeWorkingHours(input.workingHours);
  if (!workingHours) return { ok: false, error: "Orari i punës nuk është i vlefshëm." };

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
        ? { ok: false, error: "Ke tashmë një biznes të krijuar." }
        : { ok: false, error: "Ky link është i zënë. Provo një tjetër." };
    }
    return { ok: false, error: "Nuk u ruajt dot biznesi. Provo sërish." };
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
}): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesioni skadoi. Hyr sërish." };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Emri i biznesit është shumë i shkurtër." };

  const phone = input.phone.trim() ? normalizeAlbanianPhone(input.phone) : null;
  if (input.phone.trim() && !phone)
    return { ok: false, error: "Numri i telefonit nuk është i saktë. Shembull: 069 123 4567" };

  const workingHours = sanitizeWorkingHours(input.workingHours);
  if (!workingHours) return { ok: false, error: "Orari i punës nuk është i vlefshëm." };

  const { error } = await supabase
    .from("businesses")
    .update({ name, phone, working_hours: workingHours })
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: "Nuk u ruajtën dot ndryshimet. Provo sërish." };

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

  if (name.length < 2) return { ok: false, error: "Shkruaj emrin e shërbimit." };
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 5 ||
    input.durationMinutes > 480
  )
    return { ok: false, error: "Kohëzgjatja duhet të jetë mes 5 dhe 480 minutash." };
  if (!Number.isInteger(input.price) || input.price < 0)
    return { ok: false, error: "Çmimi nuk është i vlefshëm." };

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesioni skadoi. Hyr sërish." };

  const validation = validateService(input);
  if (!validation.ok) return validation;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "Krijo fillimisht biznesin." };

  const { error } = await supabase.from("services").insert({
    business_id: business.id,
    name: validation.name,
    duration_minutes: input.durationMinutes,
    price: input.price,
  });

  if (error) return { ok: false, error: "Nuk u shtua dot shërbimi. Provo sërish." };

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

  if (error) return { ok: false, error: "Nuk u ruajt dot shërbimi. Provo sërish." };

  revalidatePath("/services");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function setServiceActive(id: string, isActive: boolean): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const { error } = await supabase.from("services").update({ is_active: isActive }).eq("id", id);

  if (error) return { ok: false, error: "Nuk u ndryshua dot statusi i shërbimit." };

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
        error: "Ky shërbim ka rezervime të vjetra, ndaj nuk fshihet. Çaktivizoje në vend të kësaj.",
      };
    return { ok: false, error: "Nuk u fshi dot shërbimi." };
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
  if (!VALID_STATUSES.includes(status)) return { ok: false, error: "Status i pavlefshëm." };

  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);

  if (error) {
    // 23P01 = exclusion_violation: rikthimi i një rezervimi të anuluar në një orë
    // që ndërkohë e ka zënë dikush tjetër.
    if (error.code === "23P01")
      return { ok: false, error: "Kjo orë është zënë ndërkohë nga një rezervim tjetër." };
    return { ok: false, error: "Nuk u ndryshua dot rezervimi. Provo sërish." };
  }

  revalidatePath("/calendar");
  return { ok: true };
}
