import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LockStatus {
  isLocked: boolean;
  lockReason: string;
}

export function useDeliveryLockStatus() {
  const [lockStatus, setLockStatus] = useState<LockStatus>({ isLocked: false, lockReason: "" });
  const [checking, setChecking] = useState(false);

  const checkLockStatus = useCallback(async (deliveryId: string, deliveryStatus: string): Promise<LockStatus> => {
    setChecking(true);
    
    try {
      // Check if status is not pending
      if (deliveryStatus !== "pending") {
        const reason = deliveryStatus === "en_route" 
          ? "This order is en route and cannot be modified."
          : "This order has been delivered and cannot be modified.";
        const status = { isLocked: true, lockReason: reason };
        setLockStatus(status);
        return status;
      }

      // Check if there are any payments for this delivery
      const { data: payments, error } = await supabase
        .from("payments")
        .select("id, amount_paid")
        .eq("delivery_id", deliveryId)
        .limit(1);

      if (error) {
        console.error("Error checking payments:", error);
        setLockStatus({ isLocked: false, lockReason: "" });
        return { isLocked: false, lockReason: "" };
      }

      if (payments && payments.length > 0) {
        const status = { 
          isLocked: true, 
          lockReason: "This order has received payment(s) and the price cannot be changed." 
        };
        setLockStatus(status);
        return status;
      }

      setLockStatus({ isLocked: false, lockReason: "" });
      return { isLocked: false, lockReason: "" };
    } finally {
      setChecking(false);
    }
  }, []);

  return { lockStatus, checkLockStatus, checking };
}
