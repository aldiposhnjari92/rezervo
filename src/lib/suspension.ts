import "server-only";

import { getT } from "@/lib/i18n";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  const user = await getSessionUser();
  const t = getT();
  if (!user) return { ok: false, error: t("err.session") };

  const { data } = await supabase
    .from("businesses")
    .select("suspended_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (data?.suspended_at) return { ok: false, error: t("err.suspended") };
  return null;
}
