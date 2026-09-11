import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "finegas_cookie_consent";
const CLARITY_ID = "w0cpcszmk0";

function loadClarity() {
  if (document.getElementById("clarity-script")) return;
  const w = window as any;
  w.clarity = w.clarity || function (...args: any[]) {
    (w.clarity.q = w.clarity.q || []).push(args);
  };
  const script = document.createElement("script");
  script.id = "clarity-script";
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(script);
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === "accepted") {
      loadClarity();
    } else if (!consent) {
      setVisible(true);
    }
  }, []);

  const choose = (value: "accepted" | "declined") => {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === "accepted") loadClarity();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[100] border-t bg-card shadow-lg"
    >
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            We use strictly necessary storage to keep you signed in, and — only with your consent —
            analytics cookies (Microsoft Clarity) to understand how the platform is used and improve it.
            See our{" "}
            <Link to="/privacy#cookies" className="text-primary underline">
              cookie and privacy policy
            </Link>{" "}
            for details.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 self-end sm:self-auto">
          <Button variant="outline" size="sm" onClick={() => choose("declined")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
