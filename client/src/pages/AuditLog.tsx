import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  approve: "bg-teal-100 text-teal-700",
  reject: "bg-red-100 text-red-700",
  assign: "bg-amber-100 text-amber-700",
  login: "bg-gray-100 text-gray-700",
  status_change: "bg-violet-100 text-violet-700",
};

export default function AuditLog() {
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const { data: logs, isLoading } = trpc.audit.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const getActionLabel = (action: string) => (t.audit as any)[action] || action;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.audit.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.audit.action}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}</div>
      ) : !logs?.length ? (
        <Card><CardContent className="p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{t.common.noData}</h3>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const actor = users?.find(u => u.id === log.userId);
            return (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge className={`text-[10px] shrink-0 ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"}`}>
                        {getActionLabel(log.action)}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{getActionLabel(log.action)} - {log.entityType}</p>
                        <p className="text-xs text-muted-foreground">{actor?.name || t.common.all} — {log.entityType} {log.entityId ? `#${log.entityId}` : ""}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleString(locale)}</span>
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
