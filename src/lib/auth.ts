import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

/** Kthen përdoruesin e kyçur ose e çon te /login. */
export async function requireUser(): Promise<User> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
}

/** Biznesi i përdoruesit, ose null nëse ende s'ka kaluar nga setup-i. */
export async function getBusinessForUser(userId: string): Promise<Business | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  return (data as Business | null) ?? null;
}

/** Përdorues + biznes. Nëse biznesi mungon, e çon te wizard-i i setup-it. */
export async function requireBusiness(): Promise<{ user: User; business: Business }> {
  const user = await requireUser();
  const business = await getBusinessForUser(user.id);

  if (!business) redirect("/setup");
  return { user, business };
}

/**
 * A është ky përdorues admin platforme?
 *
 * Përgjigjen e jep baza e të dhënave, jo aplikacioni — i njëjti funksion
 * `is_platform_admin()` përdoret edhe brenda RLS-së, ndaj UI-ja dhe të drejtat
 * reale nuk kanë si të ndahen nga njëra-tjetra.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");

  if (error) return false;
  return data === true;
}

/** Faqet e adminit. Kush nuk është admin, merr 404 — jo "ndalohet". */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();

  if (!(await isPlatformAdmin())) notFound();
  return user;
}
