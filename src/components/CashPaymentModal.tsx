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
import { Loader2, DollarSign } from "lucide-react";

interface CashPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  deliveryId?: string;
  onSuccess: () => void;
}

export function CashPaymentModal({
  open,
  onOpenChange,
  customerId,
  deliveryId,
  onSuccess,
}: CashPaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("intasend-payment", {
        body: {
          action: "cash-payment",
          customerId,
          deliveryId: deliveryId || null,
          amount: parseFloat(amount),
          handledBy: user.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Cash Payment Recorded",
        description: `Successfully recorded payment of KES ${parseFloat(amount).toLocaleString()}`,
      });

      setAmount("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Cash payment error:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to record payment",
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
          <DialogTitle>Record Cash Payment</DialogTitle>
          <DialogDescription>
            Enter the amount received in cash from the customer
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
