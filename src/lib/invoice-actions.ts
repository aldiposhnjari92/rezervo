"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/sq";
import { createClient } from "@/lib/supabase/server";
import { suspensionError } from "@/lib/suspension";
import type { Invoice } from "@/lib/types";

/** Si te veprimet e tjera: gjuha lexohet brenda kërkesës, jo në ngarkim. */
const t = (key: DictKey) => getT()(key);

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Lëshon faturën e një rezervimi.
 *
 * Numri jepet nga baza, jo nga këtu: dy tabe të hapura te i njëjti rezervim do
 * të merrnin të njëjtin `max + 1` po ta llogariste aplikacioni. Funksioni në
 * Postgres e merr numrin brenda një `lock`, dhe kthen faturën ekzistuese nëse
 * rezervimi është faturuar tashmë — ndaj butoni mund të klikohet dy herë pa
 * lëshuar dy fatura.
 */
export async function issueBookingInvoice(bookingId: string): Promise<Result<Invoice>> {
  const blocked = await suspensionError();
  if (blocked) return blocked;

  const user = await getSessionUser();
  if (!user) return { ok: false, error: t("err.session") };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("issue_booking_invoice", {
    p_booking_id: bookingId,
  });

  if (error) {
    if (error.message.includes("booking_cancelled"))
      return { ok: false, error: t("err.invoiceCancelled") };
    return { ok: false, error: t("err.invoiceFailed") };
  }

  revalidatePath("/invoices");
  revalidatePath("/calendar");
  return { ok: true, data: data as Invoice };
}
