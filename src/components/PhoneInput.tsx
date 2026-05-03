import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  /** Full phone value, e.g. "+254712345678" */
  value: string;
  onChange: (fullValue: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Default prefix used when value is empty. Defaults to "+254" (Kenya). */
  defaultPrefix?: string;
}

/**
 * Splits a full phone string into a prefix (country code) and the local number.
 * The prefix always starts with "+" and contains 1-4 digits.
 */
function splitPhone(value: string, defaultPrefix: string): { prefix: string; rest: string } {
  const v = (value || "").trim();
  if (!v) return { prefix: defaultPrefix, rest: "" };
  if (v.startsWith("+")) {
    // Use the default prefix length when possible so we don't eat digits
    // that belong to the local number.
    const digits = v.slice(1).replace(/\D/g, "");
    const defaultDigits = defaultPrefix.replace(/\D/g, "");
    if (defaultDigits && digits.startsWith(defaultDigits)) {
      return { prefix: `+${defaultDigits}`, rest: digits.slice(defaultDigits.length) };
    }
    // Fallback: take a reasonable country-code length (1-3 digits) without
    // greedily consuming the local number's leading digit.
    const m = digits.match(/^(\d{1,3})(.*)$/);
    if (m) return { prefix: `+${m[1]}`, rest: m[2] };
    return { prefix: defaultPrefix, rest: digits };
  }
  // No "+" prefix — treat entire value as local number, preserving any
  // leading zero the user may have entered.
  return { prefix: defaultPrefix, rest: v.replace(/\D/g, "") };
}

export function PhoneInput({
  value,
  onChange,
  id,
  required,
  disabled,
  placeholder = "712 345 678",
  className,
  defaultPrefix = "+254",
}: PhoneInputProps) {
  // Locally controlled so that what the user types is exactly what the user
  // sees — digits typed in the local field stay in the local field.
  const [prefix, setPrefix] = useState<string>(() => splitPhone(value, defaultPrefix).prefix);
  const [rest, setRest] = useState<string>(() => splitPhone(value, defaultPrefix).rest);

  // Sync from external value when it changes meaningfully (e.g. initial load).
  useEffect(() => {
    const next = splitPhone(value, defaultPrefix);
    if (`${next.prefix}${next.rest}` !== `${prefix}${rest}`) {
      setPrefix(next.prefix);
      setRest(next.rest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (newPrefix: string, newRest: string) => {
    onChange(`${newPrefix}${newRest}`);
  };

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let p = e.target.value.replace(/[^\d+]/g, "");
    if (!p.startsWith("+")) p = `+${p.replace(/\+/g, "")}`;
    // Limit to + and up to 4 digits
    p = p.slice(0, 5);
    setPrefix(p);
    emit(p, rest);
  };

  const handleRestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow any digits including a leading zero — keep the input verbatim.
    const next = e.target.value.replace(/\D/g, "");
    setRest(next);
    emit(prefix, next);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        type="text"
        value={prefix}
        onChange={handlePrefixChange}
        disabled={disabled}
        className="w-20 text-center"
        aria-label="Country code"
      />
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        value={rest}
        onChange={handleRestChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1"
      />
    </div>
  );
}

/**
 * Returns true if a phone number already exists in customers or profiles tables.
 * Excludes the given user_id when provided (for self-edit checks).
 */
/**
 * Returns the last 9 digits of any phone string. This is the canonical
 * "local digits" form used to detect duplicates regardless of the prefix
 * (whether stored as +254..., 254..., 0..., or another country code).
 */
export function localPhoneDigits(input: string | null | undefined): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  return digits.slice(-9);
}

export async function isPhoneTaken(
  supabaseClient: any,
  fullPhone: string,
  excludeUserId?: string,
): Promise<boolean> {
  const local = localPhoneDigits(fullPhone);
  if (local.length < 9) return false;

  // Pull a small candidate set and compare on the canonical 9-digit form
  // client-side — the DB stores phones with mixed prefixes so a direct
  // equality filter on the raw column is unreliable.
  const [{ data: customers }, { data: profiles }] = await Promise.all([
    supabaseClient
      .from("customers")
      .select("user_id, phone")
      .is("deleted_at", null)
      .not("phone", "is", null)
      .ilike("phone", `%${local}%`)
      .limit(20),
    supabaseClient
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null)
      .ilike("phone", `%${local}%`)
      .limit(20),
  ]);

  const customerHit = (customers || []).some(
    (c: any) => localPhoneDigits(c.phone) === local && (!excludeUserId || c.user_id !== excludeUserId),
  );
  const profileHit = (profiles || []).some(
    (p: any) => localPhoneDigits(p.phone) === local && (!excludeUserId || p.id !== excludeUserId),
  );

  return customerHit || profileHit;
}

/** Returns true if the username already belongs to another account. */
export async function isUsernameTaken(
  supabaseClient: any,
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  const u = (username || "").trim();
  if (!u) return false;

  const [{ data: profiles }, { data: customers }] = await Promise.all([
    supabaseClient.from("profiles").select("id").eq("username", u).limit(5),
    supabaseClient.from("customers").select("user_id").eq("username", u).is("deleted_at", null).limit(5),
  ]);

  const profileHit = (profiles || []).some((p: any) => !excludeUserId || p.id !== excludeUserId);
  const customerHit = (customers || []).some((c: any) => !excludeUserId || c.user_id !== excludeUserId);
  return profileHit || customerHit;
}

/** Returns true if the email already belongs to another customer record. */
export async function isEmailTaken(
  supabaseClient: any,
  email: string,
  excludeUserId?: string,
): Promise<boolean> {
  const e = (email || "").trim().toLowerCase();
  if (!e) return false;
  const { data } = await supabaseClient
    .from("customers")
    .select("user_id")
    .ilike("email", e)
    .is("deleted_at", null)
    .limit(5);
  return (data || []).some((c: any) => !excludeUserId || c.user_id !== excludeUserId);
}