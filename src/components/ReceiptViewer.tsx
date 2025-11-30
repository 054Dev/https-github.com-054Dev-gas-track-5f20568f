import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";

interface ReceiptViewerProps {
  customerName: string;
  amount: number;
  method: string;
  date: string;
  transactionId?: string;
  reference?: string;
  status: string;
}

export function ReceiptViewer({
  customerName,
  amount,
  method,
  date,
  transactionId,
  reference,
  status,
}: ReceiptViewerProps) {
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
        <div className="flex justify-center mb-2">
          <Receipt className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">FINE GAS LIMITED</h2>
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
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Payment Method</span>
          <Badge variant="outline" className="font-medium">
            {getMethodDisplay(method)}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={status === "completed" ? "default" : "secondary"}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {(transactionId || reference) && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Transaction ID</p>
            <p className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
              {transactionId || reference}
            </p>
          </div>
        )}
      </div>

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
      <div className="text-center pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          Thank you for your payment!
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          This is an official receipt from Fine Gas Limited
        </p>
      </div>
    </div>
  );
}
