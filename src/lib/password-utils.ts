/**
 * Generate a cryptographically secure random password
 */
export function generateSecurePassword(length: number = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join("");
}

export type PasswordPolicyContext = {
  email?: string;
  username?: string;
  fullName?: string;
  phone?: string;
};

function normalizeForCompare(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getEmailLocalPart(email?: string) {
  if (!email) return "";
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

function containsPersonalInfo(password: string, ctx?: PasswordPolicyContext) {
  if (!ctx) return false;
  const p = normalizeForCompare(password);
  const candidates = [
    ctx.username,
    ctx.fullName,
    ctx.phone,
    ctx.email,
    getEmailLocalPart(ctx.email),
  ]
    .filter(Boolean)
    .map((v) => normalizeForCompare(String(v)))
    .filter((v) => v.length >= 3);

  return candidates.some((c) => c && p.includes(c));
}

function hasEasyPatterns(password: string) {
  const lower = password.toLowerCase();
  const common = ["password", "passw0rd", "qwerty", "admin", "letmein", "welcome"];
  if (common.some((w) => lower.includes(w))) return true;

  // sequences like 1234 / abcd
  if (/(0123|1234|2345|3456|4567|5678|6789)/.test(lower)) return true;
  if (/(abcd|bcde|cdef|defg|efgh|fghi|ghij)/.test(lower)) return true;

  // 4+ same char
  if (/(.)\1\1\1/.test(password)) return true;

  return false;
}

/**
 * Validate password strength (strict)
 * Returns true if password meets requirements
 */
export function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < 12) {
    return { valid: false, message: "Password must be at least 12 characters" };
  }

  if (/\s/.test(password)) {
    return { valid: false, message: "Password must not contain spaces" };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }

  if (!/[!@#$%^&*]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character" };
  }

  if (hasEasyPatterns(password)) {
    return { valid: false, message: "Password is too easy to guess" };
  }

  return { valid: true, message: "Password is strong" };
}

/**
 * Validate password strength + reject passwords that contain personal info.
 * Note: we cannot guarantee whether a password exists online without a breach-check API.
 */
export function validatePasswordPolicy(password: string, ctx?: PasswordPolicyContext) {
  const base = validatePasswordStrength(password);
  if (!base.valid) return base;

  if (containsPersonalInfo(password, ctx)) {
    return { valid: false, message: "Password must not contain your name, username, email, or phone" };
  }

  return { valid: true, message: "Password is strong" };
}
