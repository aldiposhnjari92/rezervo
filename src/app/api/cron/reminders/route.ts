import { NextResponse } from "next/server";

import { sendBookingReminder } from "@/lib/notifications";
import { createServiceClient } from "@/lib/supabase/service";
import { whatsappRoute } from "@/lib/whatsapp-messages";

/**
 * Kujtesat para takimit.
 *
 * Aplikacioni nuk ka asgjë që rri e pret orën, ndaj këtë rrugë e thërret diçka
 * nga jashtë — `pg_cron` te Supabase, ose çdo cron falas — një herë në ditë:
 *
 *   curl -X POST https://<domeni>/api/cron/reminders \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Mbrojtja është `CRON_SECRET`. Pa të, rruga është e fikur: një endpoint që i
 * shkruan klientëve nuk mund të rrijë i hapur për këdo.
 *
 * Shënohet si e dërguar VETËM kur mesazhi iku vërtet. Pa çelësat e WhatsApp-it
 * asgjë nuk niset, rezervimi mbetet i pashënuar, dhe pronari e dërgon vetë nga
 * kopsa te dialogu i rezervimit.
 */

export const dynamic = "force-dynamic";

/** Sa përpara njoftohet klienti, në orë. */
const LEAD_HOURS = 24;
/** Gjerësia e dritares: sa shpesh pritet të vijë cron-i. */
const WINDOW_HOURS = 2;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "missing_service_key" }, { status: 503 });
  }

  const now = Date.now();
  const from = new Date(now + LEAD_HOURS * 3_600_000);
  const to = new Date(now + (LEAD_HOURS + WINDOW_HOURS) * 3_600_000);

  const { data, error } = await supabase.rpc("bookings_due_reminder", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) {
    console.error("[cron:reminders]", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  type Due = {
    booking_id: string;
    customer_name: string;
    customer_phone: string;
    start_time: string;
    service_name: string;
    business_name: string;
    business_phone: string | null;
  };

  const due = (data ?? []) as Due[];
  let sent = 0;
  let failed = 0;

  // Në radhë, jo të gjitha njëherësh: Meta i kufizon kërkesat, dhe një ditë
  // normale ka pak kujtesa.
  for (const booking of due) {
    const result = await sendBookingReminder({
      customerName: booking.customer_name,
      customerPhone: booking.customer_phone,
      serviceName: booking.service_name,
      businessName: booking.business_name,
      businessPhone: booking.business_phone,
      time: booking.start_time,
    });

    if (result.sent) {
      sent++;
      await supabase.rpc("mark_reminder_sent", { p_booking_id: booking.booking_id });
    } else {
      failed++;
    }
  }

  return NextResponse.json({
    route: whatsappRoute(),
    due: due.length,
    sent,
    failed,
    window: { from: from.toISOString(), to: to.toISOString() },
  });
}
