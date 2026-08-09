import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/lib/types";
import { ServicesManager } from "./services-manager";

export const metadata: Metadata = { title: "Shërbimet" };
export const dynamic = "force-dynamic";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const { business } = await requireBusiness();
  const supabase = createClient();

  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

  return (
    <ServicesManager
      services={(data ?? []) as Service[]}
      showWelcome={searchParams.welcome === "1"}
      slug={business.slug}
    />
  );
}
