import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, AlertTriangle, Clock, Info, BellOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// ── Notification type styling ──────────────────────────────────────────────────
function getNotifStyle(type: string) {
  switch (type) {
    case "critical":
    case "urgent":
      return {
        cardBorder: "border-red-300 dark:border-red-700",
        cardBg: "bg-red-50/60 dark:bg-red-950/30",
        iconBg: "bg-red-100 dark:bg-red-900/40",
        iconColor: "text-red-600 dark:text-red-400",
        dot: "bg-red-500",
        label: "حرجة",
        labelColor: "text-red-600 dark:text-red-400",
        Icon: AlertTriangle,
      };
    case "warning":
    case "approval":
      return {
        cardBorder: "border-orange-300 dark:border-orange-700",
        cardBg: "bg-orange-50/60 dark:bg-orange-950/30",
        iconBg: "bg-orange-100 dark:bg-orange-900/40",
        iconColor: "text-orange-600 dark:text-orange-400",
        dot: "bg-orange-500",
        label: "تنبيه",
        labelColor: "text-orange-600 dark:text-orange-400",
        Icon: Clock,
      };
    default:
      return {
        cardBorder: "border-blue-200 dark:border-blue-800",
        cardBg: "bg-blue-50/40 dark:bg-blue-950/20",
        iconBg: "bg-blue-100 dark:bg-blue-900/40",
        iconColor: "text-blue-600 dark:text-blue-400",
        dot: "bg-blue-500",
        label: "معلومة",
        labelColor: "text-blue-600 dark:text-blue-400",
        Icon: Info,
      };
  }
}

export default function Notifications() {
  const { t, language } = useTranslation();
  const [, setLocation] = useLocation();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const markReadMut = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllReadMut = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { toast.success(t.common.save); refetch(); }
  });

  const { isSupported, permission, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success("تم إيقاف إشعارات الجوال");
    } else {
      const ok = await subscribe();
      if (ok) toast.success("تم تفعيل إشعارات الجوال بنجاح!");
      else if (permission === "denied") toast.error("تم رفض الإذن. يرجى السماح بالإشعارات من إعدادات المتصفح.");
      else toast.error("فشل تفعيل الإشعارات");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.notifications.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} ${t.notifications.unread}` : t.notifications.noNotifications}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Web Push Toggle */}
          {isSupported && (
            <Button
              variant={isSubscribed ? "default" : "outline"}
              size="sm"
              onClick={handlePushToggle}
              disabled={pushLoading || permission === "denied"}
              className="gap-2"
              title={permission === "denied" ? "الإشعارات محظورة في المتصفح" : undefined}
            >
              {isSubscribed ? (
                <><BellOff className="w-4 h-4" /> إيقاف إشعارات الجوال</>
              ) : (
                <><Smartphone className="w-4 h-4" /> تفعيل إشعارات الجوال</>
              )}
            </Button>
          )}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMut.mutate()}
              disabled={markAllReadMut.isPending}
              className="gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              {t.notifications.markAllRead}
            </Button>
          )}
        </div>
      </div>

      {/* Push status banner */}
      {isSupported && !isSubscribed && permission !== "denied" && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>فعّل إشعارات الجوال لتصلك التنبيهات حتى عند إغلاق التطبيق.</span>
          <Button size="sm" variant="outline" className="mr-auto text-xs h-7 border-blue-300 text-blue-700 hover:bg-blue-100" onClick={handlePushToggle} disabled={pushLoading}>
            تفعيل الآن
          </Button>
        </div>
      )}
      {permission === "denied" && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-300">
          <BellOff className="w-4 h-4 shrink-0" />
          <span>إشعارات الجوال محظورة. اذهب إلى إعدادات المتصفح وأعطِ الإذن لهذا الموقع.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !notifications?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">{t.notifications.noNotifications}</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const style = getNotifStyle(n.type || "info");
            const NIcon = style.Icon;
            return (
              <Card
                key={n.id}
                className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
                  !n.isRead
                    ? `${style.cardBorder} ${style.cardBg}`
                    : "border-border"
                }`}
                onClick={() => { if (!n.isRead) markReadMut.mutate({ id: n.id }); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded-full ${!n.isRead ? style.iconBg : "bg-muted"} flex items-center justify-center`}>
                      <NIcon className={`w-4 h-4 ${!n.isRead ? style.iconColor : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm">{n.title}</h3>
                        {!n.isRead && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${style.iconBg} ${style.labelColor}`}>
                            {style.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString(locale)}
                        </p>
                        {n.relatedTicketId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!n.isRead) markReadMut.mutate({ id: n.id });
                              setLocation(`/tickets/${n.relatedTicketId}`);
                            }}
                            className={`text-[10px] font-medium hover:underline ${style.iconColor}`}
                          >
                            عرض البلاغ ←
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`shrink-0 w-2 h-2 rounded-full mt-2 ${!n.isRead ? style.dot : "bg-transparent"}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
