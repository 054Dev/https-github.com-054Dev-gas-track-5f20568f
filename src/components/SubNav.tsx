import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Package, Users, Settings as SettingsIcon, LayoutDashboard, Phone, Truck, PackagePlus, Trash2, Menu, X, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface SubNavProps {
  role: "admin" | "co_admin" | "staff" | "customer";
}

export function SubNav({ role }: SubNavProps) {
  const [open, setOpen] = useState(false);
  const isAdmin = role === "admin" || role === "co_admin" || role === "staff";

  const adminLinks = (
    <>
      <NavLink
        to="/admin/dashboard"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <LayoutDashboard className="inline-block mr-2 h-4 w-4" />
        Dashboard
      </NavLink>
      <NavLink
        to="/admin/orders"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <Package className="inline-block mr-2 h-4 w-4" />
        Orders
      </NavLink>
      <NavLink
        to="/admin/receipts-orders"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <Receipt className="inline-block mr-2 h-4 w-4" />
        Receipts & Sales
      </NavLink>
      <NavLink
        to="/admin/create-delivery"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <PackagePlus className="inline-block mr-2 h-4 w-4" />
        Create Delivery
      </NavLink>
      <NavLink
        to="/admin/order-tracking"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <Truck className="inline-block mr-2 h-4 w-4" />
        Order Tracking
      </NavLink>
      <NavLink
        to="/admin/customers"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <Users className="inline-block mr-2 h-4 w-4" />
        Customers
      </NavLink>
      <NavLink
        to="/admin/users"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <SettingsIcon className="inline-block mr-2 h-4 w-4" />
        Users
      </NavLink>
      {role === "admin" && (
        <>
          <NavLink
            to="/admin/sub-admins"
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
            activeClassName="bg-accent text-accent-foreground"
          >
            <Users className="inline-block mr-2 h-4 w-4" />
            Sub-Admins
          </NavLink>
          <NavLink
            to="/admin/deletion-requests"
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
            activeClassName="bg-accent text-accent-foreground"
          >
            <Trash2 className="inline-block mr-2 h-4 w-4" />
            Deletion Requests
          </NavLink>
        </>
      )}
    </>
  );

  const customerLinks = (
    <>
      <NavLink
        to="/customer/dashboard"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <LayoutDashboard className="inline-block mr-2 h-4 w-4" />
        Dashboard
      </NavLink>
      <NavLink
        to="/customer/place-order"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <Package className="inline-block mr-2 h-4 w-4" />
        Place Order
      </NavLink>
      <NavLink
        to="/customer/orders"
        className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent flex items-center"
        activeClassName="bg-accent text-accent-foreground"
      >
        <Package className="inline-block mr-2 h-4 w-4" />
        My Orders
      </NavLink>
    </>
  );

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="border-b bg-card hidden md:block">
        <div className="container mx-auto px-6">
          <div className="flex space-x-1 py-2">
            {isAdmin ? adminLinks : customerLinks}
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-semibold">Menu</span>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col space-y-1 mt-6">
                  <div onClick={() => setOpen(false)}>
                    {isAdmin ? adminLinks : customerLinks}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </>
  );
}
