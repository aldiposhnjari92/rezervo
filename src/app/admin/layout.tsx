import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 404 për këdo që nuk është admin — as ekzistenca e panelit nuk zbulohet.
  await requireAdmin();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
              <ShieldCheck className="h-4 w-4 text-background" />
            </span>
            <span className="truncate font-semibold tracking-tight">
              Rezervo<span className="text-primary">.al</span>
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Admin
              </span>
            </span>
          </Link>

          <Link
            href="/calendar"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Paneli im</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
