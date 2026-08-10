import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Mesazhi i vetëm për çdo veprim të bllokuar nga pezullimi.
 *
 * I njëjti tekst kudo: pronari nuk duhet të hamendësojë nëse "nuk u ruajt dot"
 * do të thotë defekt apo ndalim.
 */
export const SUSPENDED_ERROR =
  "Llogaria jote është e pezulluar. Mund t'i shohësh të dhënat, por jo t'i ndryshosh.";

/**
 * Kthen gabimin kur biznesi i përdoruesit është i pezulluar, ose `null` kur
 * gjithçka është në rregull.
 *
 * Kjo NUK është mbrojtja — mbrojtja janë policy-t te `supabase/suspension.sql`,
 * sepse çelësi publik lejon kërkesa direkt te PostgREST pa kaluar nga Next-i.
 * Këtu bëhet vetëm që pronari të marrë një shpjegim në shqip në vend të një
 * "nuk u ruajt dot" të errët — ose, më keq, të një suksesi të rremë: nën RLS
 * një shkrim i ndaluar nuk kthen gabim, thjesht nuk prek asnjë rresht.
 */
export async function suspensionError(): Promise<{ ok: false; error: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesioni skadoi. Hyr sërish." };

  const { data } = await supabase
    .from("businesses")
    .select("suspended_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (data?.suspended_at) return { ok: false, error: SUSPENDED_ERROR };
  return null;
}
