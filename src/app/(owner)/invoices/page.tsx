import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types";
import { InvoicesList } from "./invoices-list";

export const metadata: Metadata = { title: "Faturat" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { business } = await requireBusiness();

  // RLS e kufizon vetë te biznesi i pronarit; `business_id` është vetëm indeks.
  const { data } = await createClient()
    .from("invoices")
    .select("*")
    .eq("business_id", business.id)
    .order("issued_on", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <InvoicesList
      invoices={(data ?? []) as Invoice[]}
      missingNipt={!business.nipt}
      missingAddress={!business.address}
    />
  );
}
