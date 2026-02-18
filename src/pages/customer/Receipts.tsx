import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { SubNav } from "@/components/SubNav";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Receipt, Plus, FileText } from "lucide-react";
import { format } from "date-fns";
import { downloadReceiptPDF } from "@/lib/pdf-receipt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptViewer } from "@/components/ReceiptViewer";
import { PayNowDropdown } from "@/components/PayNowDropdown";
import { ReceiptDateFilter, DateFilterType } from "@/components/ReceiptDateFilter";

interface Payment {
  id: string;
  amount_paid: number;
  method: string;
  payment_provider: string;
  payment_status: string;
  paid_at: string;
  reference: string;
  transaction_id: string;
  delivery_id: string | null;
  notes?: string;
}

interface DeliveryData {
  total_kg: number;
  price_per_kg_at_time: number;
  total_charge: number;
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
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentDeliveryData, setPaymentDeliveryData] = useState<DeliveryData | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [liveCustomerDebt, setLiveCustomerDebt] = useState(0);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [filterType, setFilterType] = useState<DateFilterType>("today");
  const [showAll, setShowAll] = useState(false);

  // Suppress unused warning
  void filterType;

  useEffect(() => {
    checkAuth();
    fetchTemplateSettings();
  }, []);

  useEffect(() => {
    if (customerId) {
      loadAllPayments();
      loadCustomerInfo();
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      loadFilteredPayments();
    }
  }, [customerId, dateRange, showAll]);

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
    setLoading(false);
  };

  const loadCustomerInfo = async () => {
    const { data } = await supabase
      .from("customers")
      .select("in_charge_name, arrears_balance")
      .eq("id", customerId)
      .single();

    if (data) {
      setCustomerName(data.in_charge_name);
      setLiveCustomerDebt(data.arrears_balance || 0);
    }
  };

  const loadAllPayments = async () => {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false });
    setAllPayments(data || []);
  };

  const loadFilteredPayments = async () => {
    setIsLoadingData(true);
    try {
      if (showAll) {
        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("customer_id", customerId)
          .order("paid_at", { ascending: false });
        setPayments(data || []);
      } else if (dateRange) {
        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("customer_id", customerId)
          .gte("paid_at", dateRange.start.toISOString())
          .lte("paid_at", dateRange.end.toISOString())
          .order("paid_at", { ascending: false });
        setPayments(data || []);
      } else {
        // Default: today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("customer_id", customerId)
          .gte("paid_at", today.toISOString())
          .lte("paid_at", endOfDay.toISOString())
          .order("paid_at", { ascending: false });
        setPayments(data || []);
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleDateFilterChange = (range: { start: Date; end: Date } | null, type: DateFilterType) => {
    setDateRange(range);
    setFilterType(type);
    setShowAll(false);
  };

  const fetchPaymentDeliveryData = async (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentDeliveryData(null);

    // Refresh live customer debt
    const { data: customerData } = await supabase
      .from("customers")
      .select("arrears_balance")
      .eq("id", customerId)
      .single();

    if (customerData) {
      setLiveCustomerDebt(customerData.arrears_balance || 0);
    }

    if (payment.delivery_id) {
      const { data: deliveryData } = await supabase
        .from("deliveries")
        .select("total_kg, price_per_kg_at_time, total_charge")
        .eq("id", payment.delivery_id)
        .single();

      if (deliveryData) {
        setPaymentDeliveryData(deliveryData);
      }
    }
  };

  const downloadReceipt = (
    payment: Payment,
    deliveryData?: DeliveryData | null,
    debt?: number
  ) => {
    downloadReceiptPDF({
      customerName,
      amount: payment.amount_paid,
      method: payment.method,
      date: payment.paid_at,
      transactionId: payment.transaction_id,
      reference: payment.reference,
      status: payment.payment_status,
      templateSettings: templateSettings || undefined,
      pricePerKg: deliveryData?.price_per_kg_at_time,
      totalKg: deliveryData?.total_kg,
      customerDebt: debt ?? liveCustomerDebt,
      orderCost: deliveryData?.total_charge,
    });
  };

  const downloadAllReceipts = () => {
    const displayedPayments = showAll ? allPayments : payments;
    const content = displayedPayments
      .map(
        (p) =>
          `Receipt\nCustomer: ${customerName}\nAmount: KES ${p.amount_paid}\nMethod: ${p.method}\nDate: ${format(new Date(p.paid_at), "PPP")}\nRef: ${p.reference || "-"}\n---\n`
      )
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-receipts_${format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMethodDisplay = (method: string) => {
    switch (method) {
      case "mpesa": return "M-Pesa";
      case "airtel-money": return "Airtel Money";
      case "cash": return "Cash";
      case "equity-bank": return "Equity Bank";
      case "family-bank": return "Family Bank";
      case "kcb": return "KCB Bank";
      case "cooperative-bank": return "Cooperative Bank";
      case "paypal": return "PayPal";
      case "overpayment": return "Overpayment";
      default: return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };

  const isOverpaymentBilling = (payment: Payment) =>
    payment.method === "overpayment" ||
    (payment.reference && payment.reference.startsWith("OVERPAY-"));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const totalDisplayed = (showAll ? allPayments : payments).reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0
  );
  const displayedPayments = showAll ? allPayments : payments;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role="customer" />
      <div className="container py-4 md:py-8 px-4 md:px-6 flex-1">
        <div className="mb-4 md:mb-6">
          <BackButton />
        </div>

        {/* Header */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6 md:h-8 md:w-8" />
              My Receipts
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              View and download your payment receipts
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {customerId && (
              <PayNowDropdown
                customerId={customerId}
                isAdmin={false}
                onPaymentSuccess={() => {
                  loadFilteredPayments();
                  loadAllPayments();
                  loadCustomerInfo();
                }}
              />
            )}
            <Button variant="outline" onClick={() => navigate("/customer/place-order")}>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 items-start sm:items-center">
          <ReceiptDateFilter onFilterChange={handleDateFilterChange} />
          <Button
            variant={showAll ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Showing All" : "View All"}
          </Button>
          {isLoadingData && (
            <span className="text-sm text-muted-foreground">Loading...</span>
          )}
        </div>

        {/* Summary + Download */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Payment Receipts</h2>
            <p className="text-muted-foreground text-sm">
              Total: KES {totalDisplayed.toLocaleString()}
            </p>
          </div>
          <Button onClick={downloadAllReceipts} disabled={displayedPayments.length === 0} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download All
          </Button>
        </div>

        {/* Receipts List */}
        <div className="grid gap-3">
          {displayedPayments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No receipts found for this period</p>
                <Button
                  variant="link"
                  onClick={() => setShowAll(true)}
                  className="mt-2"
                >
                  View all receipts
                </Button>
              </CardContent>
            </Card>
          ) : (
            displayedPayments.map((payment) => (
              <Card
                key={payment.id}
                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                onClick={() => fetchPaymentDeliveryData(payment)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        KES {Number(payment.amount_paid).toLocaleString()}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.paid_at), "EEEE, MMMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">Method</p>
                      <p className="font-semibold">{getMethodDisplay(payment.method)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge
                        variant={payment.payment_status === "completed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {payment.payment_status}
                      </Badge>
                    </div>
                  </div>

                  {isOverpaymentBilling(payment) && (
                    <div className="mb-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                        ✓ Billed from overpayment on{" "}
                        {format(new Date(payment.paid_at), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadReceipt(payment);
                      }}
                      className="transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
            <DialogDescription>View and download receipt</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              {isOverpaymentBilling(selectedPayment) && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    ✓ Billed from overpayment on{" "}
                    {format(new Date(selectedPayment.paid_at), "MMMM dd, yyyy 'at' HH:mm")}
                  </p>
                </div>
              )}
              <ReceiptViewer
                customerName={customerName}
                amount={selectedPayment.amount_paid}
                method={selectedPayment.method}
                date={selectedPayment.paid_at}
                transactionId={selectedPayment.transaction_id}
                reference={selectedPayment.reference}
                status={selectedPayment.payment_status}
                templateSettings={templateSettings || undefined}
                pricePerKg={paymentDeliveryData?.price_per_kg_at_time}
                totalKg={paymentDeliveryData?.total_kg}
                customerDebt={liveCustomerDebt}
                orderCost={paymentDeliveryData?.total_charge}
              />
              <Button
                className="w-full"
                onClick={() =>
                  downloadReceipt(selectedPayment, paymentDeliveryData, liveCustomerDebt)
                }
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
