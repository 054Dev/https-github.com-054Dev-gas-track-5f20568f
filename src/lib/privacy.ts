/**
 * Data minimisation helpers (Kenya Data Protection Act, 2019 — s.25 & s.41).
 * Use these whenever personal data or payment identifiers leave the secure
 * app screens (receipts, PDFs, exports, shared documents).
 */

/** "+254712345678" -> "+254 7•• ••• 678" */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "•••";
  const last = digits.slice(-3);
  const prefix = digits.startsWith("254") ? "+254 " + digits.charAt(3) : digits.slice(0, 2);
  return `${prefix}•• ••• ${last}`;
}

/** "SKJ7H2K9LP" -> "SKJ•••K9LP" (first 3 + last 3: month prefix stays visible) */
export function maskReference(ref?: string | null): string {
  if (!ref) return "";
  const r = ref.trim();
  if (r.length <= 6) return "•".repeat(Math.max(r.length, 4));
  return r.slice(0, 3) + "•".repeat(Math.min(r.length - 6, 6)) + r.slice(-3);
}

export const DATA_PROTECTION_NOTICE =
  "Personal data processed under the Kenya Data Protection Act, 2019. See our Privacy Policy.";
