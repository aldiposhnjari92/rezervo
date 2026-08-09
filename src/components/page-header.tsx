/**
 * Koka e faqes — një përcaktim i vetëm i shkallës tipografike.
 *
 * `badges` rri në të njëjtin rresht me titullin (p.sh. "Pezulluar"), sepse janë
 * gjendje e vetë titullit; `action` shkon në skajin tjetër.
 */
export function PageHeader({
  title,
  description,
  badges,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  badges?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {badges}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
