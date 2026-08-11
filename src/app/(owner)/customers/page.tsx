import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CustomerRow } from "@/lib/types";
import { CustomersList } from "./customers-list";

export const metadata: Metadata = { title: "Klientët" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = createClient();

  // `owner_customers` filtron vetë sipas përdoruesit të kyçur; `requireBusiness`
  // është vetëm rojë. Asnjëra nuk e pret tjetrën.
  const [{ business }, { data }] = await Promise.all([
    requireBusiness(),
    supabase.rpc("owner_customers"),
  ]);

  return (
    <CustomersList
      customers={(data ?? []) as CustomerRow[]}
      businessName={business.name}
    />
  );
}
