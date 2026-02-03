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
 * Calculate password strength score
 */
export function getPasswordScore(password: string): number {
  if (!password) return 0;
  
  let score = 0;
  
  // Length
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Lowercase
  if (/[a-z]/.test(password)) score += 15;
  
  // Uppercase
  if (/[A-Z]/.test(password)) score += 15;
  
  // Numbers
  if (/\d/.test(password)) score += 15;
  
  // Special characters
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15;
  
  return score;
}

/**
 * Validate password strength for admins (must be >= "good", i.e. score >= 60)
 * Returns true if password meets admin requirements
 */
export function validateAdminPasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }

  if (/\s/.test(password)) {
    return { valid: false, message: "Password must not contain spaces" };
  }

  const score = getPasswordScore(password);
  
  if (score < 60) {
    return { valid: false, message: "Password must be at least 'Good' strength (uppercase, lowercase, number, and special character recommended)" };
  }

  if (hasEasyPatterns(password)) {
    return { valid: false, message: "Password is too easy to guess" };
  }

  return { valid: true, message: "Password is strong" };
}

/**
 * Basic password validation (for customers - no strength requirement)
 */
export function validateBasicPassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }

  if (/\s/.test(password)) {
    return { valid: false, message: "Password must not contain spaces" };
  }

  return { valid: true, message: "Password accepted" };
}

/**
 * Validate password policy for admins (strict: >= good strength + no personal info)
 */
export function validateAdminPasswordPolicy(password: string, ctx?: PasswordPolicyContext) {
  const base = validateAdminPasswordStrength(password);
  if (!base.valid) return base;

  if (containsPersonalInfo(password, ctx)) {
    return { valid: false, message: "Password must not contain your name, username, email, or phone" };
  }

  return { valid: true, message: "Password is strong" };
}

/**
 * Validate password policy for customers (basic: 8+ chars, no spaces)
 */
export function validateCustomerPasswordPolicy(password: string) {
  return validateBasicPassword(password);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; message: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, message: "Email is required" };
  }
  
  // RFC 5322 compliant email regex (simplified but robust)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  if (!emailRegex.test(email.trim())) {
    return { valid: false, message: "Please enter a valid email address" };
  }
  
  return { valid: true, message: "Email is valid" };
}
