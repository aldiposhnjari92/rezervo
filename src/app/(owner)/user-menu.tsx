"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type UserInfo = {
  email: string;
  /** Nga Google, kur hyrja bëhet me të. */
  name: string | null;
  avatarUrl: string | null;
};

/** "ana.hoxha@gmail.com" -> "AH"; "Ana Hoxha" -> "AH". */
function initials(user: UserInfo): string {
  const source = user.name?.trim() || user.email.split("@")[0].replace(/[._-]+/g, " ");
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({
  user,
  isAdmin,
  businessName,
}: {
  user: UserInfo;
  isAdmin: boolean;
  businessName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const label = user.name?.trim() || user.email;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menuja e llogarisë"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-shadow",
          "bg-gradient-to-br from-primary/20 to-emerald-500/20 text-foreground",
          "ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "ring-2 ring-ring",
        )}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto e jashtme nga Google
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          initials(user)
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/20 text-sm font-semibold">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto e jashtme nga Google
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                initials(user)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{label}</p>
              {user.name && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">{businessName}</p>
            </div>
          </div>

          <div className="p-1">
            <MenuLink href="/account" icon={UserRound} onNavigate={() => setOpen(false)}>
              Llogaria ime
            </MenuLink>
            <MenuLink href="/settings" icon={Settings} onNavigate={() => setOpen(false)}>
              Rregullimet
            </MenuLink>
            {isAdmin && (
              <MenuLink href="/admin" icon={ShieldCheck} onNavigate={() => setOpen(false)}>
                Paneli i platformës
              </MenuLink>
            )}
          </div>

          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Dil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  );
}
