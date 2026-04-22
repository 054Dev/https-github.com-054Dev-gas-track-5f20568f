import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Smartphone, CheckCircle, Info } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  deliveryId: string;
  amount: number;
  onSuccess: () => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  customerId,
  deliveryId,
  amount,
  onSuccess,
}: PaymentModalProps) {
  const [processing, setProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const { toast } = useToast();

  const effectiveAmount = paymentType === "full" ? amount : parseFloat(partialAmount) || 0;

  const handlePayment = async () => {
    if (paymentType === "partial") {
      const pa = parseFloat(partialAmount);
      if (!pa || pa <= 0) {
        toast({ title: "Invalid Amount", description: "Enter a valid amount to pay.", variant: "destructive" });
        return;
      }
      if (pa > amount) {
        toast({ title: "Invalid Amount", description: "Partial amount cannot exceed total due.", variant: "destructive" });
        return;
      }
    }

    try {
      setProcessing(true);

      const { data, error } = await supabase.functions.invoke("intasend-payment", {
        body: {
          action: "initialize-payment",
          customerId,
          deliveryId,
          amount: effectiveAmount,
        },
      });

      if (error) throw error;
      if (data && !data.ok) throw new Error(data.error || "STK push failed");

      toast({
        title: "M-Pesa Prompt Sent",
        description: data?.devMode
          ? `DEV MODE: a prompt of KES ${data.chargedAmount} was sent. The amount will be auto-refunded once the receipt is generated.`
          : `Check your phone for the M-Pesa payment prompt of KES ${effectiveAmount.toLocaleString()}.`,
      });

      // Auto-close — no manual verification needed; receipts are sent
      // automatically when the Daraja callback completes the payment.
      onSuccess();
      onOpenChange(false);
      setPaymentType("full");
      setPartialAmount("");
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setPaymentType("full");
      setPartialAmount("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pay via M-Pesa</DialogTitle>
          <DialogDescription>
            Total due: KES {amount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
              {/* Payment type selection */}
              <RadioGroup
                value={paymentType}
                onValueChange={(v) => setPaymentType(v as "full" | "partial")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="flex-1 cursor-pointer">
                    <span className="font-medium">Pay Full Amount</span>
                    <span className="block text-sm text-muted-foreground">KES {amount.toLocaleString()}</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="partial" id="partial" />
                  <Label htmlFor="partial" className="flex-1 cursor-pointer">
                    <span className="font-medium">Pay Partially</span>
                    <span className="block text-sm text-muted-foreground">Choose how much to pay now</span>
                  </Label>
                </div>
              </RadioGroup>

              {paymentType === "partial" && (
                <div className="space-y-2">
                  <Label htmlFor="partialAmount">Amount to Pay (KES)</Label>
                  <Input
                    id="partialAmount"
                    type="number"
                    step="1"
                    min="1"
                    max={amount}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={`Max: ${amount.toLocaleString()}`}
                  />
                  {partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) <= amount && (
                    <p className="text-xs text-muted-foreground">
                      Remaining after payment: KES {(amount - parseFloat(partialAmount)).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 p-4 border rounded-lg bg-accent/30">
                <Smartphone className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-medium">M-Pesa STK Push</p>
                  <p className="text-sm text-muted-foreground">
                    A payment prompt will be sent to your registered phone number.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 border border-dashed rounded-md text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Development mode is active: every prompt is a fixed KES 2 token
                  payment that is automatically refunded once the receipt is generated.
                </span>
              </div>

              <Button
                onClick={handlePayment}
                disabled={processing || (paymentType === "partial" && (!partialAmount || parseFloat(partialAmount) <= 0))}
                className="w-full"
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending prompt...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Pay KES {effectiveAmount.toLocaleString()}
                  </>
                )}
              </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
