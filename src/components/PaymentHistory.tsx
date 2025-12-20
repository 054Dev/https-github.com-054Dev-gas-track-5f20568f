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
import { ReceiptViewer } from "@/components/ReceiptViewer";
import { downloadReceiptPDF } from "@/lib/pdf-receipt";

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
    downloadReceiptPDF({
      customerName,
      amount: payment.amount_paid,
      method: payment.method,
      date: payment.paid_at,
      transactionId: payment.transaction_id,
      reference: payment.reference,
      status: payment.payment_status,
    });
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
            <DialogDescription>View and download receipt</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <ReceiptViewer
                customerName={customerName}
                amount={selectedPayment.amount_paid}
                method={selectedPayment.method}
                date={selectedPayment.paid_at}
                transactionId={selectedPayment.transaction_id}
                reference={selectedPayment.reference}
                status={selectedPayment.payment_status}
              />
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
