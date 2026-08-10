"use client";

import { createContext, useContext } from "react";

/**
 * A është paneli vetëm për lexim (biznes i pezulluar)?
 *
 * Kontekst, jo prop nëpër çdo faqe: gjendjen e di layout-i, ndërsa e përdorin
 * komponentë të thellë — butoni i shërbimit, dialogu i rezervimit, ruajtja te
 * rregullimet. Kalimi prop pas prop-i do të prekte çdo faqe pa i shtuar asgjë.
 *
 * Kjo është VETËM pamje. Ndalimi i vërtetë është te policy-t e bazës
 * (`supabase/suspension.sql`); këtu vetëm nuk i ofrojmë njeriut një buton që
 * do të refuzohej gjithsesi.
 */
const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  return <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>;
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
