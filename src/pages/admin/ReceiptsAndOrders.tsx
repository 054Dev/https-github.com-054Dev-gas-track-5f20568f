import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, DollarSign, Settings, Plus } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptViewer } from "@/components/ReceiptViewer";
import { downloadReceiptPDF } from "@/lib/pdf-receipt";
import { PayNowDropdown } from "@/components/PayNowDropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Customer {
  id: string;
  shop_name: string;
}

interface Payment {
  id: string;
  amount_paid: number;
  method: string;
  paid_at: string;
  customer_id: string;
  transaction_id: string;
  reference: string;
  payment_status: string;
  delivery_id: string | null;
  customers: {
    shop_name: string;
    in_charge_name: string;
    arrears_balance: number;
  };
}

interface Delivery {
  id: string;
  total_charge: number;
  manual_adjustment: number;
  delivery_date: string;
  customer_id: string;
  total_kg: number;
  price_per_kg_at_time: number;
  customers: {
    shop_name: string;
    in_charge_name: string;
  };
}

interface TemplateSettings {
  companyName: string;
  logoUrl: string | null;
  footerText: string | null;
  showTransactionId: boolean;
  showPaymentMethod: boolean;
  customFields: { label: string; value: string }[];
}

export default function ReceiptsAndOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentDeliveryData, setPaymentDeliveryData] = useState<{ total_kg: number; price_per_kg_at_time: number } | null>(null);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  useEffect(() => {
    checkAuth();
    fetchTemplateSettings();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedDate, showAll]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, shop_name")
      .is("deleted_at", null)
      .order("shop_name");
    if (data) setCustomers(data);
  };

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
      .maybeSingle();

    if (!roleData || (roleData.role !== "admin" && roleData.role !== "co_admin" && roleData.role !== "staff")) {
      navigate("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setUser({ ...session.user, ...profile, role: roleData.role });
  };

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      if (showAll) {
        // Load all data
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("*, customers(shop_name, in_charge_name, arrears_balance)")
          .order("paid_at", { ascending: false });

        const { data: deliveriesData } = await supabase
          .from("deliveries")
          .select("*, customers(shop_name, in_charge_name)")
          .order("delivery_date", { ascending: false });

        setPayments(paymentsData || []);
        setDeliveries(deliveriesData || []);
      } else if (selectedDate) {
        // Load data for specific date
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("*, customers(shop_name, in_charge_name, arrears_balance)")
          .gte("paid_at", selectedDate)
          .lt("paid_at", new Date(new Date(selectedDate).getTime() + 86400000).toISOString())
          .order("paid_at", { ascending: false });

        const { data: deliveriesData } = await supabase
          .from("deliveries")
          .select("*, customers(shop_name, in_charge_name)")
          .gte("delivery_date", selectedDate)
          .lt("delivery_date", new Date(new Date(selectedDate).getTime() + 86400000).toISOString())
          .order("delivery_date", { ascending: false });

        setPayments(paymentsData || []);
        setDeliveries(deliveriesData || []);
      } else {
        // Default: load today's data
        const today = new Date().toISOString().split("T")[0];
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("*, customers(shop_name, in_charge_name, arrears_balance)")
          .gte("paid_at", today)
          .order("paid_at", { ascending: false });

        const { data: deliveriesData } = await supabase
          .from("deliveries")
          .select("*, customers(shop_name, in_charge_name)")
          .gte("delivery_date", today)
          .order("delivery_date", { ascending: false });

        setPayments(paymentsData || []);
        setDeliveries(deliveriesData || []);
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  // Fetch delivery data when payment is selected
  const fetchPaymentDeliveryData = async (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentDeliveryData(null);
    
    if (payment.delivery_id) {
      const { data: deliveryData } = await supabase
        .from("deliveries")
        .select("total_kg, price_per_kg_at_time")
        .eq("id", payment.delivery_id)
        .single();
      
      if (deliveryData) {
        setPaymentDeliveryData(deliveryData);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const downloadReceipts = () => {
    const content = payments.map(p => 
      `Receipt\nCustomer: ${p.customers?.shop_name}\nAmount: KES ${p.amount_paid}\nMethod: ${p.method}\nDate: ${format(new Date(p.paid_at), "PPP")}\n---\n`
    ).join("\n");
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all-receipts_${selectedDate || format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingleReceipt = (payment: Payment, deliveryData?: { total_kg: number; price_per_kg_at_time: number } | null) => {
    downloadReceiptPDF({
      customerName: payment.customers?.in_charge_name || "Customer",
      amount: payment.amount_paid,
      method: payment.method,
      date: payment.paid_at,
      transactionId: payment.transaction_id,
      reference: payment.reference,
      status: payment.payment_status,
      templateSettings: templateSettings || undefined,
      pricePerKg: deliveryData?.price_per_kg_at_time,
      totalKg: deliveryData?.total_kg,
      customerDebt: payment.customers?.arrears_balance || 0,
    });
  };

  const downloadSales = () => {
    const content = deliveries.map(d => 
      `Sale\nCustomer: ${d.customers?.shop_name}\nAmount: KES ${Number(d.total_charge) + Number(d.manual_adjustment || 0)}\nDate: ${format(new Date(d.delivery_date), "PPP")}\n---\n`
    ).join("\n");
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_${selectedDate || "today"}.txt`;
    a.click();
  };

  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalSales = deliveries.reduce((sum, d) => sum + Number(d.total_charge) + Number(d.manual_adjustment || 0), 0);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <div className="container py-4 md:py-8 px-4 md:px-6 flex-1">
        <div className="mb-4 md:mb-6">
          <BackButton />
        </div>
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Receipts & Sales</h1>
            <p className="text-sm md:text-base text-muted-foreground">View and download payment receipts and sales records</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.shop_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCustomerId && (
              <PayNowDropdown 
                customerId={selectedCustomerId} 
                isAdmin={true} 
                onPaymentSuccess={() => loadData()}
              />
            )}
            <Button variant="outline" onClick={() => navigate("/admin/create-delivery")}>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
            {(user?.role === "admin" || user?.role === "co_admin") && (
              <Button variant="outline" onClick={() => navigate("/admin/receipt-settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Receipt Template
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Label htmlFor="date">Select Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setShowAll(false);
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button 
              onClick={() => { setShowAll(true); setSelectedDate(""); }} 
              variant={showAll ? "default" : "outline"}
              disabled={isLoadingData}
              className="transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md"
            >
              {isLoadingData && showAll ? "Loading..." : "View All"}
            </Button>
            <Button 
              onClick={() => { setShowAll(false); setSelectedDate(""); }} 
              variant={!showAll && !selectedDate ? "default" : "outline"}
              disabled={isLoadingData}
              className="transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md"
            >
              Today
            </Button>
          </div>
        </div>

        <Tabs defaultValue="receipts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="receipts" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Payment Receipts</h2>
                <p className="text-muted-foreground">Total: KES {totalPayments.toLocaleString()}</p>
              </div>
              <Button onClick={downloadReceipts} disabled={payments.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>

            <div className="grid gap-3">
              {payments.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No receipts found for this period
                  </CardContent>
                </Card>
              ) : (
                payments.map((payment) => (
                  <Card 
                    key={payment.id} 
                    className="hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                    onClick={() => fetchPaymentDeliveryData(payment)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{payment.customers?.shop_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{payment.customers?.in_charge_name}</p>
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-semibold">KES {Number(payment.amount_paid).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Method</p>
                          <p className="font-semibold capitalize">{payment.method.replace('-', ' ')}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-semibold">{format(new Date(payment.paid_at), "PPP p")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Sales Records</h2>
                <p className="text-muted-foreground">Total: KES {totalSales.toLocaleString()}</p>
              </div>
              <Button onClick={downloadSales} disabled={deliveries.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>

            <div className="grid gap-3">
              {deliveries.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No sales found for this period
                  </CardContent>
                </Card>
              ) : (
                deliveries.map((delivery) => (
                  <Card key={delivery.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{delivery.customers?.shop_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{delivery.customers?.in_charge_name}</p>
                        </div>
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-semibold">KES {(Number(delivery.total_charge) + Number(delivery.manual_adjustment || 0)).toLocaleString()}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-semibold">{format(new Date(delivery.delivery_date), "PPP p")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
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
                customerName={selectedPayment.customers?.in_charge_name || ""}
                amount={selectedPayment.amount_paid}
                method={selectedPayment.method}
                date={selectedPayment.paid_at}
                transactionId={selectedPayment.transaction_id}
                reference={selectedPayment.reference}
                status={selectedPayment.payment_status}
                templateSettings={templateSettings || undefined}
                pricePerKg={paymentDeliveryData?.price_per_kg_at_time}
                totalKg={paymentDeliveryData?.total_kg}
                customerDebt={selectedPayment.customers?.arrears_balance || 0}
              />
              <Button 
                className="w-full" 
                onClick={() => downloadSingleReceipt(selectedPayment, paymentDeliveryData)}
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
