import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  /** Full phone value as the user typed it, e.g. "0712345678" or "+254712345678" */
  value: string;
  onChange: (fullValue: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** @deprecated kept for API compatibility */
  defaultPrefix?: string;
}

export function PhoneInput({
  value,
  onChange,
  id,
  required,
  disabled,
  placeholder = "0712345678 or +254712345678",
  className,
}: PhoneInputProps) {
  // Single field. Allow digits, spaces, dashes, and a leading "+".
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    // Keep only digits and an optional leading "+"
    const hasPlus = v.trim().startsWith("+");
    const digits = v.replace(/\D/g, "");
    onChange(hasPlus ? `+${digits}` : digits);
  };

  return (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      value={value || ""}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(className)}
    />
  );
}

/**
 * Canonical normalized form of a phone number. A leading "0" is treated as
 * Kenyan code "254", so "0712345678" and "+254712345678" both normalize to
 * "254712345678". Numbers from different country codes (e.g. "+234...") stay
 * distinct.
 */
export function localPhoneDigits(input: string | null | undefined): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}

export async function isPhoneTaken(
  supabaseClient: any,
  fullPhone: string,
  excludeUserId?: string,
): Promise<boolean> {
  const normalized = localPhoneDigits(fullPhone);
  if (normalized.length < 8) return false;

  // Use the trailing 9 digits as a coarse filter for the LIKE query — that
  // matches both "+254..." and "0..." stored variants — then compare on the
  // fully normalized form client-side.
  const tail = normalized.slice(-9);

  const [{ data: customers }, { data: profiles }] = await Promise.all([
    supabaseClient
      .from("customers")
      .select("user_id, phone")
      .is("deleted_at", null)
      .not("phone", "is", null)
      .ilike("phone", `%${tail}%`)
      .limit(50),
    supabaseClient
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null)
      .ilike("phone", `%${tail}%`)
      .limit(50),
  ]);

  const customerHit = (customers || []).some(
    (c: any) => localPhoneDigits(c.phone) === normalized && (!excludeUserId || c.user_id !== excludeUserId),
  );
  const profileHit = (profiles || []).some(
    (p: any) => localPhoneDigits(p.phone) === normalized && (!excludeUserId || p.id !== excludeUserId),
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