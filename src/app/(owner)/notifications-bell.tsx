"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Bell, CalendarPlus, CheckCheck, RotateCcw, UserX, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { formatDayMonthFromInstant, formatTime } from "@/lib/availability";
import { cn } from "@/lib/utils";

type NotificationKind =
  | "booking_new"
  | "booking_cancelled"
  | "booking_no_show"
  | "booking_completed"
  | "business_suspended"
  | "business_restored";

type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const ICONS: Record<NotificationKind, typeof Bell> = {
  booking_new: CalendarPlus,
  booking_cancelled: X,
  booking_no_show: UserX,
  booking_completed: CheckCheck,
  business_suspended: Ban,
  business_restored: RotateCcw,
};

const TONES: Record<NotificationKind, string> = {
  booking_new: "bg-primary/10 text-primary",
  booking_cancelled: "bg-muted text-muted-foreground",
  booking_no_show: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  booking_completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  business_suspended: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  business_restored: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function NotificationsBell({ businessId }: { businessId: string }) {
  const router = useRouter();
  // Një klient i vetëm: leximi dhe abonimi duhet të ndajnë të njëjtin sesion,
  // përndryshe socket-i lidhet i paautentikuar.
  const [supabase] = useState(() => createClient());

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * ID-të e njoftimeve që i kemi parë tashmë.
   *
   * Ato që ngarkohen nga baza NUK nxjerrin pop-up — përndryshe çdo rifreskim i
   * faqes do të ribënte njoftimet e vjetra. Vetëm ajo që mbërrin live, pasi
   * jemi abonuar, shfaqet si njoftim.
   */
  const seen = useRef<Set<string>>(new Set());

  const unread = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, read_at, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (data ?? []) as Notification[];
    for (const row of rows) seen.current.add(row.id);

    // Bashkohet, jo zëvendësohet: leximi dhe abonimi nisin njëkohësisht, ndaj një
    // njoftim mund të mbërrijë live PARA se kjo pyetje të kthehet. Zëvendësimi do
    // ta fshinte nga lista pikërisht atë që sapo erdhi.
    setItems((prev) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const old of prev) if (!byId.has(old.id)) byId.set(old.id, old);
      return Array.from(byId.values())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20);
    });
    setLoading(false);
  }, [supabase, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Pop-up vetëm për atë që sapo ndodhi. */
  const announce = useCallback((n: Notification) => {
    const options = {
      description: n.body ?? undefined,
      duration: n.kind.startsWith("business_") ? 10_000 : 6_000,
    };

    if (n.kind === "business_suspended" || n.kind === "booking_no_show") toast.warning(n.title, options);
    else if (n.kind === "booking_cancelled") toast(n.title, options);
    else toast.success(n.title, options);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // RLS zbatohet edhe te realtime: pa token-in e përdoruesit, socket-i lidhet
      // si `anon` dhe nuk merr KURRË asnjë ngjarje — pa asnjë gabim të dukshëm.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
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
            const row = payload.new as Notification;

            // Pas një rilidhjeje e njëjta ngjarje mund të vijë dy herë.
            if (seen.current.has(row.id)) return;
            seen.current.add(row.id);

            setItems((prev) => [row, ...prev].slice(0, 20));
            announce(row);
            router.refresh();
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`[notifications] realtime: ${status}`);
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, businessId, router, announce]);

  // Token-i rifreskohet periodikisht; pa këtë socket-i mbetet me një token të skaduar.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

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
    await supabase.rpc("mark_notifications_read");
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
                          <p
                            className={cn(
                              "text-xs text-muted-foreground",
                              n.kind.startsWith("business_") ? "line-clamp-2" : "truncate",
                            )}
                          >
                            {n.body}
                          </p>
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
