import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Një numër me etiketë — blloku bazë i çdo paneli.
 *
 * Ka qenë i shkruar dy herë (te grafikët dhe te lista e klientëve) me radiuse e
 * sipërfaqe të ndryshme, ndaj dy faqe që tregonin të njëjtën gjë nuk dukeshin
 * njëlloj. Tani ka vetëm një.
 */
export function StatTile({
  label,
  value,
  hint,
  trend,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Ndryshimi ndaj periudhës së kaluar, në përqindje. */
  trend?: { percent: number; label: string };
  tone?: "default" | "warning" | "positive";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {typeof value === "number" ? value.toLocaleString("de-DE") : value}
      </p>

      {trend && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            trend.percent >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-amber-700 dark:text-amber-400",
          )}
        >
          {trend.percent >= 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {Math.abs(trend.percent)}% {trend.label}
          </span>
        </p>
      )}

      {hint && !trend && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
