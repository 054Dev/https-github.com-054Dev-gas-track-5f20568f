import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Setup from "./pages/Setup";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminServices from "./pages/admin/Services";
import AdminContacts from "./pages/admin/Contacts";
import AdminCustomers from "./pages/admin/Customers";
import AdminSubAdmins from "./pages/admin/SubAdmins";
import AdminCreateDelivery from "./pages/admin/CreateDelivery";
import CustomerDetail from "./pages/admin/CustomerDetail";
import DeletionRequests from "./pages/admin/DeletionRequests";
import AdminReceiptsAndOrders from "./pages/admin/ReceiptsAndOrders";
import CustomerDashboard from "./pages/customer/Dashboard";
import AdminOrders from "./pages/admin/Orders";
import AdminOrderTracking from "./pages/admin/OrderTracking";
import CustomerOrders from "./pages/customer/Orders";
import CustomerPlaceOrder from "./pages/customer/PlaceOrder";
import CustomerReceipts from "./pages/customer/Receipts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();


// Main application component
const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/receipts-orders" element={<AdminReceiptsAndOrders />} />
            <Route path="/admin/order-tracking" element={<AdminOrderTracking />} />
            <Route path="/admin/create-delivery" element={<AdminCreateDelivery />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/services" element={<AdminServices />} />
            <Route path="/admin/sub-admins" element={<AdminSubAdmins />} />
            <Route path="/admin/deletion-requests" element={<DeletionRequests />} />
            <Route path="/admin/contacts" element={<AdminContacts />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/customers/:customerId" element={<CustomerDetail />} />
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/place-order" element={<CustomerPlaceOrder />} />
            <Route path="/customer/orders" element={<CustomerOrders />} />
            <Route path="/customer/receipts" element={<CustomerReceipts />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
