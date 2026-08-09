import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Gjendja bosh, e njëjtë kudo.
 *
 * Ishte e shkruar me dorë në shtatë vende, me ikona, mbushje dhe rrethime të
 * ndryshme — ndaj "ende asnjë gjë" dukej si faqe tjetër sa herë e ndeshje.
 *
 * `tight` përdoret brenda një kartele ekzistuese, ku rrethimi i dyfishtë do të
 * dukej si gabim.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tight = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        tight
          ? "px-4 py-10"
          : "rounded-2xl border border-dashed border-border bg-card px-6 py-16",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
