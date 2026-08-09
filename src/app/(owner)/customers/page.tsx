import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CustomerRow } from "@/lib/types";
import { CustomersList } from "./customers-list";

export const metadata: Metadata = { title: "Klientët" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireBusiness();
  const supabase = createClient();

  const { data } = await supabase.rpc("owner_customers");

  return <CustomersList customers={(data ?? []) as CustomerRow[]} />;
}
