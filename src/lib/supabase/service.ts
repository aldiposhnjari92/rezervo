import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Klient me rolin e shërbimit — kalon mbi RLS.
 *
 * Përdoret VETËM nga puna e planifikuar e kujtesave, që nuk ka përdorues të
 * kyçur dhe duhet të shohë rezervimet e të gjitha bizneseve. Çelësi nuk del
 * kurrë te shfletuesi: skedari është `server-only` dhe variabla nuk ka prefiksin
 * `NEXT_PUBLIC_`.
 *
 * Kthen `null` kur çelësi mungon, që thirrësi të përgjigjet qartë në vend që të
 * rrëzohet me një `undefined` diku thellë.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
