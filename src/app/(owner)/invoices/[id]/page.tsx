import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types";
import { InvoiceSheet } from "./invoice-sheet";

export const metadata: Metadata = { title: "Faturë" };
export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  await requireBusiness();

  // RLS lejon vetëm faturat e biznesit të vet; një id i huaj kthen bosh.
  const { data } = await createClient()
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  return <InvoiceSheet invoice={data as Invoice} />;
}
