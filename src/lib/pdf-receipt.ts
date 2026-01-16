import jsPDF from "jspdf";
import { format } from "date-fns";

interface TemplateSettings {
  companyName?: string;
  logoUrl?: string | null;
  footerText?: string | null;
  showTransactionId?: boolean;
  showPaymentMethod?: boolean;
  customFields?: { label: string; value: string }[];
}

interface ReceiptData {
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
  customerDebt?: number;
}

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
    default: return method.charAt(0).toUpperCase() + method.slice(1);
  }
};

export const generateReceiptPDF = (data: ReceiptData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const settings = {
    companyName: data.templateSettings?.companyName || "FINE GAS LIMITED",
    footerText: data.templateSettings?.footerText ?? "Thank you for your payment!",
    showTransactionId: data.templateSettings?.showTransactionId ?? true,
    showPaymentMethod: data.templateSettings?.showPaymentMethod ?? true,
    customFields: data.templateSettings?.customFields || [],
  };

  let y = 20;

  // Header - Company Name
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(settings.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;

  // Subtitle
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Payment Receipt", pageWidth / 2, y, { align: "center" });
  y += 15;

  // Horizontal line
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  y += 15;

  // Customer Name
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("CUSTOMER NAME", 20, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, 20, y);
  y += 12;

  // Date & Time
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text("DATE & TIME", 20, y);
  y += 6;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(format(new Date(data.date), "EEEE, MMMM dd, yyyy 'at' HH:mm"), 20, y);
  y += 15;

  // Horizontal line
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Payment Method
  if (settings.showPaymentMethod) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Payment Method", 20, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(getMethodDisplay(data.method), pageWidth - 20, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 10;
  }

  // Status
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Status", 20, y);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.status.charAt(0).toUpperCase() + data.status.slice(1), pageWidth - 20, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 10;

  // Price per KG
  if (data.pricePerKg !== undefined) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Price per KG", 20, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`KES ${data.pricePerKg.toLocaleString()}`, pageWidth - 20, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 10;
  }

  // Total KG
  if (data.totalKg !== undefined) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Total KG", 20, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.totalKg.toFixed(2)} kg`, pageWidth - 20, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 10;
  }

  // Transaction ID
  if (settings.showTransactionId && (data.transactionId || data.reference)) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Transaction ID", 20, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(data.transactionId || data.reference || "", 20, y);
    y += 10;
  }

  // Custom Fields
  if (settings.customFields.length > 0) {
    y += 5;
    doc.setDrawColor(200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    
    settings.customFields.forEach((field) => {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(field.label, 20, y);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(field.value, pageWidth - 20, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 10;
    });
  }

  y += 5;

  // Amount Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20, y, pageWidth - 40, 35, 3, 3, "F");
  y += 12;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("TOTAL AMOUNT PAID", pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(24);
  doc.setTextColor(37, 99, 235); // Blue color
  doc.setFont("helvetica", "bold");
  doc.text(`KES ${data.amount.toLocaleString()}`, pageWidth / 2, y, { align: "center" });
  y += 25;

  // Customer Debt Box (if exists)
  if (data.customerDebt !== undefined && data.customerDebt > 0) {
    doc.setFillColor(254, 226, 226); // Light red
    doc.roundedRect(20, y, pageWidth - 40, 30, 3, 3, "F");
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28); // Dark red
    doc.setFont("helvetica", "bold");
    doc.text("OUTSTANDING BALANCE", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(16);
    doc.text(`KES ${data.customerDebt.toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    y += 20;
  }

  // Horizontal line
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  y += 15;

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  
  if (settings.footerText) {
    const footerLines = settings.footerText.split("\n");
    footerLines.forEach((line) => {
      doc.text(line, pageWidth / 2, y, { align: "center" });
      y += 6;
    });
  }
  
  doc.setFontSize(9);
  doc.text(`This is an official receipt from ${settings.companyName}`, pageWidth / 2, y, { align: "center" });

  return doc;
};

export const downloadReceiptPDF = (data: ReceiptData, filename?: string) => {
  const doc = generateReceiptPDF(data);
  const methodName = getMethodDisplay(data.method).replace(/\s+/g, "-");
  const customerNameClean = data.customerName.replace(/\s+/g, "-");
  const defaultFilename = `${customerNameClean}-${methodName}.pdf`;
  doc.save(filename || defaultFilename);
};
