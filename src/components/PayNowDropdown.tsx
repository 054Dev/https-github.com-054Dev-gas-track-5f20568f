import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { CreditCard, ChevronDown, Package, Plus } from "lucide-react";
import { format } from "date-fns";
import { PaymentModal } from "./PaymentModal";
import { useNavigate } from "react-router-dom";

interface Delivery {
  id: string;
  total_charge: number;
  manual_adjustment: number;
  delivery_date: string;
  total_kg: number;
}

interface PayNowDropdownProps {
  customerId: string;
  isAdmin?: boolean;
  onPaymentSuccess?: () => void;
}

export function PayNowDropdown({ customerId, isAdmin = false, onPaymentSuccess }: PayNowDropdownProps) {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<{id: string, amount: number} | null>(null);

  useEffect(() => {
    if (customerId) {
      loadUnpaidDeliveries();
    }
  }, [customerId]);

  const loadUnpaidDeliveries = async () => {
    setLoading(true);
    
    // Get deliveries that haven't been fully paid
    const { data: deliveriesData } = await supabase
      .from("deliveries")
      .select("id, total_charge, manual_adjustment, delivery_date, total_kg")
      .eq("customer_id", customerId)
      .order("delivery_date", { ascending: false });

    if (deliveriesData) {
      // Get payments for these deliveries
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("delivery_id, amount_paid")
        .eq("customer_id", customerId)
        .eq("payment_status", "completed");

      // Calculate unpaid deliveries
      const paidAmounts: Record<string, number> = {};
      paymentsData?.forEach(p => {
        if (p.delivery_id) {
          paidAmounts[p.delivery_id] = (paidAmounts[p.delivery_id] || 0) + p.amount_paid;
        }
      });

      const unpaidDeliveries = deliveriesData.filter(d => {
        const totalDue = d.total_charge + (d.manual_adjustment || 0);
        const totalPaid = paidAmounts[d.id] || 0;
        return totalPaid < totalDue;
      });

      setDeliveries(unpaidDeliveries);
    }
    
    setLoading(false);
  };

  const handleSelectDelivery = (delivery: Delivery) => {
    const amount = delivery.total_charge + (delivery.manual_adjustment || 0);
    setSelectedDelivery({ id: delivery.id, amount });
    setPaymentModalOpen(true);
  };

  const handleNewOrder = () => {
    if (isAdmin) {
      navigate("/admin/create-delivery");
    } else {
      navigate("/customer/place-order");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pay Now
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Select Delivery to Pay</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {loading ? (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          ) : deliveries.length === 0 ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <Package className="h-4 w-4 mr-2" />
              No unpaid deliveries
            </DropdownMenuItem>
          ) : (
            deliveries.slice(0, 5).map((delivery) => (
              <DropdownMenuItem 
                key={delivery.id}
                onClick={() => handleSelectDelivery(delivery)}
                className="flex flex-col items-start gap-1 cursor-pointer"
              >
                <div className="flex justify-between w-full">
                  <span className="font-medium">
                    KES {(delivery.total_charge + (delivery.manual_adjustment || 0)).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {delivery.total_kg.toFixed(1)} kg
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(delivery.delivery_date), "MMM dd, yyyy")}
                </span>
              </DropdownMenuItem>
            ))
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewOrder} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedDelivery && (
        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          customerId={customerId}
          deliveryId={selectedDelivery.id}
          amount={selectedDelivery.amount}
          onSuccess={() => {
            loadUnpaidDeliveries();
            setSelectedDelivery(null);
            onPaymentSuccess?.();
          }}
        />
      )}
    </>
  );
}
