import { useMemo } from "react";
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
    // Match leading + plus 1-4 digits as country code
    const m = v.match(/^(\+\d{1,4})(.*)$/);
    if (m) return { prefix: m[1], rest: m[2].replace(/\D/g, "") };
    return { prefix: defaultPrefix, rest: v.replace(/\D/g, "") };
  }
  // No prefix in value — treat entire value as local number
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
  const { prefix, rest } = useMemo(() => splitPhone(value, defaultPrefix), [value, defaultPrefix]);

  const emit = (newPrefix: string, newRest: string) => {
    const cleanedRest = newRest.replace(/\D/g, "");
    // Strip a leading 0 that users sometimes type after the prefix
    const normalizedRest = cleanedRest.replace(/^0+/, "");
    onChange(`${newPrefix}${normalizedRest}`);
  };

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let p = e.target.value.replace(/[^\d+]/g, "");
    if (!p.startsWith("+")) p = `+${p.replace(/\+/g, "")}`;
    // Limit to + and up to 4 digits
    p = p.slice(0, 5);
    emit(p, rest);
  };

  const handleRestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    emit(prefix, e.target.value);
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
export async function isPhoneTaken(
  supabaseClient: any,
  fullPhone: string,
  excludeUserId?: string,
): Promise<boolean> {
  if (!fullPhone || fullPhone.length < 4) return false;
  const variants = [fullPhone, fullPhone.replace(/^\+/, ""), fullPhone.replace(/^\+254/, "0")];
  const orFilter = variants.map((p) => `phone.eq.${p}`).join(",");

  const customerQuery = supabaseClient.from("customers").select("user_id").or(orFilter).is("deleted_at", null).limit(5);
  const profileQuery = supabaseClient.from("profiles").select("id").or(orFilter).limit(5);

  const [{ data: customers }, { data: profiles }] = await Promise.all([customerQuery, profileQuery]);

  const customerHit = (customers || []).some((c: any) => !excludeUserId || c.user_id !== excludeUserId);
  const profileHit = (profiles || []).some((p: any) => !excludeUserId || p.id !== excludeUserId);

  return customerHit || profileHit;
}