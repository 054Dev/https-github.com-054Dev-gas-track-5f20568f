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

  useEffect(() => {
    loadPayments();
  }, [customerId]);

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
    // Generate receipt content
    const receiptContent = `
      FINE GAS LIMITED
      Payment Receipt
      
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
    a.download = `receipt-${payment.reference}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div>Loading payments...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Payment History
        </CardTitle>
        <CardDescription>
          All payment transactions for this customer
        </CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No payments recorded yet
          </p>
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
                        {payment.method === "mpesa" ? "M-Pesa" :
                         payment.method === "airtel-money" ? "Airtel Money" :
                         payment.method === "cash" ? "Cash" :
                         payment.method}
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
  );
}
