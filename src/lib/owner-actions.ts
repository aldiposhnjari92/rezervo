"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeAlbanianPhone } from "@/lib/phone";
import { getT } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/sq";
import { suspensionError } from "@/lib/suspension";

/**
 * Mesazhet e gabimeve në gjuhën e përdoruesit.
 *
 * `getT()` thirret në çastin e përdorimit, jo në ngarkim të modulit: cookie-t
 * ekzistojnë vetëm brenda një kërkese.
 */
const t = (key: DictKey) => getT()(key);

type Result = { ok: true } | { ok: false; error: string };

function refreshOwnerViews() {
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/customers");
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
//  Rezervim i shtuar nga pronari (telefonatë ose walk-in)
// ---------------------------------------------------------------------------

export async function createManualBooking(input: {
  serviceId: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  note?: string;
}): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const name = input.customerName.trim();
  if (name.length < 2) return { ok: false, error: t("err.customerName") };

  // Telefoni është opsional për walk-in-et, por nëse jepet duhet të jetë i saktë.
  let phone: string | null = null;
  if (input.customerPhone.trim()) {
    phone = normalizeAlbanianPhone(input.customerPhone);
    if (!phone) return { ok: false, error: t("err.phoneOptional") };
  }

  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) return { ok: false, error: t("err.time") };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("owner_create_booking", {
    p_service_id: input.serviceId,
    p_customer_name: name,
    p_customer_phone: phone,
    p_start_time: start.toISOString(),
    p_note: input.note?.trim() || null,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, error: "Nuk keni leje për këtë veprim." };
    return { ok: false, error: t("err.bookingAdd") };
  }

  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Rezervimi nuk u shtua." };

  /*
    Pa njoftim këtu: rezervimin e shtoi vetë pronari, ndaj s'ka kujt t'i thuhet.
    Klientit i shkruhet me dorë nga kopsa e WhatsApp-it te dialogu i rezervimit.
  */
  refreshOwnerViews();
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Rregullat e rezervimit
// ---------------------------------------------------------------------------

export async function updateBookingRules(input: {
  bufferMinutes: number;
  minNoticeMinutes: number;
  bookingWindowDays: number;
  breakStart: string | null;
  breakEnd: string | null;
}): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: t("err.session") };

  const { bufferMinutes, minNoticeMinutes, bookingWindowDays } = input;

  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120)
    return { ok: false, error: t("err.buffer") };
  if (!Number.isInteger(minNoticeMinutes) || minNoticeMinutes < 0 || minNoticeMinutes > 10080)
    return { ok: false, error: t("err.notice") };
  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays < 1 || bookingWindowDays > 60)
    return { ok: false, error: t("err.window") };

  const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const start = input.breakStart?.trim() || null;
  const end = input.breakEnd?.trim() || null;

  if ((start && !end) || (!start && end))
    return { ok: false, error: t("err.breakBoth") };
  if (start && end) {
    if (!pattern.test(start) || !pattern.test(end))
      return { ok: false, error: t("err.breakTime") };
    if (end <= start)
      return { ok: false, error: t("err.breakOrder") };
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      buffer_minutes: bufferMinutes,
      min_notice_minutes: minNoticeMinutes,
      booking_window_days: bookingWindowDays,
      break_start: start,
      break_end: end,
    })
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: t("err.rulesSave") };

  refreshOwnerViews();
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Ditët e mbyllura
// ---------------------------------------------------------------------------

export async function addClosure(input: { date: string; reason?: string }): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { ok: false, error: t("err.date") };

  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: t("err.session") };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: t("err.businessFirst") };

  const { error } = await supabase.from("business_closures").insert({
    business_id: business.id,
    closed_on: input.date,
    reason: input.reason?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: t("err.closureExists") };
    return { ok: false, error: t("err.closureAdd") };
  }

  refreshOwnerViews();
  return { ok: true };
}

export async function removeClosure(id: string): Promise<Result> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const supabase = createClient();
  // RLS siguron që preket vetëm biznesi i vet.
  const { error } = await supabase.from("business_closures").delete().eq("id", id);

  if (error) return { ok: false, error: t("err.closureRemove") };

  refreshOwnerViews();
  return { ok: true };
}
