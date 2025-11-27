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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Smartphone, CreditCard, Building2, DollarSign } from "lucide-react";

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
  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [processing, setProcessing] = useState(false);
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
          paymentMethod,
        },
      });

      if (error) throw error;

      if (data?.data?.url) {
        // Redirect to Intasend payment page
        window.open(data.data.url, "_blank");
        toast({
          title: "Payment Initiated",
          description: "Complete the payment in the new window",
        });
      } else {
        toast({
          title: "Payment Initiated",
          description: `Please check your ${paymentMethod === 'mpesa' ? 'M-Pesa' : 'Airtel Money'} for a payment prompt`,
        });
      }

      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 2000);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Make Payment</DialogTitle>
          <DialogDescription>
            Choose your payment method to pay KES {amount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="mpesa" id="mpesa" />
              <Label htmlFor="mpesa" className="flex items-center gap-2 cursor-pointer flex-1">
                <Smartphone className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">M-Pesa</div>
                  <div className="text-xs text-muted-foreground">Pay via Safaricom M-Pesa</div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="airtel-money" id="airtel" />
              <Label htmlFor="airtel" className="flex items-center gap-2 cursor-pointer flex-1">
                <Smartphone className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium">Airtel Money</div>
                  <div className="text-xs text-muted-foreground">Pay via Airtel Money</div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="bank-transfer" id="bank" />
              <Label htmlFor="bank" className="flex items-center gap-2 cursor-pointer flex-1">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Bank Transfer</div>
                  <div className="text-xs text-muted-foreground">Equity, KCB, Co-op, Family Bank</div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="card" id="card" />
              <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                <CreditCard className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">Card / PayPal</div>
                  <div className="text-xs text-muted-foreground">Visa, Mastercard, PayPal</div>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <Button
            onClick={handlePayment}
            disabled={processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Pay KES {amount.toLocaleString()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
