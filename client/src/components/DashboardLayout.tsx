import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import Login from "@/pages/Login";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, ClipboardList, ShoppingCart,
  Package, BarChart3, Users, Bell, MapPin, Wrench, Shield,
  Brain, ShoppingBag, Truck, Languages, Database,
  HardDrive, CalendarClock, ScanSearch, DoorOpen, Nfc,
  ChevronDown, Search, X, Building2, UserCog, Download, Smartphone
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// ─── Types ────────────────────────────────────────────────────────────────────
type MenuItemDef = {
  icon: any;
  labelKey: string;
  path: string;
  roles?: string[];
};

type NavSection = {
  id: string;
  labelKey: string;
  icon: any;
  items: MenuItemDef[];
  /** roles that can see this entire section; undefined = all */
  roles?: string[];
};

// ─── Navigation Structure ─────────────────────────────────────────────────────
const NAV_SECTIONS: NavSection[] = [
  {
    id: "core",
    labelKey: "nav.sections.coreOps",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/" },
      { icon: ClipboardList,   labelKey: "nav.tickets",   path: "/tickets" },
      { icon: Nfc,             labelKey: "nav.scanAsset", path: "/scan-asset",
        roles: ["operator","technician","maintenance_manager","supervisor","gate_security","owner","admin"] },
      { icon: ScanSearch,      labelKey: "nav.triage",    path: "/triage",
        roles: ["supervisor","maintenance_manager","owner","admin"] },
      { icon: DoorOpen,        labelKey: "nav.gateSecurity", path: "/gate-security",
        roles: ["gate_security","owner","admin"] },
    ],
  },
  {
    id: "logistics",
    labelKey: "nav.sections.logistics",
    icon: ShoppingCart,
    roles: ["delegate","warehouse","accountant","senior_management","maintenance_manager","owner","admin"],
    items: [
      { icon: ShoppingCart, labelKey: "nav.purchaseOrders", path: "/purchase-orders" },
      { icon: Truck,        labelKey: "nav.purchaseCycle",  path: "/purchase-cycle",
        roles: ["delegate","warehouse","owner","admin"] },
      { icon: ShoppingBag,  labelKey: "nav.myItems",        path: "/my-items",
        roles: ["delegate","owner","admin"] },
      { icon: Package,      labelKey: "nav.inventory",      path: "/inventory",
        roles: ["warehouse","maintenance_manager","owner","admin"] },
    ],
  },
  {
    id: "management",
    labelKey: "nav.sections.management",
    icon: BarChart3,
    roles: ["supervisor","maintenance_manager","accountant","senior_management","owner","admin"],
    items: [
      { icon: BarChart3,     labelKey: "nav.reports",          path: "/reports",
        roles: ["owner","admin","senior_management","accountant","maintenance_manager"] },
      { icon: Wrench,        labelKey: "nav.technicianReport",  path: "/reports/technicians",
        roles: ["owner","admin","senior_management","maintenance_manager"] },
      { icon: ShoppingCart,  labelKey: "nav.purchaseCycleReport", path: "/reports/purchase-cycle",
        roles: ["owner","admin","senior_management","accountant","maintenance_manager"] },
      { icon: BarChart3,     labelKey: "nav.maintenanceCycleReport", path: "/reports/maintenance-cycle",
        roles: ["owner","admin","senior_management","maintenance_manager"] },
      { icon: Building2,     labelKey: "nav.sectionReport", path: "/reports/section-report",
        roles: ["owner","admin","senior_management","maintenance_manager"] },
      { icon: HardDrive,     labelKey: "nav.assets",            path: "/assets",
        roles: ["owner","admin","maintenance_manager"] },
      { icon: CalendarClock, labelKey: "nav.preventive",        path: "/preventive",
        roles: ["owner","admin","maintenance_manager"] },
      { icon: MapPin,        labelKey: "nav.sites",             path: "/sites",
        roles: ["owner","admin","maintenance_manager"] },
      { icon: Building2,     labelKey: "nav.sectionsPage",      path: "/sections",
        roles: ["owner","admin","maintenance_manager"] },
      { icon: UserCog,        labelKey: "nav.technicians",       path: "/technicians",
        roles: ["owner","admin","maintenance_manager","supervisor"] },
      { icon: Brain,         labelKey: "nav.aiAssistant",       path: "/ai-assistant",
        roles: ["owner","admin","senior_management","maintenance_manager"] },
    ],
  },
  {
    id: "admin",
    labelKey: "nav.sections.adminTools",
    icon: Shield,
    roles: ["owner","admin"],
    items: [
      { icon: Users,     labelKey: "nav.users",              path: "/users" },
      { icon: Shield,    labelKey: "nav.auditLog",           path: "/audit-log" },
      { icon: Database,  labelKey: "backup.title",           path: "/backup" },
      { icon: Languages, labelKey: "nav.translationMonitor", path: "/translation-monitor" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getNestedValue(obj: any, path: string): string {
  return path.split(".").reduce((o, k) => o?.[k], obj) || path;
}

function canSeeItem(item: MenuItemDef, role: string): boolean {
  if (!item.roles) return true;
  return item.roles.includes(role);
}

function canSeeSection(section: NavSection, role: string): boolean {
  if (!section.roles) return true;
  return section.roles.includes(role);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const COLLAPSED_SECTIONS_KEY = "sidebar-collapsed-sections";
const DEFAULT_WIDTH = 268;
const MIN_WIDTH = 210;
const MAX_WIDTH = 400;

// ─── Root Component ───────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Login />;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

// ─── Inner Component ──────────────────────────────────────────────────────────
function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (w: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── PWA Install Prompt ──
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallTooltip, setShowInstallTooltip] = useState(false);

  // ── iOS Install Guide ──
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  // يظهر دائماً طالما لم يثبت — الإغلاق مؤقت للجلسة فقط (sessionStorage)
  const [showIOSGuide, setShowIOSGuide] = useState(() => {
    if (!isIOS || isInStandaloneMode) return false;
    return !sessionStorage.getItem('ios-guide-closed-this-session');
  });
  const dismissIOSGuide = () => {
    setShowIOSGuide(false);
    sessionStorage.setItem('ios-guide-closed-this-session', '1');
  };
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!sessionStorage.getItem('pwa-banner-closed-this-session')) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const handleInstallPWA = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
        localStorage.setItem('pwa-installed', '1');
      }
      setInstallPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // عرض tooltip توجيهي للمتصفحات التي لا تدعم beforeinstallprompt
      setShowInstallTooltip(true);
      setTimeout(() => setShowInstallTooltip(false), 4000);
    }
  };
  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa-banner-closed-this-session', '1');
  };
  // زر التثبيت يظهر دائماً ما لم يكن التطبيق مثبتاً
  const showInstallButton = !isInStandaloneMode && !localStorage.getItem('pwa-installed');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 5000 });
  const { data: latestNotifications } = trpc.notifications.list.useQuery(undefined, { refetchInterval: 5000 });

  // ── Live notification popup ──
  const [popupNotifs, setPopupNotifs] = useState<Array<{ id: number; title: string; message: string; type: string; relatedTicketId?: number | null }>>([])
  const prevNotifIdsRef = useRef<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("notif-sound-enabled");
    return saved === null ? true : saved === "true";
  });

  // ── Play notification sound ──
  const playNotifSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  useEffect(() => {
    if (!latestNotifications) return;
    const unread = latestNotifications.filter(n => !n.isRead);
    const currentIds = new Set(unread.map(n => n.id));
    const newNotifs = unread.filter(n => !prevNotifIdsRef.current.has(n.id) && prevNotifIdsRef.current.size > 0);
    if (newNotifs.length > 0) {
      setPopupNotifs(prev => [
        ...prev,
        ...newNotifs.map(n => ({ id: n.id, title: n.title, message: n.message, type: n.type || "info", relatedTicketId: n.relatedTicketId }))
      ]);
      newNotifs.forEach(n => {
        setTimeout(() => {
          setPopupNotifs(prev => prev.filter(p => p.id !== n.id));
        }, 8000);
      });
      if (soundEnabled) playNotifSound();
    }
    prevNotifIdsRef.current = currentIds;
  }, [latestNotifications, soundEnabled, playNotifSound]);

  const dismissPopup = useCallback((id: number) => {
    setPopupNotifs(prev => prev.filter(p => p.id !== id));
  }, []);

  // ── Notification color helpers ──
  const getNotifStyle = (type: string) => {
    switch (type) {
      case "critical":
      case "urgent":
        return {
          bg: "bg-red-50 dark:bg-red-950/40",
          border: "border-red-300 dark:border-red-700",
          iconBg: "bg-red-100 dark:bg-red-900/50",
          iconColor: "text-red-600 dark:text-red-400",
          dot: "bg-red-500",
        };
      case "warning":
      case "approval":
        return {
          bg: "bg-orange-50 dark:bg-orange-950/40",
          border: "border-orange-300 dark:border-orange-700",
          iconBg: "bg-orange-100 dark:bg-orange-900/50",
          iconColor: "text-orange-600 dark:text-orange-400",
          dot: "bg-orange-500",
        };
      default: // info, success
        return {
          bg: "bg-blue-50 dark:bg-blue-950/40",
          border: "border-blue-300 dark:border-blue-700",
          iconBg: "bg-blue-100 dark:bg-blue-900/50",
          iconColor: "text-blue-600 dark:text-blue-400",
          dot: "bg-blue-500",
        };
    }
  };

  const role = user?.role || "user";

  // ── Build visible sections with translated labels ──
  const visibleSections = useMemo(() => {
    return NAV_SECTIONS
      .filter(s => canSeeSection(s, role))
      .map(s => ({
        ...s,
        label: getNestedValue(t, s.labelKey),
        items: s.items
          .filter(item => canSeeItem(item, role))
          .map(item => ({ ...item, label: getNestedValue(t, item.labelKey) })),
      }))
      .filter(s => s.items.length > 0);
  }, [t, role]);

  // ── Search filter ──
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const results: { label: string; path: string; icon: any; section: string }[] = [];
    visibleSections.forEach(s => {
      s.items.forEach(item => {
        if (item.label.toLowerCase().includes(q)) {
          results.push({ label: item.label, path: item.path, icon: item.icon, section: s.label });
        }
      });
    });
    return results;
  }, [searchQuery, visibleSections]);

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // ── Resize logic ──
  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarRight = sidebarRef.current?.getBoundingClientRect().right ?? 0;
      const newWidth = sidebarRight - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const isItemActive = (path: string) =>
    location === path || (path !== "/" && location.startsWith(path));

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-l-0 border-r border-sidebar-border/40" side="right" disableTransition={isResizing}>

          {/* ── Header ── */}
          <SidebarHeader className="h-14 justify-center border-b border-sidebar-border/40 px-3">
            <div className="flex items-center gap-2.5 w-full">
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-sidebar-primary/15 flex items-center justify-center shrink-0">
                    <Wrench className="h-3.5 w-3.5 text-sidebar-primary" />
                  </div>
                  <span className="font-bold tracking-tight truncate text-[13px] text-sidebar-foreground">{t.appShort}</span>
                </div>
              )}
              <button
                onClick={toggleSidebar}
                className="h-7 w-7 flex items-center justify-center hover:bg-sidebar-accent rounded-md transition-colors shrink-0 ml-auto"
              >
                <PanelLeft className="h-3.5 w-3.5 text-sidebar-foreground/50" />
              </button>
            </div>
          </SidebarHeader>

          {/* ── Search Bar ── */}
          {!isCollapsed && (
            <div className="px-3 pt-3 pb-1">
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="بحث في القائمة..."
                  className="w-full h-8 bg-sidebar-accent/40 border border-sidebar-border/30 rounded-md pr-8 pl-7 text-[12px] text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary/40 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center hover:text-sidebar-foreground/80 text-sidebar-foreground/40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Content ── */}
          <SidebarContent className="gap-0 overflow-y-auto pt-1 pb-2">

            {/* Search Results */}
            {searchResults !== null ? (
              <div className="px-2 py-1">
                {searchResults.length === 0 ? (
                  <p className="text-[11px] text-sidebar-foreground/40 text-center py-4">لا توجد نتائج</p>
                ) : (
                  <SidebarMenu className="gap-0.5">
                    {searchResults.map(item => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isItemActive(item.path)}
                          onClick={() => { setLocation(item.path); setSearchQuery(""); }}
                          className="h-9 transition-all font-normal text-[13px]"
                        >
                          <item.icon className={`h-3.5 w-3.5 shrink-0 ${isItemActive(item.path) ? "text-sidebar-primary" : "text-sidebar-foreground/60"}`} />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate leading-none">{item.label}</span>
                            <span className="text-[10px] text-sidebar-foreground/40 truncate mt-0.5">{item.section}</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </div>
            ) : (
              /* Grouped Sections */
              visibleSections.map((section, sIdx) => {
                const isSectionCollapsed = collapsedSections.has(section.id);
                return (
                  <div key={section.id} className={sIdx > 0 ? "mt-1" : ""}>
                    {/* Section Header */}
                    {!isCollapsed && (
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between px-3 py-1.5 group"
                      >
                        <div className="flex items-center gap-1.5">
                          <section.icon className="h-3 w-3 text-sidebar-foreground/35" />
                          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
                            {section.label}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200 ${isSectionCollapsed ? "-rotate-90" : ""}`}
                        />
                      </button>
                    )}

                    {/* Section Items */}
                    {(!isSectionCollapsed || isCollapsed) && (
                      <SidebarMenu className={`px-2 gap-0.5 ${!isCollapsed ? "pb-1" : "py-1"}`}>
                        {section.items.map(item => {
                          const isActive = isItemActive(item.path);
                          return (
                            <SidebarMenuItem key={item.path}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => setLocation(item.path)}
                                tooltip={item.label}
                                className="h-9 transition-all font-normal text-[13px] group/item"
                              >
                                <item.icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/55 group-hover/item:text-sidebar-foreground/80"}`} />
                                <span className={`truncate ${isActive ? "font-medium" : ""}`}>{item.label}</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    )}

                    {/* Section Divider */}
                    {!isCollapsed && sIdx < visibleSections.length - 1 && (
                      <div className="mx-3 border-b border-sidebar-border/25" />
                    )}
                  </div>
                );
              })
            )}

            {/* ── Notifications (always visible) ── */}
            <div className={`px-2 ${!isCollapsed ? "mt-1 pt-1 border-t border-sidebar-border/25 mx-0" : ""}`}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location === "/notifications"}
                    onClick={() => setLocation("/notifications")}
                    tooltip={t.nav.notifications}
                    className="h-9 transition-all font-normal text-[13px]"
                  >
                    <div className="relative shrink-0">
                      <Bell className={`h-3.5 w-3.5 ${location === "/notifications" ? "text-sidebar-primary" : "text-sidebar-foreground/55"}`} />
                      {(unreadCount || 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold leading-none animate-pulse">
                          {(unreadCount || 0) > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <span>{t.nav.notifications}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>

          {/* ── Footer ── */}
          <SidebarFooter className="p-3 border-t border-sidebar-border/40">
            <div className="flex items-center justify-center gap-2 mb-2">
              <LanguageSwitcher compact={isCollapsed} />
              {/* ── زر التثبيت الثابت ── */}
              {showInstallButton && (
                <button
                  onClick={handleInstallPWA}
                  title="تثبيت التطبيق"
                  className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sidebar-primary/10 hover:bg-sidebar-primary/20 border border-sidebar-primary/20 hover:border-sidebar-primary/40 text-sidebar-primary transition-all duration-200 text-xs font-medium shrink-0"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  {!isCollapsed && (
                    <span className="whitespace-nowrap">تثبيت</span>
                  )}
                  {/* نقطة خضراء تشير للتثبيت */}
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-sidebar-background animate-pulse" />
                  {/* Tooltip توجيهي عند عدم دعم beforeinstallprompt */}
                  {showInstallTooltip && (
                    <div className="absolute bottom-full mb-2 right-0 w-56 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border p-3 z-50 text-right">
                      <p className="font-semibold mb-1">تثبيت التطبيق</p>
                      <p className="text-muted-foreground leading-relaxed">افتح القائمة في المتصفح ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"</p>
                      <div className="absolute bottom-[-5px] right-3 w-2.5 h-2.5 bg-popover border-b border-r border-border rotate-45" />
                    </div>
                  )}
                </button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors w-full text-right">
                  <Avatar className="h-8 w-8 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-[11px] font-bold bg-sidebar-primary/15 text-sidebar-primary">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium truncate leading-none text-sidebar-foreground">{user?.name || "-"}</p>
                      <p className="text-[10.5px] text-sidebar-foreground/50 truncate mt-0.5">
                        {(t.roles as any)[user?.role || "user"] || user?.role}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-2 text-xs text-muted-foreground">{user?.email || ""}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>{t.logout}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize Handle */}
        <div
          className={`absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-13 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-8 w-8 rounded-lg" />
              <span className="font-medium text-[13px]">
                {visibleSections.flatMap(s => s.items).find(i => isItemActive(i.path))?.label ?? t.nav.menu}
              </span>
            </div>
            <div className="relative cursor-pointer" onClick={() => setLocation("/notifications")}>
              <Bell className="h-5 w-5 text-muted-foreground" />
              {(unreadCount || 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">
                  {(unreadCount || 0) > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
          </div>
        )}
        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-indigo-600 text-white px-4 py-2.5 text-sm shadow-md" dir="rtl">
            <div className="flex items-center gap-2">
              <span className="text-lg">📲</span>
              <span className="font-medium">ثبّت التطبيق على جهازك للوصول السريع</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstallPWA}
                className="bg-white text-indigo-600 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                تثبيت
              </button>
              <button
                onClick={dismissInstallBanner}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>

      {/* ── iOS Install Guide ── */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center pb-6 px-4 bg-black/40 backdrop-blur-sm" dir="rtl">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="font-bold text-sm text-foreground">ثبّت التطبيق على iPhone</p>
                  <p className="text-xs text-muted-foreground">للوصول السريع بدون فتح المتصفح</p>
                </div>
              </div>
              <button onClick={dismissIOSGuide} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Steps */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">1</div>
                <p className="text-sm text-foreground">افتح هذا الرابط من متصفح <span className="font-bold text-primary">Safari</span></p>
              </div>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">2</div>
                <p className="text-sm text-foreground">اضغط على أيقونة المشاركة <span className="font-bold">⬆️</span> في أسفل الشاشة</p>
              </div>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">3</div>
                <p className="text-sm text-foreground">اختر <span className="font-bold text-primary">"إضافة إلى الشاشة الرئيسية"</span> من القائمة</p>
              </div>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">4</div>
                <p className="text-sm text-foreground">اضغط <span className="font-bold text-primary">"إضافة"</span> — يظهر التطبيق فوراً على شاشتك</p>
              </div>
            </div>
            {/* Dismiss */}
            <button
              onClick={dismissIOSGuide}
              className="w-full bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              فهمت، شكراً
            </button>
          </div>
        </div>
      )}

      {/* ── Live Notification Popups ── */}
      <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 max-w-sm" dir="rtl">
        {/* Sound toggle button */}
        {popupNotifs.length === 0 && (
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              localStorage.setItem("notif-sound-enabled", String(next));
            }}
            className="self-end text-[10px] text-muted-foreground hover:text-foreground bg-background/80 border border-border rounded-full px-2 py-0.5 backdrop-blur transition-colors"
            title={soundEnabled ? "إيقاف صوت التنبيه" : "تفعيل صوت التنبيه"}
          >
            {soundEnabled ? "🔔" : "🔕"}
          </button>
        )}
        {popupNotifs.map((notif) => {
          const style = getNotifStyle(notif.type);
          return (
            <div
              key={notif.id}
              className={`${style.bg} border ${style.border} rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300`}
              style={{ minWidth: 280 }}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-full ${style.iconBg} flex items-center justify-center`}>
                <Bell className={`w-4 h-4 ${style.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground leading-tight">{notif.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                <div className="flex gap-2 mt-2">
                  {notif.relatedTicketId && (
                    <button
                      onClick={() => { setLocation(`/tickets/${notif.relatedTicketId}`); dismissPopup(notif.id); }}
                      className={`text-xs font-medium hover:underline ${style.iconColor}`}
                    >
                      عرض البلاغ
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismissPopup(notif.id)}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
