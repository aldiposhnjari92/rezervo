import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SESSION_HEADER } from "@/middleware";
import type { Business } from "@/lib/types";

/**
 * Vetëm fushat që përdor vërtet aplikacioni.
 *
 * Jo `User` i Supabase-it: ai objekt është i madh dhe shumica e tij nuk shihet
 * kurrë. Duke e mbajtur këtë listë të shkurtër, përdoruesi i verifikuar hyn
 * lirshëm te një header dhe kursen një shkuardhje rrjeti për çdo faqe.
 */
export type SessionUser = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  name: string | null;
  avatarUrl: string | null;
};

/*
 * ÇDO funksion këtu është i mbështjellë me `cache()` nga React.
 *
 * Layout-i i pronarit dhe faqja brenda tij i thërrasin të njëjtat gjëra —
 * `requireBusiness()` te të dyja, `isPlatformAdmin()` te të dyja. Pa `cache()`
 * secila shkonte vërtet te Supabase, dhe një navigim i vetëm bënte shtatë
 * shkuardhje radhazi. Me ~110ms secila, kjo ishte pjesa më e madhe e pritjes.
 *
 * `cache()` mban vlerën për një kërkesë të vetme, jo mes kërkesave: asnjë
 * përdorues nuk sheh të dhënat e një tjetri.
 */

/**
 * Përdoruesi i kyçur, ose ridrejtim te /login.
 *
 * E lexon nga header-i që vendos middleware-i pasi Supabase e ka verifikuar
 * tashmë në këtë kërkesë. Nëse header-i mungon — një rrugë që middleware-i nuk
 * e mbulon, ose një ndryshim i ardhshëm te matcher-i — bie te `getUser()` i
 * vërtetë. Dështimi është i ngadaltë, jo i pasigurt.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * Si `requireUser()`, por kthen `null` në vend që të ridrejtojë.
 *
 * Server action-et nuk mund të ridrejtojnë te /login pa e humbur mesazhin e
 * gabimit; ato duan një përgjigje, jo një navigim.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const fromMiddleware = readSessionHeader();
  if (fromMiddleware) return fromMiddleware;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    name: typeof meta.full_name === "string" ? meta.full_name : null,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  };
});

function readSessionHeader(): SessionUser | null {
  const raw = headers().get(SESSION_HEADER);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SessionUser;
    return typeof parsed?.id === "string" && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

/** Biznesi i përdoruesit, ose null nëse ende s'ka kaluar nga setup-i. */
export const getBusinessForUser = cache(async (userId: string): Promise<Business | null> => {
  const supabase = createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  return (data as Business | null) ?? null;
});

/** Përdorues + biznes. Nëse biznesi mungon, e çon te wizard-i i setup-it. */
export const requireBusiness = cache(
  async (): Promise<{ user: SessionUser; business: Business }> => {
    const user = await requireUser();
    const business = await getBusinessForUser(user.id);

    if (!business) redirect("/setup");
    return { user, business };
  },
);

/**
 * A është ky përdorues admin platforme?
 *
 * Përgjigjen e jep baza e të dhënave, jo aplikacioni — i njëjti funksion
 * `is_platform_admin()` përdoret edhe brenda RLS-së, ndaj UI-ja dhe të drejtat
 * reale nuk kanë si të ndahen nga njëra-tjetra.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");

  if (error) return false;
  return data === true;
});

/** Faqet e adminit. Kush nuk është admin, merr 404 — jo "ndalohet". */
export const requireAdmin = cache(async (): Promise<SessionUser> => {
  const user = await requireUser();

  if (!(await isPlatformAdmin())) notFound();
  return user;
});
