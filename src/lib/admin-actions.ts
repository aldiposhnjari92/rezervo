"use server";

import { revalidatePath } from "next/cache";

import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { restorationEmail, suspensionEmail } from "@/lib/email-templates";

type Result = { ok: true } | { ok: false; error: string };

/** Pezullimi kthen edhe nëse pronari u njoftua, që admini ta dijë. */
type SuspendResult =
  | { ok: true; emailSent: boolean; emailTo?: string }
  | { ok: false; error: string };

/**
 * Pezullon ose rikthen një biznes.
 *
 * Leja NUK kontrollohet këtu — kontrollohet brenda `admin_set_suspended()` në
 * Postgres, e cila ngre gabim nëse thirrësi nuk është admin. Kështu edhe një
 * gabim në rrugët e Next-it nuk jep të drejta që s'i ke.
 */
export async function setBusinessSuspended(input: {
  businessId: string;
  suspended: boolean;
  reason?: string;
}): Promise<SuspendResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("admin_set_suspended", {
    p_business_id: input.businessId,
    p_suspended: input.suspended,
    p_reason: input.reason ?? null,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, error: getT()("admin.noPermission") };
    return { ok: false, error: getT()("err.generic") };
  }

  const result = data as {
    ok: boolean;
    error?: string;
    business_name?: string;
    owner_email?: string;
    suspended_reason?: string | null;
  };
  if (!result?.ok) return { ok: false, error: result?.error ?? getT()("err.generic") };

  revalidatePath("/admin", "layout");

  if (!result.owner_email) {
    console.error("[suspension] mungon email-i i pronarit; njoftimi u anashkalua");
    return { ok: true, emailSent: false };
  }

  // Posta është "best effort": veprimi ka ndodhur tashmë dhe mbetet i kryer edhe
  // nëse email-i dështon. Admini e sheh rezultatin dhe vendos vetë.
  //
  // Rikthimi njoftohet po aq sa pezullimi: heshtja pas rikthimit do të thoshte
  // që pronari nuk e di kurrë se faqja i punon sërish.
  const businessName = result.business_name ?? "Biznesi juaj";
  const mail = input.suspended
    ? suspensionEmail({ businessName, reason: result.suspended_reason })
    : restorationEmail({ businessName });

  const delivery = await sendEmail({ to: result.owner_email, ...mail });

  return { ok: true, emailSent: delivery.sent, emailTo: result.owner_email };
}

/** Fshirja e llogarisë nga vetë pronari. Kaskada merret me pjesën tjetër. */
export async function deleteMyAccount(): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_my_account");

  if (error) {
    if (error.code === "42501")
      return { ok: false, error: getT()("account.adminCannotDelete") };
    return { ok: false, error: getT()("account.deleteFailed") };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Faturat e abonimit
// ---------------------------------------------------------------------------

/**
 * Lëshon faturën e abonimit për një muaj.
 *
 * Si te pezullimi, leja kontrollohet brenda funksionit në Postgres, jo këtu.
 * Një muaj jep vetëm një faturë: thirrja e dytë kthen atë që ekziston, ndaj
 * lëshimi dy herë nuk krijon dy numra.
 */
export async function issueSubscriptionInvoice(input: {
  businessId: string;
  /** Çdo datë brenda muajit; funksioni e sjell te dita e parë. */
  periodStart: string;
  amount?: number;
}): Promise<Result> {
  const supabase = createClient();

  const { error } = await supabase.rpc("issue_subscription_invoice", {
    p_business_id: input.businessId,
    p_period_start: input.periodStart,
    p_amount: input.amount ?? 1000,
  });

  if (error) return { ok: false, error: getT()("err.invoiceFailed") };

  revalidatePath("/admin");
  revalidatePath(`/admin/${input.businessId}`);
  revalidatePath("/invoices");
  return { ok: true };
}
