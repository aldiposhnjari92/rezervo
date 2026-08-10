"use server";

import { revalidatePath } from "next/cache";

import { getT } from "@/lib/i18n";
import { createPublicClient } from "@/lib/supabase/public";
import { normalizeAlbanianPhone } from "@/lib/phone";
import { sendWhatsAppReminder } from "@/lib/notifications";

export type CreatedBooking = {
  id: string;
  customer_name: string;
  start_time: string;
  end_time: string;
  service_name: string;
  price: number;
  business_name: string;
};

export type BookingResult =
  | { ok: true; booking: CreatedBooking }
  | { ok: false; error: string };

/**
 * Krijon rezervimin. I gjithë validimi kritik (orari, mbivendosja, formati)
 * bëhet brenda funksionit `create_booking` në Postgres — këtu vetëm
 * përgatisim inputin dhe përkthejmë rezultatin.
 */
export async function submitBooking(input: {
  slug: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
}): Promise<BookingResult> {
  const name = input.customerName.trim();
  if (name.length < 2) return { ok: false, error: getT()("public.nameRequired") };

  const phone = normalizeAlbanianPhone(input.customerPhone);
  if (!phone)
    return { ok: false, error: getT()("err.phone") };

  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime()))
    return { ok: false, error: getT()("public.badTime") };

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_customer_name: name,
    p_customer_phone: phone,
    p_start_time: startTime.toISOString(),
  });

  if (error) {
    console.error("[submitBooking]", error.message);
    return { ok: false, error: getT()("public.bookingFailed") };
  }

  const result = data as { ok: boolean; error?: string; booking?: CreatedBooking };

  if (!result?.ok || !result.booking) {
    return { ok: false, error: result?.error ?? "Nuk u krye dot rezervimi." };
  }

  // V1: mock — vetëm console.log. Këtu do të lidhet WhatsApp API-ja e vërtetë.
  await sendWhatsAppReminder(phone, result.booking.start_time, {
    businessName: result.booking.business_name,
    customerName: result.booking.customer_name,
  });

  // Pronari e sheh menjëherë rezervimin e ri në dashboard.
  revalidatePath("/calendar");

  return { ok: true, booking: result.booking };
}
