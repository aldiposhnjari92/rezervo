import Link from "next/link";
import { Check } from "lucide-react";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Hyr" };

/**
 * A është aktivizuar Google te ky projekt Supabase?
 *
 * E pyesim vetë Supabase-in në vend që ta kodojmë me dorë: kështu butoni
 * shfaqet vetëm kur ofruesi është vërtet gati, dhe askush nuk klikon një
 * buton që kthen gabim. Përgjigjja ruhet 5 minuta.
 */
async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

const PROOF = [
  "Një link i vetëm për të gjithë klientët",
  "Oraret e zëna zhduken automatikisht",
  "Kujtesë në WhatsApp para takimit",
  "Të ardhurat, të llogaritura vetë",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { mode?: string; next?: string; error?: string };
}) {
  const initialMode = searchParams.mode === "signup" ? "signup" : "signin";
  const googleEnabled = await isGoogleEnabled();

  return (
    <div className="flex min-h-screen bg-background">
      {/* ------------------------------------------------- paneli i majtë (lg) */}
      <aside className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-blue-700 p-10 xl:p-14 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        </div>

        <Link href="/" className="relative text-lg font-bold tracking-tight text-white">
          Rezervo<span className="text-white/70">.al</span>
        </Link>

        <div className="relative">
          <h2 className="max-w-md text-balance text-4xl font-bold leading-tight tracking-tight text-white">
            Merr rezervime edhe kur je duke punuar.
          </h2>

          <ul className="mt-10 space-y-4">
            {PROOF.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3 text-white" />
                </span>
                <span className="text-white/90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/70">
          Muaji i parë falas · Pa kontratë · Anulo kur të duash
        </p>
      </aside>

      {/* ------------------------------------------------------------ formulari */}
      <div className="flex flex-1 flex-col">
        <header className="border-b border-border lg:hidden">
          <div className="flex h-16 items-center px-5">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Rezervo<span className="text-primary">.al</span>
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 py-12">
          <LoginForm
            initialMode={initialMode}
            next={searchParams.next}
            googleEnabled={googleEnabled}
            oauthError={searchParams.error}
          />
        </main>
      </div>
    </div>
  );
}
