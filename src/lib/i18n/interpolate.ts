/** `"Përshëndetje {name}"` + `{ name: "Ana" }` -> `"Përshëndetje Ana"`. */
export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole,
  );
}
