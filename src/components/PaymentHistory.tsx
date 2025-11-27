import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Receipt } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Payment {
  id: string;
  amount_paid: number;
  method: string;
  payment_provider: string;
  payment_status: string;
  paid_at: string;
  reference: string;
  transaction_id: string;
}

interface PaymentHistoryProps {
  customerId: string;
  isAdmin?: boolean;
}

export function PaymentHistory({ customerId, isAdmin = false }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [customerName, setCustomerName] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    loadPayments();
    loadCustomerName();
  }, [customerId]);

  const loadCustomerName = async () => {
    const { data } = await supabase
      .from("customers")
      .select("in_charge_name")
      .eq("id", customerId)
      .single();
    
    if (data) {
      setCustomerName(data.in_charge_name);
    }
  };

  const loadPayments = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false });

    if (!error && data) {
      setPayments(data);
    }
    setLoading(false);
  };

  const downloadReceipt = (payment: Payment) => {
    const receiptContent = `
FINE GAS LIMITED
Payment Receipt

Customer: ${customerName}
Transaction ID: ${payment.transaction_id || payment.reference}
Date: ${format(new Date(payment.paid_at), "PPpp")}
Amount: KES ${payment.amount_paid.toLocaleString()}
Method: ${payment.method.toUpperCase()}
Status: ${payment.payment_status.toUpperCase()}

Thank you for your payment!
    `;

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    const methodName = payment.method === "mpesa" ? "M-Pesa" :
                       payment.method === "airtel-money" ? "Airtel-Money" :
                       payment.method === "cash" ? "Cash" :
                       payment.method;
    
    a.download = `${customerName}.${methodName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getMethodDisplay = (method: string) => {
    switch(method) {
      case "mpesa": return "M-Pesa";
      case "airtel-money": return "Airtel Money";
      case "cash": return "Cash";
      default: return method;
    }
  };

  if (loading) {
    return <div>Loading payments...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-xl">
            <Receipt className="h-4 w-4 md:h-5 md:w-5" />
            Payment History
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            All payment transactions for this customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm md:text-base">
              No payments recorded yet
            </p>
          ) : isMobile ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <Card 
                  key={payment.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedPayment(payment)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-base">
                          KES {payment.amount_paid.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.paid_at), "MMM dd, yyyy HH:mm")}
                        </p>
                      </div>
                      <Badge variant={payment.payment_status === "completed" ? "default" : "secondary"}>
                        {payment.payment_status}
                      </Badge>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline" className="text-xs">
                        {getMethodDisplay(payment.method)}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {payment.reference?.substring(0, 16)}...
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {format(new Date(payment.paid_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">
                        KES {payment.amount_paid.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getMethodDisplay(payment.method)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={payment.payment_status === "completed" ? "default" : "secondary"}>
                          {payment.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {payment.reference}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadReceipt(payment)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payment Receipt
            </DialogTitle>
            <DialogDescription>Transaction details</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="text-center border-b pb-3">
                  <p className="text-sm font-semibold">FINE GAS LIMITED</p>
                  <p className="text-xs text-muted-foreground">Payment Receipt</p>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <span className="font-mono text-xs">{selectedPayment.transaction_id || selectedPayment.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{format(new Date(selectedPayment.paid_at), "PPpp")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method:</span>
                    <Badge variant="outline">{getMethodDisplay(selectedPayment.method)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={selectedPayment.payment_status === "completed" ? "default" : "secondary"}>
                      {selectedPayment.payment_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-muted-foreground font-semibold">Amount:</span>
                    <span className="text-xl font-bold text-primary">
                      KES {selectedPayment.amount_paid.toLocaleString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-center text-muted-foreground pt-3 border-t">
                  Thank you for your payment!
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={() => downloadReceipt(selectedPayment)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
