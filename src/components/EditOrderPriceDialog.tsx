import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditOrderPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  customerId: string;
  currentPricePerKg: number;
  totalKg: number;
  currentTotalCharge: number;
  onSuccess: () => void;
  isLocked?: boolean;
  lockReason?: string;
}

export function EditOrderPriceDialog({
  open,
  onOpenChange,
  deliveryId,
  customerId,
  currentPricePerKg,
  totalKg,
  currentTotalCharge,
  onSuccess,
  isLocked = false,
  lockReason = "",
}: EditOrderPriceDialogProps) {
  const [newPricePerKg, setNewPricePerKg] = useState(currentPricePerKg.toString());
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const newTotalCharge = parseFloat(newPricePerKg || "0") * totalKg;
  const priceDifference = newTotalCharge - currentTotalCharge;

  const handleConfirmUpdate = async () => {
    setUpdating(true);
    try {
      // Update the delivery with new price
      const { error: deliveryError } = await supabase
        .from("deliveries")
        .update({
          price_per_kg_at_time: parseFloat(newPricePerKg),
          total_charge: newTotalCharge,
        })
        .eq("id", deliveryId);

      if (deliveryError) throw deliveryError;

      // Update customer's arrears balance with the price difference
      if (priceDifference !== 0) {
        const { data: customerData, error: fetchError } = await supabase
          .from("customers")
          .select("arrears_balance")
          .eq("id", customerId)
          .single();

        if (fetchError) throw fetchError;

        const newBalance = (customerData?.arrears_balance || 0) + priceDifference;

        const { error: updateError } = await supabase
          .from("customers")
          .update({ arrears_balance: newBalance })
          .eq("id", customerId);

        if (updateError) throw updateError;
      }

      toast({
        title: "Success",
        description: "Order price updated successfully. Changes synced to customer.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Order Price</AlertDialogTitle>
          <AlertDialogDescription>
            {isLocked
              ? lockReason
              : "This will update the price per kg for this order and automatically adjust the customer's balance."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLocked ? (
          <div className="py-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
              <p className="text-sm text-destructive font-medium">🔒 Price Editing Locked</p>
              <p className="text-xs text-muted-foreground mt-1">{lockReason}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPrice">New Price per KG (KES)</Label>
              <Input
                id="newPrice"
                type="number"
                step="0.01"
                value={newPricePerKg}
                onChange={(e) => setNewPricePerKg(e.target.value)}
              />
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Weight:</span>
                <span className="font-medium">{totalKg} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Current Total:</span>
                <span className="font-medium">KES {currentTotalCharge.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>New Total:</span>
                <span className="font-medium text-primary">KES {newTotalCharge.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                <span>Balance Adjustment:</span>
                <span className={priceDifference > 0 ? "text-destructive" : priceDifference < 0 ? "text-success" : ""}>
                  {priceDifference > 0 ? "+" : ""}KES {priceDifference.toLocaleString()}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              ⚠️ This action will immediately update the order and reflect on the customer's account.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={updating}>
            {isLocked ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {!isLocked && (
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={updating || !newPricePerKg || parseFloat(newPricePerKg) <= 0}
            >
              {updating ? "Updating..." : "Confirm Update"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
