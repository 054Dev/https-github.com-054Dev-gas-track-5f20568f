import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";

interface TemplateSettings {
  companyName?: string;
  logoUrl?: string | null;
  footerText?: string | null;
  showTransactionId?: boolean;
  showPaymentMethod?: boolean;
  customFields?: { label: string; value: string }[];
}

interface ReceiptViewerProps {
  customerName: string;
  amount: number;
  method: string;
  date: string;
  transactionId?: string;
  reference?: string;
  status: string;
  templateSettings?: TemplateSettings;
  pricePerKg?: number;
  totalKg?: number;
}

export function ReceiptViewer({
  customerName,
  amount,
  method,
  date,
  transactionId,
  reference,
  status,
  templateSettings,
  pricePerKg,
  totalKg,
}: ReceiptViewerProps) {
  const settings = {
    companyName: templateSettings?.companyName || "FINE GAS LIMITED",
    logoUrl: templateSettings?.logoUrl || null,
    footerText: templateSettings?.footerText ?? "Thank you for your payment!",
    showTransactionId: templateSettings?.showTransactionId ?? true,
    showPaymentMethod: templateSettings?.showPaymentMethod ?? true,
    customFields: templateSettings?.customFields || [],
  };

  const getMethodDisplay = (method: string) => {
    switch(method) {
      case "mpesa": return "M-Pesa";
      case "airtel-money": return "Airtel Money";
      case "cash": return "Cash";
      case "equity-bank": return "Equity Bank";
      case "family-bank": return "Family Bank";
      case "kcb": return "KCB Bank";
      case "cooperative-bank": return "Cooperative Bank";
      case "paypal": return "PayPal";
      default: return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 space-y-4 shadow-sm">
      {/* Header */}
      <div className="text-center border-b pb-4">
        {settings.logoUrl ? (
          <div className="flex justify-center mb-2">
            <img 
              src={settings.logoUrl} 
              alt="Company Logo" 
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Receipt className="h-8 w-8 text-primary hidden" />
          </div>
        ) : (
          <div className="flex justify-center mb-2">
            <Receipt className="h-8 w-8 text-primary" />
          </div>
        )}
        <h2 className="text-xl font-bold">{settings.companyName}</h2>
        <p className="text-sm text-muted-foreground">Payment Receipt</p>
      </div>

      {/* Customer & Date */}
      <div className="space-y-3 border-b pb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer Name</p>
          <p className="text-lg font-semibold">{customerName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Date & Time</p>
          <p className="text-sm font-medium">{format(new Date(date), "EEEE, MMMM dd, yyyy 'at' HH:mm")}</p>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="space-y-3 border-b pb-4">
        {settings.showPaymentMethod && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Payment Method</span>
            <Badge variant="outline" className="font-medium">
              {getMethodDisplay(method)}
            </Badge>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={status === "completed" ? "default" : "secondary"}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {pricePerKg !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Price per KG</span>
            <span className="text-sm font-medium">KES {pricePerKg.toLocaleString()}</span>
          </div>
        )}

        {totalKg !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total KG</span>
            <span className="text-sm font-medium">{totalKg.toFixed(2)} kg</span>
          </div>
        )}

        {settings.showTransactionId && (transactionId || reference) && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Transaction ID</p>
            <p className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
              {transactionId || reference}
            </p>
          </div>
        )}
      </div>

      {/* Custom Fields */}
      {settings.customFields.length > 0 && (
        <div className="space-y-2 border-b pb-4">
          {settings.customFields.map((field, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{field.label}</span>
              <span className="text-sm font-medium">{field.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Amount */}
      <div className="bg-primary/5 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-muted-foreground">Total Amount Paid</span>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">KES {amount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      {settings.footerText && (
        <div className="text-center pt-4 border-t">
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {settings.footerText}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This is an official receipt from {settings.companyName}
          </p>
        </div>
      )}
    </div>
  );
}
