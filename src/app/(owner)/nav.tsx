"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Scissors, Settings, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Paneli", icon: LayoutDashboard },
  { href: "/calendar", label: "Kalendari", icon: CalendarDays },
  { href: "/customers", label: "Klientët", icon: Users },
  { href: "/services", label: "Shërbimet", icon: Scissors },
  { href: "/settings", label: "Rregullimet", icon: Settings },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

/** Navigimi anësor — vetëm në ekrane të mëdha. */
export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const isActive = useActive();

  return (
    <nav className="space-y-1 px-3">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Shirit i poshtëm — vetëm në telefon. */
export function BottomNav() {
  const isActive = useActive();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
              {label}
            </Link>
          );
        })}
      </div>
      {/* hapësirë për shiritin e gjesteve në iPhone */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
