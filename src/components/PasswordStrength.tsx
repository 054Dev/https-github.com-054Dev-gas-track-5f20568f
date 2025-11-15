import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    
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
    
    let label = "";
    let color = "";
    
    if (score < 40) {
      label = "Weak";
      color = "text-destructive";
    } else if (score < 60) {
      label = "Fair";
      color = "text-warning";
    } else if (score < 80) {
      label = "Good";
      color = "text-accent";
    } else {
      label = "Strong";
      color = "text-success";
    }
    
    return { score, label, color };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-2">
      <Progress value={strength.score} className="h-2" />
      <p className={`text-sm font-medium ${strength.color}`}>
        Password Strength: {strength.label}
      </p>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Password must contain:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li className={password.length >= 8 ? "text-success" : ""}>
            At least 8 characters
          </li>
          <li className={/[a-z]/.test(password) ? "text-success" : ""}>
            Lowercase letter
          </li>
          <li className={/[A-Z]/.test(password) ? "text-success" : ""}>
            Uppercase letter
          </li>
          <li className={/\d/.test(password) ? "text-success" : ""}>
            Number
          </li>
          <li className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "text-success" : ""}>
            Special character
          </li>
        </ul>
      </div>
    </div>
  );
}
