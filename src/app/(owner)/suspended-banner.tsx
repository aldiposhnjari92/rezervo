import { AlertTriangle } from "lucide-react";

import { getFormat, getT } from "@/lib/i18n";

/**
 * Njoftimi që sheh pronari kur biznesi i është pezulluar.
 *
 * Shirit i vazhdueshëm, jo njoftim te zilja: pezullimi është një GJENDJE, jo një
 * ngjarje. Zilja lexohet një herë dhe zhduket; kjo duhet të rrijë derisa gjendja
 * të ndryshojë.
 *
 * I mbajtur i ulët me qëllim. Versioni i parë zinte gjysmën e ekranit dhe e
 * shtynte poshtë gjithë panelin — një lajm i keq nuk bëhet më i qartë duke u
 * bërë më i madh, thjesht e bën mjetin të papërdorshëm.
 */
export function SuspendedBanner({
  suspendedAt,
  reason,
}: {
  suspendedAt: string;
  reason: string | null;
}) {
  const t = getT();
  const fmt = getFormat();

  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />

      <p className="min-w-0 flex-1 text-sm leading-relaxed">
        <span className="font-semibold">{t("suspended.title")}</span>
        <span className="text-muted-foreground">
          {" "}
          {t("suspended.body", { date: fmt.dayMonthFromInstant(suspendedAt) })}
        </span>
        {reason && (
          <>
            {" "}
            <span className="text-muted-foreground">{t("suspended.reason")}</span>{" "}
            <span className="font-medium">{reason}</span>
          </>
        )}
      </p>
    </div>
  );
}
