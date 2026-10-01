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

/** "SKJ7H2K9LP" -> "••••••K9LP" (keeps last 4 for customer support lookup) */
export function maskReference(ref?: string | null): string {
  if (!ref) return "";
  const r = ref.trim();
  if (r.length <= 4) return "••••";
  return "•".repeat(Math.min(r.length - 4, 8)) + r.slice(-4);
}

export const DATA_PROTECTION_NOTICE =
  "Personal data processed under the Kenya Data Protection Act, 2019. See our Privacy Policy.";
