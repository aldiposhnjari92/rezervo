"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * Ndryshimi i gjuhës.
 *
 * Cookie e zakonshme, jo `httpOnly`: gjuha nuk është sekret, dhe një skript i
 * klientit mund të ketë nevojë ta lexojë. Një vit jetëgjatësi — zgjedhja e
 * gjuhës nuk duhet të harrohet.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  cookies().set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Çdo faqe e vizatuar në server e ka tekstin brenda vetes, ndaj i gjithë
  // pema duhet rivizatuar — jo vetëm rruga aktuale.
  revalidatePath("/", "layout");
}
