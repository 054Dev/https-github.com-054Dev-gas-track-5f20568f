import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { getPasswordScore } from "@/lib/password-utils";

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    
    const score = getPasswordScore(password);
    
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
      {showRequirements && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Tips for a stronger password:</p>
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
      )}
    </div>
  );
}
