"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

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
}): Promise<Result> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("admin_set_suspended", {
    p_business_id: input.businessId,
    p_suspended: input.suspended,
    p_reason: input.reason ?? null,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, error: "Nuk keni leje për këtë veprim." };
    return { ok: false, error: "Veprimi nuk u krye. Provo sërish." };
  }

  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Veprimi nuk u krye." };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Fshirja e llogarisë nga vetë pronari. Kaskada merret me pjesën tjetër. */
export async function deleteMyAccount(): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_my_account");

  if (error) {
    if (error.code === "42501")
      return { ok: false, error: "Kjo llogari nuk mund të fshihet nga paneli." };
    return { ok: false, error: "Llogaria nuk u fshi. Provo sërish." };
  }

  return { ok: true };
}
