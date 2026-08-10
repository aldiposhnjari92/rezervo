"use client";

import { useTransition } from "react";
import { Check, Loader2, Phone, RotateCcw, UserX, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAlbanianPhone } from "@/lib/phone";
import type { BookingStatus, BookingWithService } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateBookingStatus } from "@/lib/actions";
import { useFormat, useT } from "@/lib/i18n/provider";
import { useReadOnly } from "../read-only";

const STATUS_VARIANT: Record<
  BookingStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  confirmed: "default",
  completed: "success",
  cancelled: "secondary",
  no_show: "warning",
};

export function BookingDialog({
  booking,
  onClose,
}: {
  booking: BookingWithService | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const readOnly = useReadOnly();
  const t = useT();
  const fmt = useFormat();

  function changeStatus(status: BookingStatus) {
    if (!booking) return;

    startTransition(async () => {
      const result = await updateBookingStatus(booking.id, status);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        status === "cancelled"
          ? t("booking.cancelled", { name: booking.customer_name })
          : t("booking.marked", { status: fmt.status(status) }),
      );
      onClose();
    });
  }

  const isOpen = booking?.status === "confirmed";
  // Ora e nisjes, jo dita: një takim që nisi 10 minuta më parë ka kaluar.
  // Pas saj mbetet vetëm të shënohet çfarë ndodhi — rikthimi në pritje do të
  // shfaqte "rezervime të ardhshme" për javën e shkuar.
  const hasPassed = booking ? new Date(booking.start_time).getTime() < Date.now() : false;

  return (
    <Dialog open={Boolean(booking)} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="max-w-md">
        {booking && (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3 pr-2">
                <div className="min-w-0">
                  <DialogTitle className="truncate">{booking.customer_name}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {fmt.dayMonthFromInstant(booking.start_time)} ·{" "}
                    {fmt.time(booking.start_time)} – {fmt.time(booking.end_time)}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={STATUS_VARIANT[booking.status]}>
                    {fmt.status(booking.status)}
                  </Badge>
                  {booking.created_by === "owner" && (
                    <Badge variant="secondary">{t("booking.addedByOwner")}</Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-lg border border-border">
              <Row
                label={t("booking.service")}
                value={booking.services?.name ?? t("booking.deletedService")}
              />
              <Row
                label={t("booking.price")}
                value={booking.services ? fmt.price(booking.services.price) : "—"}
              />
              <Row
                label={t("booking.phone")}
                value={
                  booking.customer_phone ? (
                    <a
                      href={`tel:${booking.customer_phone}`}
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span className="tabular-nums">
                        {formatAlbanianPhone(booking.customer_phone)}
                      </span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{t("common.noPhone")}</span>
                  )
                }
                last={!booking.note}
              />
              {booking.note && <Row label={t("booking.note")} value={booking.note} last />}
            </div>

            {readOnly ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
                {t("suspended.bookings")}
              </p>
            ) : isOpen ? (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => changeStatus("completed")}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span className="truncate">{t("booking.markCame")}</span>
                </Button>

                <Button variant="outline" disabled={pending} onClick={() => changeStatus("no_show")}>
                  <UserX className="h-4 w-4" />
                  <span className="truncate">{t("booking.markNoShow")}</span>
                </Button>

                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => changeStatus("cancelled")}
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  <span className="truncate">{t("booking.cancel")}</span>
                </Button>
              </div>
            ) : hasPassed ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
                {t("booking.pastNotice")}
              </p>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => changeStatus("confirmed")}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {t("booking.restore")}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-3 py-2.5",
        !last && "border-b border-border",
      )}
    >
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-right text-sm font-medium">{value}</span>
    </div>
  );
}
