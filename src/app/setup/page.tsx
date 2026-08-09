import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getBusinessForUser, requireUser } from "@/lib/auth";
import { SetupWizard } from "./setup-wizard";

export const metadata: Metadata = { title: "Konfigurimi" };

export default async function SetupPage() {
  const user = await requireUser();
  const business = await getBusinessForUser(user.id);

  // Setup-i bëhet një herë. Nëse biznesi ekziston, ndryshimet bëhen te /settings.
  if (business) redirect("/calendar");

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-5">
          <span className="text-lg font-bold tracking-tight">
            Rezervo<span className="text-primary">.al</span>
          </span>
          <span className="text-sm text-muted-foreground">Konfigurimi</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:py-16">
        <SetupWizard />
      </main>
    </div>
  );
}
