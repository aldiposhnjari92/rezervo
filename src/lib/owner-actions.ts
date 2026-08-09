"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { normalizeAlbanianPhone } from "@/lib/phone";
import { notifyOwnerNewBooking } from "@/lib/notifications";

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
  const name = input.customerName.trim();
  if (name.length < 2) return { ok: false, error: "Shkruaj emrin e klientit." };

  // Telefoni është opsional për walk-in-et, por nëse jepet duhet të jetë i saktë.
  let phone: string | null = null;
  if (input.customerPhone.trim()) {
    phone = normalizeAlbanianPhone(input.customerPhone);
    if (!phone) return { ok: false, error: "Numri nuk është i saktë. Lëre bosh nëse s'e ke." };
  }

  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Ora nuk është e vlefshme." };

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
    return { ok: false, error: "Rezervimi nuk u shtua. Provo sërish." };
  }

  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Rezervimi nuk u shtua." };

  await notifyOwnerNewBooking(phone, {
    customerName: name,
    serviceName: "shtuar me dorë",
    time: start,
  });

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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesioni skadoi. Hyr sërish." };

  const { bufferMinutes, minNoticeMinutes, bookingWindowDays } = input;

  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120)
    return { ok: false, error: "Pushimi mes takimeve duhet 0–120 minuta." };
  if (!Number.isInteger(minNoticeMinutes) || minNoticeMinutes < 0 || minNoticeMinutes > 10080)
    return { ok: false, error: "Njoftimi minimal nuk është i vlefshëm." };
  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays < 1 || bookingWindowDays > 60)
    return { ok: false, error: "Dritarja e rezervimit duhet 1–60 ditë." };

  const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const start = input.breakStart?.trim() || null;
  const end = input.breakEnd?.trim() || null;

  if ((start && !end) || (!start && end))
    return { ok: false, error: "Plotëso të dyja orët e pushimit, ose lëri bosh të dyja." };
  if (start && end) {
    if (!pattern.test(start) || !pattern.test(end))
      return { ok: false, error: "Ora e pushimit nuk është e vlefshme." };
    if (end <= start)
      return { ok: false, error: "Fundi i pushimit duhet të jetë pas fillimit." };
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

  if (error) return { ok: false, error: "Rregullat nuk u ruajtën. Provo sërish." };

  refreshOwnerViews();
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Ditët e mbyllura
// ---------------------------------------------------------------------------

export async function addClosure(input: { date: string; reason?: string }): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { ok: false, error: "Data nuk është e vlefshme." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesioni skadoi. Hyr sërish." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "Krijo fillimisht biznesin." };

  const { error } = await supabase.from("business_closures").insert({
    business_id: business.id,
    closed_on: input.date,
    reason: input.reason?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Kjo datë është tashmë e mbyllur." };
    return { ok: false, error: "Data nuk u shtua. Provo sërish." };
  }

  refreshOwnerViews();
  return { ok: true };
}

export async function removeClosure(id: string): Promise<Result> {
  const supabase = createClient();
  // RLS siguron që preket vetëm biznesi i vet.
  const { error } = await supabase.from("business_closures").delete().eq("id", id);

  if (error) return { ok: false, error: "Data nuk u hoq. Provo sërish." };

  refreshOwnerViews();
  return { ok: true };
}
