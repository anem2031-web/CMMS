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
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, ClipboardList, ShoppingCart,
  Package, BarChart3, Users, Bell, MapPin, Wrench, Shield,
  Brain, FileText, Settings
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { ROLE_LABELS } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

type MenuItem = {
  icon: any;
  label: string;
  path: string;
  roles?: string[];
  badge?: number;
};

const allMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/" },
  { icon: ClipboardList, label: "البلاغات", path: "/tickets" },
  { icon: ShoppingCart, label: "طلبات الشراء", path: "/purchase-orders" },
  { icon: Package, label: "المستودع", path: "/inventory", roles: ["warehouse", "maintenance_manager", "owner", "admin"] },
  { icon: BarChart3, label: "التقارير", path: "/reports", roles: ["owner", "admin", "senior_management", "accountant", "maintenance_manager"] },
  { icon: Wrench, label: "أداء الفنيين", path: "/reports/technicians", roles: ["owner", "admin", "senior_management", "maintenance_manager"] },
  { icon: Users, label: "المستخدمين", path: "/users", roles: ["owner", "admin"] },
  { icon: MapPin, label: "المواقع", path: "/sites", roles: ["owner", "admin", "maintenance_manager"] },
  { icon: Brain, label: "المساعد الذكي", path: "/ai-assistant", roles: ["owner", "admin", "senior_management", "maintenance_manager"] },
  { icon: Shield, label: "سجل التدقيق", path: "/audit-log", roles: ["owner", "admin"] },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="flex flex-col items-center gap-8 p-10 max-w-md w-full bg-card rounded-2xl shadow-xl border">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight">نظام إدارة الصيانة</h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              قم بتسجيل الدخول للوصول إلى لوحة التحكم وإدارة عمليات الصيانة
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all text-base font-medium"
          >
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (w: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30000 });

  const menuItems = allMenuItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || "");
  });

  const activeMenuItem = menuItems.find(item => location === item.path || (item.path !== "/" && location.startsWith(item.path)));

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
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

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-l-0 border-r" side="right" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center shrink-0">
                    <Wrench className="h-4 w-4 text-sidebar-primary" />
                  </div>
                  <span className="font-bold tracking-tight truncate text-sm">CMMS</span>
                </div>
              )}
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 py-1 gap-0.5">
              {menuItems.map(item => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {/* Notifications - always visible */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location === "/notifications"}
                  onClick={() => setLocation("/notifications")}
                  tooltip="الإشعارات"
                  className="h-10 transition-all font-normal"
                >
                  <div className="relative">
                    <Bell className={`h-4 w-4 ${location === "/notifications" ? "text-sidebar-primary" : ""}`} />
                    {(unreadCount || 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <span>الإشعارات</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-sidebar-accent/50 transition-colors w-full text-right group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-sidebar-primary/20 text-sidebar-primary">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-[11px] text-sidebar-foreground/60 truncate mt-1">
                      {ROLE_LABELS[user?.role || "user"] || user?.role}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  {user?.email || ""}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-medium text-sm">{activeMenuItem?.label ?? "القائمة"}</span>
            </div>
            <div className="relative cursor-pointer" onClick={() => setLocation("/notifications")}>
              <Bell className="h-5 w-5 text-muted-foreground" />
              {(unreadCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
