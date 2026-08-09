import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Klient pa sesion/cookies, për faqen publike të rezervimit.
 * Duke mos prekur cookies, Next-i mund ta ruajë faqen në cache.
 * Prek vetëm funksionet SECURITY DEFINER — tabelat janë të mbyllura nga RLS.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
