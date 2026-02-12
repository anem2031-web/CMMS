import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Tickets from "./pages/Tickets";
import TicketDetail from "./pages/TicketDetail";
import CreateTicket from "./pages/CreateTicket";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import CreatePurchaseOrder from "./pages/CreatePurchaseOrder";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import UsersPage from "./pages/Users";
import Sites from "./pages/Sites";
import Notifications from "./pages/Notifications";
import AuditLog from "./pages/AuditLog";
import AIAssistant from "./pages/AIAssistant";
import TechnicianReport from "./pages/TechnicianReport";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/tickets/new" component={CreateTicket} />
        <Route path="/tickets/:id" component={TicketDetail} />
        <Route path="/purchase-orders" component={PurchaseOrders} />
        <Route path="/purchase-orders/new" component={CreatePurchaseOrder} />
        <Route path="/purchase-orders/:id" component={PurchaseOrderDetail} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/reports" component={Reports} />
        <Route path="/reports/technicians" component={TechnicianReport} />
        <Route path="/users" component={UsersPage} />
        <Route path="/sites" component={Sites} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/audit-log" component={AuditLog} />
        <Route path="/ai-assistant" component={AIAssistant} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
