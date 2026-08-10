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
import { formatDayMonthFromInstant, formatPrice, formatTime } from "@/lib/availability";
import { formatAlbanianPhone } from "@/lib/phone";
import { STATUS_LABELS_SQ, type BookingStatus, type BookingWithService } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateBookingStatus } from "@/lib/actions";
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
          ? `Rezervimi i ${booking.customer_name} u anulua.`
          : `U shënua si "${STATUS_LABELS_SQ[status]}".`,
      );
      onClose();
    });
  }

  const isOpen = booking?.status === "confirmed";

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
                    {formatDayMonthFromInstant(booking.start_time)} ·{" "}
                    {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={STATUS_VARIANT[booking.status]}>
                    {STATUS_LABELS_SQ[booking.status]}
                  </Badge>
                  {booking.created_by === "owner" && (
                    <Badge variant="secondary">Shtuar nga ti</Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-lg border border-border">
              <Row label="Shërbimi" value={booking.services?.name ?? "Shërbim i fshirë"} />
              <Row
                label="Çmimi"
                value={booking.services ? formatPrice(booking.services.price) : "—"}
              />
              <Row
                label="Telefoni"
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
                    <span className="text-muted-foreground">Pa numër</span>
                  )
                }
                last={!booking.note}
              />
              {booking.note && <Row label="Shënim" value={booking.note} last />}
            </div>

            {readOnly ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
                Llogaria është e pezulluar — rezervimet shihen, por nuk ndryshohen.
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
                  <span className="truncate">Erdhi</span>
                </Button>

                <Button variant="outline" disabled={pending} onClick={() => changeStatus("no_show")}>
                  <UserX className="h-4 w-4" />
                  <span className="truncate">Nuk erdhi</span>
                </Button>

                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => changeStatus("cancelled")}
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  <span className="truncate">Anulo</span>
                </Button>
              </div>
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
                Rikthe si të konfirmuar
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
