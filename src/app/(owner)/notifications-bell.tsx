"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarPlus, CheckCheck, UserX, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatDayMonthFromInstant, formatTime } from "@/lib/availability";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  kind: "booking_new" | "booking_cancelled" | "booking_no_show" | "booking_completed";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const ICONS = {
  booking_new: CalendarPlus,
  booking_cancelled: X,
  booking_no_show: UserX,
  booking_completed: CheckCheck,
} as const;

const TONES = {
  booking_new: "bg-primary/10 text-primary",
  booking_cancelled: "bg-muted text-muted-foreground",
  booking_no_show: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  booking_completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
} as const;

export function NotificationsBell({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, read_at, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20);

    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  // Rezervimet e reja mbërrijnë ndërsa pronari punon — dëgjojmë live.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20));
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  // Mbyll kur klikohet jashtë ose shtypet Escape.
  useEffect(() => {
    if (!open) return;

    function onClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
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

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await createClient().rpc("mark_notifications_read");
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `${unread} njoftime të palexuara` : "Njoftimet"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="font-semibold">Njoftimet</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-sm font-medium text-primary hover:underline"
              >
                Shëno të lexuara
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Asnjë njoftim ende</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "flex gap-3 px-4 py-3",
                        !n.read_at && "bg-primary/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          TONES[n.kind] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{n.title}</p>
                        {n.body && (
                          <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDayMonthFromInstant(n.created_at)} · {formatTime(n.created_at)}
                        </p>
                      </div>

                      {!n.read_at && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
