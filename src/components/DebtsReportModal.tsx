import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Download, TrendingUp, Users, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface CustomerDebt {
  id: string;
  shop_name: string;
  in_charge_name: string;
  phone: string;
  arrears_balance: number;
  updated_at: string;
  created_at: string;
}

interface DebtsReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = ["hsl(16, 100%, 50%)", "hsl(210, 100%, 35%)", "hsl(38, 92%, 50%)", "hsl(142, 76%, 36%)", "hsl(270, 70%, 50%)"];

export function DebtsReportModal({ open, onOpenChange }: DebtsReportModalProps) {
  const [customers, setCustomers] = useState<CustomerDebt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadDebtors();
    }
  }, [open]);

  const loadDebtors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id, shop_name, in_charge_name, phone, arrears_balance, updated_at, created_at")
      .gt("arrears_balance", 0)
      .is("deleted_at", null)
      .order("arrears_balance", { ascending: false });

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  const totalDebt = customers.reduce((sum, c) => sum + Number(c.arrears_balance), 0);
  const averageDebt = customers.length > 0 ? totalDebt / customers.length : 0;
  const highestDebt = customers.length > 0 ? Math.max(...customers.map(c => Number(c.arrears_balance))) : 0;

  // Prepare chart data
  const top10Debtors = customers.slice(0, 10).map((c) => ({
    name: c.shop_name.length > 15 ? c.shop_name.substring(0, 15) + "..." : c.shop_name,
    amount: Number(c.arrears_balance),
  }));

  // Debt distribution for pie chart
  const debtRanges = [
    { name: "0-5K", value: 0 },
    { name: "5K-10K", value: 0 },
    { name: "10K-50K", value: 0 },
    { name: "50K-100K", value: 0 },
    { name: "100K+", value: 0 },
  ];

  customers.forEach((c) => {
    const amt = Number(c.arrears_balance);
    if (amt <= 5000) debtRanges[0].value++;
    else if (amt <= 10000) debtRanges[1].value++;
    else if (amt <= 50000) debtRanges[2].value++;
    else if (amt <= 100000) debtRanges[3].value++;
    else debtRanges[4].value++;
  });

  const filteredDebtRanges = debtRanges.filter((r) => r.value > 0);

  const downloadReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(210, 100, 25);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("DEBTS REPORT", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "PPP 'at' p")}`, pageWidth / 2, 32, { align: "center" });

    // Summary cards
    let y = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 20, y);
    
    y += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Customers with Debt: ${customers.length}`, 20, y);
    y += 8;
    doc.text(`Total Outstanding Debt: KES ${totalDebt.toLocaleString()}`, 20, y);
    y += 8;
    doc.text(`Average Debt per Customer: KES ${averageDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 20, y);
    y += 8;
    doc.text(`Highest Individual Debt: KES ${highestDebt.toLocaleString()}`, 20, y);

    // Table header
    y += 20;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 5, pageWidth - 30, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Shop Name", 20, y);
    doc.text("Contact", 70, y);
    doc.text("Phone", 110, y);
    doc.text("Balance (KES)", 150, y);
    doc.text("Last Updated", 175, y);

    // Table rows
    y += 10;
    doc.setFont("helvetica", "normal");
    
    customers.forEach((customer, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        
        // Repeat header on new page
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y - 5, pageWidth - 30, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.text("Shop Name", 20, y);
        doc.text("Contact", 70, y);
        doc.text("Phone", 110, y);
        doc.text("Balance (KES)", 150, y);
        doc.text("Last Updated", 175, y);
        y += 10;
        doc.setFont("helvetica", "normal");
      }

      const shopName = customer.shop_name.length > 20 ? customer.shop_name.substring(0, 20) + "..." : customer.shop_name;
      const contactName = customer.in_charge_name.length > 15 ? customer.in_charge_name.substring(0, 15) + "..." : customer.in_charge_name;
      
      doc.text(shopName, 20, y);
      doc.text(contactName, 70, y);
      doc.text(customer.phone, 110, y);
      doc.text(Number(customer.arrears_balance).toLocaleString(), 150, y);
      doc.text(format(new Date(customer.updated_at), "dd/MM/yyyy"), 175, y);
      
      y += 8;
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`debts-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-warning" />
              Customer Debts Report
            </DialogTitle>
            <Button onClick={downloadReport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Debtors</p>
                      <p className="text-2xl font-bold">{customers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning/20 rounded-lg">
                      <DollarSign className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Debt</p>
                      <p className="text-2xl font-bold">KES {totalDebt.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/20 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Average Debt</p>
                      <p className="text-2xl font-bold">KES {averageDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/20 rounded-lg">
                      <Calendar className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Highest Debt</p>
                      <p className="text-2xl font-bold">KES {highestDebt.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            {customers.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Top 10 Debtors</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={top10Debtors} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip 
                          formatter={(value: number) => [`KES ${value.toLocaleString()}`, "Balance"]}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Bar dataKey="amount" fill="hsl(16, 100%, 50%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Pie Chart */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Debt Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={filteredDebtRanges}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {filteredDebtRanges.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${value} customers`, "Count"]}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Data Table */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">All Customers with Outstanding Balances</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shop Name</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Balance (KES)</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Customer Since</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No customers with outstanding balances
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.shop_name}</TableCell>
                            <TableCell>{customer.in_charge_name}</TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell className="text-right font-semibold text-warning">
                              {Number(customer.arrears_balance).toLocaleString()}
                            </TableCell>
                            <TableCell>{format(new Date(customer.updated_at), "PPp")}</TableCell>
                            <TableCell>{format(new Date(customer.created_at), "PP")}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
