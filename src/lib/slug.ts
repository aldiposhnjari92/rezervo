/** Zëvendësime specifike për shqipen përpara heqjes së thekseve. */
const REPLACEMENTS: Record<string, string> = {
  ë: "e",
  Ë: "e",
  ç: "c",
  Ç: "c",
};

/**
 * "Berberi Ilir" -> "berberi-ilir"
 * "Sallon Bukurie Çelësi" -> "sallon-bukurie-celesi"
 */
export function slugify(input: string): string {
  return input
    .trim()
    .replace(/[ëËçÇ]/g, (c) => REPLACEMENTS[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // heq thekset e mbetura
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/**
 * Emra që i përkasin vetë aplikacionit dhe nuk mund të jenë slug biznesi.
 * Faqja publike është /[slug], ndaj një biznes me slug "services" do të
 * mbulohej nga /services dhe s'do të hapej kurrë.
 * (E njëjta listë ekziston edhe si CHECK në SQL.)
 */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "account",
  "calendar",
  "customers",
  "dashboard",
  "help",
  "login",
  "logout",
  "new",
  "pricing",
  "privacy",
  "rezervo",
  "services",
  "settings",
  "setup",
  "signin",
  "signup",
  "static",
  "support",
  "terms",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

/** A e pranon baza e të dhënave këtë slug? (duhet të përputhet me CHECK-un në SQL) */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40;
}

/** Shton një prapashtesë numerike kur slug-u është i zënë: "berberi-ilir-2". */
export function withSuffix(slug: string, n: number): string {
  const suffix = `-${n}`;
  return `${slug.slice(0, 40 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
