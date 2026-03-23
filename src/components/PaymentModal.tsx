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
import { Loader2, Smartphone, CheckCircle } from "lucide-react";

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
  const [stkSent, setStkSent] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    try {
      setProcessing(true);

      const { data, error } = await supabase.functions.invoke("intasend-payment", {
        body: {
          action: "initialize-payment",
          customerId,
          deliveryId,
          amount,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStkSent(true);
      setCheckoutRequestId(data.checkoutRequestId || null);

      toast({
        title: "M-Pesa Prompt Sent",
        description: "Check your phone for the M-Pesa payment prompt and enter your PIN.",
      });
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

  const checkPaymentStatus = async () => {
    if (!checkoutRequestId) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("intasend-payment", {
        body: {
          action: "query-payment",
          checkoutRequestId,
        },
      });

      if (error) throw error;

      const resultCode = data?.data?.ResultCode;
      if (resultCode === "0") {
        toast({ title: "Payment Confirmed", description: "Your M-Pesa payment was successful!" });
        onSuccess();
        onOpenChange(false);
        setStkSent(false);
        setCheckoutRequestId(null);
      } else if (resultCode) {
        toast({
          title: "Payment Pending",
          description: "Payment not yet confirmed. Please complete the M-Pesa prompt on your phone.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Status Check Failed",
        description: "Could not verify payment. Try again shortly.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStkSent(false);
      setCheckoutRequestId(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pay via M-Pesa</DialogTitle>
          <DialogDescription>
            Pay KES {amount.toLocaleString()} via Safaricom M-Pesa STK Push
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!stkSent ? (
            <>
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-accent/30">
                <Smartphone className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-medium">M-Pesa STK Push</p>
                  <p className="text-sm text-muted-foreground">
                    A payment prompt will be sent to your registered phone number.
                    Enter your M-Pesa PIN to complete payment.
                  </p>
                </div>
              </div>

              <Button
                onClick={handlePayment}
                disabled={processing}
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
                    Pay KES {amount.toLocaleString()}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">STK Push Sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check your phone for the M-Pesa prompt and enter your PIN to complete the payment.
                  </p>
                </div>
              </div>

              <Button
                onClick={checkPaymentStatus}
                disabled={checking}
                variant="outline"
                className="w-full"
              >
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "I've completed payment — verify"
                )}
              </Button>

              <Button
                onClick={handlePayment}
                disabled={processing}
                variant="ghost"
                className="w-full"
                size="sm"
              >
                {processing ? "Resending..." : "Resend M-Pesa prompt"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
