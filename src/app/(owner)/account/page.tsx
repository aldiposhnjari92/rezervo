import type { Metadata } from "next";

import { isPlatformAdmin, requireBusiness } from "@/lib/auth";
import { AccountForm } from "./account-form";

export const metadata: Metadata = { title: "Llogaria ime" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user } = await requireBusiness();
  const admin = await isPlatformAdmin();

  return (
    <AccountForm
      email={user.email ?? ""}
      createdAt={user.created_at}
      lastSignInAt={user.last_sign_in_at ?? null}
      isAdmin={admin}
    />
  );
}
