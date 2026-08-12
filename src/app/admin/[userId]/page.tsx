import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import type { AdminAccount } from "@/lib/admin-types";
import { AccountDetail } from "./account-detail";

export const metadata: Metadata = { title: "Llogaria" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminAccountPage({ params }: { params: { userId: string } }) {
  if (!UUID.test(params.userId)) notFound();

  const supabase = createClient();
  const { data } = await supabase.rpc("admin_account", { p_user_id: params.userId });
  const account = data as AdminAccount | null;

  if (!account) notFound();

  return <AccountDetail account={account} />;
}
