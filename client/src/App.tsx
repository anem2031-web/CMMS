import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import DashboardLayout from "./components/DashboardLayout";
import RouteLoadingFallback from "./components/RouteLoadingFallback";

// ─── Eagerly loaded (critical path — must be instant) ───────────────────────
import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// ─── Lazily loaded — Ticket module ──────────────────────────────────────────
const Tickets = lazy(() => import("./pages/Tickets"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));
const CreateTicket = lazy(() => import("./pages/CreateTicket"));

// ─── Lazily loaded — Procurement module ─────────────────────────────────────
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const PurchaseOrderDetail = lazy(() => import("./pages/PurchaseOrderDetail"));
const CreatePurchaseOrder = lazy(() => import("./pages/CreatePurchaseOrder"));
const PurchaseCycle = lazy(() => import("./pages/PurchaseCycle"));
const MyItems = lazy(() => import("./pages/MyItems"));

// ─── Lazily loaded — Asset module ───────────────────────────────────────────
const Assets = lazy(() => import("./pages/Assets"));
const AssetHistory = lazy(() => import("./pages/AssetHistory"));
const AssetMetrics = lazy(() => import("./pages/AssetMetrics"));
const AssetDetail = lazy(() => import("./pages/AssetDetail"));
const AssetCategories = lazy(() => import("./pages/AssetCategories"));
const ScanAsset = lazy(() => import("./pages/ScanAsset"));

// ─── Lazily loaded — Maintenance / PM module ────────────────────────────────
const PreventiveMaintenance = lazy(() => import("./pages/PreventiveMaintenance"));
const TriageDashboard = lazy(() => import("./pages/TriageDashboard"));
const GateSecurity = lazy(() => import("./pages/GateSecurity"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

// ─── Lazily loaded — Reports module (heaviest — recharts + large data) ──────
const Reports = lazy(() => import("./pages/Reports"));
const TechnicianReport = lazy(() => import("./pages/TechnicianReport"));
const PurchaseCycleReport = lazy(() => import("./pages/PurchaseCycleReport"));
const MaintenanceCycleReport = lazy(() => import("./pages/MaintenanceCycleReport"));
const SectionReport = lazy(() => import("./pages/SectionReport"));
const PreventiveReport = lazy(() => import("./pages/PreventiveReport"));
const CostReport = lazy(() => import("./pages/CostReport"));

// ─── Lazily loaded — Admin / Settings module ────────────────────────────────
const UsersPage = lazy(() => import("./pages/Users"));
const Sites = lazy(() => import("./pages/Sites"));
const Sections = lazy(() => import("./pages/Sections"));
const Technicians = lazy(() => import("./pages/Technicians"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const TranslationMonitor = lazy(() => import("./pages/TranslationMonitor"));
const Backup = lazy(() => import("./pages/Backup"));

function Router() {
  return (
    <Switch>
      {/* Standalone login page - outside DashboardLayout */}
      <Route path="/login" component={Login} />

      {/* All other routes inside DashboardLayout */}
      <Route>
        <DashboardLayout>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Switch>
              {/* ── Critical path (eager) ── */}
              <Route path="/" component={Home} />

              {/* ── Ticket module ── */}
              <Route path="/tickets" component={Tickets} />
              <Route path="/tickets/new" component={CreateTicket} />
              <Route path="/tickets/:id" component={TicketDetail} />

              {/* ── Procurement module ── */}
              <Route path="/purchase-orders" component={PurchaseOrders} />
              <Route path="/purchase-orders/new" component={CreatePurchaseOrder} />
              <Route path="/purchase-orders/:id" component={PurchaseOrderDetail} />
              <Route path="/purchase-cycle" component={PurchaseCycle} />
              <Route path="/my-items" component={MyItems} />
              <Route path="/inventory" component={Inventory} />

              {/* ── Reports module ── */}
              <Route path="/reports" component={Reports} />
              <Route path="/reports/technicians" component={TechnicianReport} />
              <Route path="/reports/purchase-cycle" component={PurchaseCycleReport} />
              <Route path="/reports/maintenance-cycle" component={MaintenanceCycleReport} />
              <Route path="/reports/section-report" component={SectionReport} />
              <Route path="/reports/preventive" component={PreventiveReport} />
              <Route path="/reports/cost" component={CostReport} />

              {/* ── Admin / Settings module ── */}
              <Route path="/users" component={UsersPage} />
              <Route path="/sites" component={Sites} />
              <Route path="/sections" component={Sections} />
              <Route path="/technicians" component={Technicians} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/audit-log" component={AuditLog} />
              <Route path="/ai-assistant" component={AIAssistant} />
              <Route path="/translation-monitor" component={TranslationMonitor} />
              <Route path="/backup" component={Backup} />

              {/* ── Asset module ── */}
              <Route path="/assets" component={Assets} />
              <Route path="/assets/history" component={AssetHistory} />
              <Route path="/assets/metrics" component={AssetMetrics} />
              <Route path="/asset-categories" component={AssetCategories} />
              <Route path="/asset/:id" component={AssetDetail} />
              <Route path="/scan-asset" component={ScanAsset} />

              {/* ── Maintenance / PM module ── */}
              <Route path="/preventive" component={PreventiveMaintenance} />
              <Route path="/triage" component={TriageDashboard} />
              <Route path="/gate-security" component={GateSecurity} />
              <Route path="/inspection-dashboard" component={Dashboard} />

              {/* ── Fallback ── */}
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
