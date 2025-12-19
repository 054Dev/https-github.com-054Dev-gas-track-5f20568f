import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Receipt } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptViewer } from "@/components/ReceiptViewer";

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

interface TemplateSettings {
  companyName: string;
  logoUrl: string | null;
  footerText: string | null;
  showTransactionId: boolean;
  showPaymentMethod: boolean;
  customFields: { label: string; value: string }[];
}

export default function Receipts() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);

  useEffect(() => {
    checkAuth();
    fetchTemplateSettings();
  }, []);

  useEffect(() => {
    if (customerId) {
      loadPayments();
      loadCustomerName();
    }
  }, [customerId]);

  const fetchTemplateSettings = async () => {
    const { data } = await supabase
      .from("receipt_template_settings")
      .select("*")
      .single();
    
    if (data) {
      setTemplateSettings({
        companyName: data.company_name,
        logoUrl: data.logo_url,
        footerText: data.footer_text,
        showTransactionId: data.show_transaction_id,
        showPaymentMethod: data.show_payment_method,
        customFields: [
          data.custom_field_1_label && data.custom_field_1_value
            ? { label: data.custom_field_1_label, value: data.custom_field_1_value }
            : null,
          data.custom_field_2_label && data.custom_field_2_value
            ? { label: data.custom_field_2_label, value: data.custom_field_2_value }
            : null,
          data.custom_field_3_label && data.custom_field_3_value
            ? { label: data.custom_field_3_label, value: data.custom_field_3_value }
            : null,
        ].filter(Boolean) as { label: string; value: string }[],
      });
    }
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!roleData || roleData.role !== "customer") {
      navigate("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setUser({ ...session.user, ...profile, role: roleData.role });

    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", session.user.id)
      .single();

    if (customer) {
      setCustomerId(customer.id);
    }
  };

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

  const downloadReceipt = async (payment: Payment) => {
    const methodName = payment.method === "mpesa" ? "M-Pesa" :
                       payment.method === "airtel-money" ? "Airtel-Money" :
                       payment.method === "cash" ? "Cash" :
                       payment.method === "equity-bank" ? "Equity-Bank" :
                       payment.method === "family-bank" ? "Family-Bank" :
                       payment.method === "kcb" ? "KCB" :
                       payment.method === "cooperative-bank" ? "Cooperative-Bank" :
                       payment.method === "paypal" ? "PayPal" :
                       payment.method;

    const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
    .receipt { border: 2px solid #333; padding: 30px; border-radius: 8px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; color: #666; }
    .section { margin: 20px 0; padding: 15px 0; border-bottom: 1px solid #ddd; }
    .row { display: flex; justify-content: space-between; margin: 10px 0; }
    .label { color: #666; font-size: 14px; }
    .value { font-weight: bold; }
    .amount { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .amount .total { font-size: 32px; font-weight: bold; color: #2563eb; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 2px solid #333; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>FINE GAS LIMITED</h1>
      <p>Payment Receipt</p>
    </div>
    
    <div class="section">
      <div class="row">
        <span class="label">CUSTOMER NAME</span>
        <span class="value">${customerName}</span>
      </div>
      <div class="row">
        <span class="label">DATE & TIME</span>
        <span class="value">${format(new Date(payment.paid_at), "EEEE, MMMM dd, yyyy 'at' HH:mm")}</span>
      </div>
    </div>
    
    <div class="section">
      <div class="row">
        <span class="label">Payment Method</span>
        <span class="value">${methodName}</span>
      </div>
      <div class="row">
        <span class="label">Status</span>
        <span class="value">${payment.payment_status.toUpperCase()}</span>
      </div>
      <div class="row">
        <span class="label">Transaction ID</span>
        <span class="value" style="font-size: 11px;">${payment.transaction_id || payment.reference}</span>
      </div>
    </div>
    
    <div class="amount">
      <div class="label">TOTAL AMOUNT PAID</div>
      <div class="total">KES ${payment.amount_paid.toLocaleString()}</div>
    </div>
    
    <div class="footer">
      <p>Thank you for your payment!</p>
      <p>This is an official receipt from Fine Gas Limited</p>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([receiptHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerName}-${methodName}.html`;
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
      case "equity-bank": return "Equity Bank";
      case "family-bank": return "Family Bank";
      case "kcb": return "KCB Bank";
      case "cooperative-bank": return "Cooperative Bank";
      case "paypal": return "PayPal";
      default: return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <div className="container py-4 md:py-8 px-4 md:px-6 flex-1">
        <div className="mb-4 md:mb-6">
          <BackButton />
        </div>
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 md:h-8 md:w-8" />
            My Receipts
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            View and download your payment receipts
          </p>
        </div>

        {payments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No payment receipts found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {payments.map((payment) => (
              <Card 
                key={payment.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPayment(payment)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        KES {payment.amount_paid.toLocaleString()}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {format(new Date(payment.paid_at), "EEEE, MMMM dd, yyyy 'at' HH:mm")}
                      </CardDescription>
                    </div>
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 items-center justify-between">
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline">
                        {getMethodDisplay(payment.method)}
                      </Badge>
                      <Badge variant={payment.payment_status === "completed" ? "default" : "secondary"}>
                        {payment.payment_status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadReceipt(payment);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
                templateSettings={templateSettings || undefined}
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

      <Footer />
    </div>
  );
}
