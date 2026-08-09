import { AlertTriangle } from "lucide-react";

import { formatDayMonthFromInstant } from "@/lib/availability";

/**
 * Njoftimi që sheh pronari kur biznesi i është pezulluar.
 *
 * Shirit i vazhdueshëm, jo njoftim te zilja: pezullimi është një GJENDJE, jo një
 * ngjarje. Një njoftim te zilja lexohet një herë dhe zhduket; pronari duhet ta
 * shohë këtë sa herë hap panelin, derisa gjendja të ndryshojë.
 *
 * Shfaqet në çdo faqe të panelit, sepse pronari mund të hyjë kudo.
 */
export function SuspendedBanner({
  suspendedAt,
  reason,
}: {
  suspendedAt: string;
  reason: string | null;
}) {
  return (
    <div
      role="status"
      className="mb-5 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10"
    >
      <div className="flex gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold tracking-tight">Faqja jote publike është offline</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Llogaria jote është pezulluar më{" "}
            <span className="font-medium text-foreground">
              {formatDayMonthFromInstant(suspendedAt)}
            </span>
            . Klientët nuk mund ta hapin linkun tënd dhe nuk pranohen rezervime të reja.
          </p>

          {reason ? (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-background px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Arsyeja</p>
              <p className="mt-1 text-sm">{reason}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nuk është dhënë një arsye e veçantë. Nëse mendon se ka ndodhur një gabim,
              na shkruaj dhe e shohim menjëherë.
            </p>
          )}

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Të dhënat e tua nuk janë prekur.</span>{" "}
            Rezervimet, shërbimet dhe klientët janë të gjitha këtu dhe kthehen sapo llogaria
            të riaktivizohet.
          </p>
        </div>
      </div>
    </div>
  );
}
