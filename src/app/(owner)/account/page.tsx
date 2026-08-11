import type { Metadata } from "next";

import { isPlatformAdmin, requireBusiness } from "@/lib/auth";
import { AccountForm } from "./account-form";

export const metadata: Metadata = { title: "Llogaria ime" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [{ user }, admin] = await Promise.all([requireBusiness(), isPlatformAdmin()]);

  return (
    <AccountForm
      email={user.email ?? ""}
      createdAt={user.createdAt}
      lastSignInAt={user.lastSignInAt}
      isAdmin={admin}
    />
  );
}
