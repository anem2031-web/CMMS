import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Notifications() {
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const markReadMut = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllReadMut = trpc.notifications.markAllRead.useMutation({ onSuccess: () => { toast.success(t.common.save); refetch(); } });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.notifications.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} ${t.notifications.unread}` : t.notifications.noNotifications}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllReadMut.mutate()} disabled={markAllReadMut.isPending} className="gap-2">
            <CheckCheck className="w-4 h-4" /> {t.notifications.markAllRead}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>)}</div>
      ) : !notifications?.length ? (
        <Card><CardContent className="p-12 text-center">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{t.notifications.noNotifications}</h3>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className={`hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer ${!n.isRead ? "border-primary/30 bg-primary/5" : ""}`}
              onClick={() => { if (!n.isRead) markReadMut.mutate({ id: n.id }); }}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{n.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString(locale)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
