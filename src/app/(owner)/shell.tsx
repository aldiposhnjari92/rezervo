"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight, ExternalLink, ShieldCheck } from "lucide-react";

import { ThemeButton } from "@/components/theme";
import { cn } from "@/lib/utils";
import { BottomNav, SidebarNav } from "./nav";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu, type UserInfo } from "./user-menu";

const STORAGE_KEY = "rezervo-sidebar-collapsed";

export function OwnerShell({
  businessId,
  businessName,
  slug,
  isAdmin,
  user,
  children,
}: {
  businessId: string;
  businessName: string;
  slug: string;
  isAdmin: boolean;
  user: UserInfo;
  children: React.ReactNode;
}) {
  // Nis i hapur dhe lexo preferencën pas montimit — serveri s'e di dot,
  // dhe një supozim i gabuar do të shkaktonte kërcim të layout-it.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* ---------------------------------------------- shtylla anësore (lg+) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center",
            collapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          {!collapsed && (
            <Link href="/dashboard" className="truncate text-base font-semibold tracking-tight">
              Rezervo<span className="text-primary">.al</span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Zgjero menunë" : "Palos menunë"}
            title={collapsed ? "Zgjero" : "Palos"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav collapsed={collapsed} />

          {isAdmin && (
            <>
              <div className="mx-3 my-3 border-t border-border" />
              <div className="px-3">
                <Link
                  href="/admin"
                  title="Paneli i platformës"
                  className={cn(
                    "flex items-center rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">Paneli i platformës</span>}
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border p-3">
          {!collapsed && (
            <>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="truncate text-sm font-medium">{businessName}</p>
                <Link
                  href={`/${slug}`}
                  target="_blank"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <span className="truncate">/{slug}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------ përmbajtja */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-60")}>
        {/* koka */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-16 lg:px-8">
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold leading-tight">{businessName}</p>
              <Link
                href={`/${slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                /{slug}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <Link
              href={`/${slug}`}
              target="_blank"
              className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:flex"
            >
              Shiko faqen publike
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              {isAdmin && (
                <Link
                  href="/admin"
                  aria-label="Paneli i platformës"
                  title="Paneli i platformës"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Link>
              )}
              <NotificationsBell businessId={businessId} />
              <ThemeButton />
              <div className="ml-1">
                <UserMenu user={user} isAdmin={isAdmin} businessName={businessName} />
              </div>
            </div>
          </div>
        </header>

        {/* Kolonë fleksi me lartësi të plotë: faqet që duan gjithë ekranin (kalendari)
            marrin `flex-1`; të tjerat rrinë në lartësinë e tyre natyrale. */}
        <main className="flex min-h-[calc(100dvh-3.5rem)] flex-col px-4 pb-28 pt-5 lg:min-h-[calc(100dvh-4rem)] lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
