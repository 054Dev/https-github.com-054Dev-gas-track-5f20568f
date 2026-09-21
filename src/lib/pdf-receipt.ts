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
  /** Shop / business name on the account */
  shopName?: string;
  /** Name on the account that made the payment */
  accountName?: string;
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
  orderCost?: number;
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

/**
 * Generates a compact A6 (105 x 148 mm) payment receipt.
 */
export const generateReceiptPDF = (data: ReceiptData): jsPDF => {
  const doc = new jsPDF({ unit: "mm", format: "a6" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 105
  const M = 8; // margin
  const right = pageWidth - M;

  const settings = {
    companyName: data.templateSettings?.companyName || "FINE GAS LIMITED",
    footerText: data.templateSettings?.footerText ?? "Thank you for your payment!",
    showTransactionId: data.templateSettings?.showTransactionId ?? true,
    showPaymentMethod: data.templateSettings?.showPaymentMethod ?? true,
    customFields: data.templateSettings?.customFields || [],
  };

  let y = 10;

  const line = () => {
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(M, y, right, y);
    y += 4;
  };

  const row = (label: string, value: string, bold = true) => {
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.setFont("helvetica", "normal");
    doc.text(label, M, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value, right, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 5;
  };

  // Header
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(settings.companyName, pageWidth / 2, y, { align: "center" });
  y += 4.5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  doc.text("Payment Receipt", pageWidth / 2, y, { align: "center" });
  y += 4;
  line();

  // Who paid
  const paidBy = data.accountName || data.customerName;
  row("Customer", data.customerName);
  if (data.accountName && data.accountName !== data.customerName) {
    row("Paid By", paidBy);
  }
  if (data.shopName) row("Shop / Business", data.shopName);
  row("Date", format(new Date(data.date), "dd MMM yyyy, HH:mm"), false);
  line();

  if (settings.showPaymentMethod) row("Payment Method", getMethodDisplay(data.method));
  row("Status", data.status.charAt(0).toUpperCase() + data.status.slice(1));
  if (data.pricePerKg !== undefined) row("Price per KG", `KES ${data.pricePerKg.toLocaleString()}`);
  if (data.totalKg !== undefined) row("Total KG", `${data.totalKg.toFixed(2)} kg`);

  if (settings.showTransactionId && (data.transactionId || data.reference)) {
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text("Transaction ID", M, y);
    y += 3.5;
    doc.setFontSize(6.5);
    doc.setTextColor(0);
    const txt = data.transactionId || data.reference || "";
    doc.text(doc.splitTextToSize(txt, pageWidth - M * 2), M, y);
    y += 5;
  }

  if (settings.customFields.length > 0) {
    line();
    settings.customFields.forEach((f) => row(f.label, f.value));
  }

  line();

  // Amounts
  if (data.orderCost !== undefined) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(M, y - 3, pageWidth - M * 2, 19, 2, 2, "F");
    y += 1.5;
    row("Order Cost", `KES ${data.orderCost.toLocaleString()}`);
    row("Amount Paid", `KES ${data.amount.toLocaleString()}`);
    const bal = data.orderCost - data.amount;
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text("Payment Balance", M, y);
    doc.setFont("helvetica", "bold");
    if (bal > 0) {
      doc.setTextColor(185, 28, 28);
      doc.text(`KES ${bal.toLocaleString()} (Due)`, right, y, { align: "right" });
    } else if (bal < 0) {
      doc.setTextColor(22, 163, 74);
      doc.text(`KES ${Math.abs(bal).toLocaleString()} (Credit)`, right, y, { align: "right" });
    } else {
      doc.setTextColor(0);
      doc.text("Fully Paid", right, y, { align: "right" });
    }
    doc.setFont("helvetica", "normal");
    y += 8;
  } else {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(M, y - 3, pageWidth - M * 2, 16, 2, 2, "F");
    y += 2;
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text("TOTAL AMOUNT PAID", pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(13);
    doc.setTextColor(37, 99, 235);
    doc.setFont("helvetica", "bold");
    doc.text(`KES ${data.amount.toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    y += 9;
  }

  // Running balance
  if (data.customerDebt !== undefined) {
    const debt = data.customerDebt;
    if (debt > 0) doc.setFillColor(254, 226, 226);
    else if (debt < 0) doc.setFillColor(220, 252, 231);
    else doc.setFillColor(241, 245, 249);
    doc.roundedRect(M, y - 3, pageWidth - M * 2, 13, 2, 2, "F");
    y += 1.5;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    if (debt > 0) {
      doc.setTextColor(185, 28, 28);
      doc.text("OUTSTANDING BALANCE (OWED)", pageWidth / 2, y, { align: "center" });
      y += 5;
      doc.setFontSize(10);
      doc.text(`KES ${debt.toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    } else if (debt < 0) {
      doc.setTextColor(22, 101, 52);
      doc.text("ACCOUNT CREDIT", pageWidth / 2, y, { align: "center" });
      y += 5;
      doc.setFontSize(10);
      doc.text(`KES ${Math.abs(debt).toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    } else {
      doc.setTextColor(110);
      doc.text("NO OUTSTANDING BALANCE", pageWidth / 2, y, { align: "center" });
      y += 5;
    }
    doc.setFont("helvetica", "normal");
    y += 7;
  }

  line();

  // Footer
  doc.setTextColor(110);
  doc.setFontSize(6.5);
  if (settings.footerText) {
    settings.footerText.split("\n").forEach((l) => {
      doc.text(l, pageWidth / 2, y, { align: "center" });
      y += 3.5;
    });
  }
  doc.setFontSize(6);
  doc.text(`Official receipt from ${settings.companyName}`, pageWidth / 2, y, { align: "center" });

  return doc;
};

export const downloadReceiptPDF = (data: ReceiptData, filename?: string) => {
  const doc = generateReceiptPDF(data);
  const methodName = getMethodDisplay(data.method).replace(/\s+/g, "-");
  const customerNameClean = (data.accountName || data.customerName).replace(/\s+/g, "-");
  const defaultFilename = `${customerNameClean}-${methodName}.pdf`;
  doc.save(filename || defaultFilename);
};
