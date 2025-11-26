import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Package, Users, Settings as SettingsIcon, LayoutDashboard, Phone, Truck, PackagePlus } from "lucide-react";

interface SubNavProps {
  role: "admin" | "co_admin" | "staff" | "customer";
}

export function SubNav({ role }: SubNavProps) {
  const isAdmin = role === "admin" || role === "co_admin" || role === "staff";

  return (
    <nav className="border-b bg-card hidden md:block">
      <div className="container mx-auto px-6">
        <div className="flex space-x-1 py-2">
          {isAdmin ? (
            <>
              <NavLink
                to="/admin/dashboard"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <LayoutDashboard className="inline-block mr-2 h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink
                to="/admin/orders"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <Package className="inline-block mr-2 h-4 w-4" />
                Orders
              </NavLink>
              <NavLink
                to="/admin/create-delivery"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <PackagePlus className="inline-block mr-2 h-4 w-4" />
                Create Delivery
              </NavLink>
              <NavLink
                to="/admin/order-tracking"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <Truck className="inline-block mr-2 h-4 w-4" />
                Order Tracking
              </NavLink>
              <NavLink
                to="/admin/customers"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <Users className="inline-block mr-2 h-4 w-4" />
                Customers
              </NavLink>
              <NavLink
                to="/admin/users"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <SettingsIcon className="inline-block mr-2 h-4 w-4" />
                Users
              </NavLink>
              {role === "admin" && (
                <NavLink
                  to="/admin/sub-admins"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                  activeClassName="bg-accent text-accent-foreground"
                >
                  <Users className="inline-block mr-2 h-4 w-4" />
                  Sub-Admins
                </NavLink>
              )}
            </>
          ) : (
            <>
              <NavLink
                to="/customer/dashboard"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <LayoutDashboard className="inline-block mr-2 h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink
                to="/customer/place-order"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <Package className="inline-block mr-2 h-4 w-4" />
                Place Order
              </NavLink>
              <NavLink
                to="/customer/orders"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                activeClassName="bg-accent text-accent-foreground"
              >
                <Package className="inline-block mr-2 h-4 w-4" />
                My Orders
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
