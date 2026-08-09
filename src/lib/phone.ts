/**
 * Numrat celularë shqiptarë: +355 6X XXX XXXX ku X ∈ {67, 68, 69}.
 * Pranojmë çdo formë që shkruan njeriu dhe e normalizojmë në +3556XXXXXXX.
 * (E njëjta logjikë ekziston edhe në SQL, si mbrojtje e fundit.)
 */

export function normalizeAlbanianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");

  let national: string | null = null;

  if (/^\+355\d+$/.test(digits)) national = digits.slice(4);
  else if (/^00355\d+$/.test(digits)) national = digits.slice(5);
  else if (/^355\d+$/.test(digits)) national = digits.slice(3);
  else if (/^0\d+$/.test(digits)) national = digits.slice(1);
  else if (/^\d+$/.test(digits)) national = digits;

  if (!national || !/^6[789]\d{7}$/.test(national)) return null;

  return `+355${national}`;
}

export function isValidAlbanianPhone(raw: string): boolean {
  return normalizeAlbanianPhone(raw) !== null;
}

/** "+355691234567" -> "069 123 4567" (si e lexon një shqiptar) */
export function formatAlbanianPhone(phone: string): string {
  const normalized = normalizeAlbanianPhone(phone);
  if (!normalized) return phone;
  const n = normalized.slice(4); // 6XXXXXXXX
  return `0${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}
