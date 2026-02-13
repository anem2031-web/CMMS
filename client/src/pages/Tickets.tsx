import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";
import { Plus, Search, ClipboardList } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";

export default function Tickets() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const { t, language } = useTranslation();
  const { getStatusLabel, getPriorityLabel, getCategoryLabel } = useStaticLabels();

  const { data: tickets, isLoading } = trpc.tickets.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    search: search || undefined,
  });

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.tickets.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.tickets.description}</p>
        </div>
        <Button onClick={() => setLocation("/tickets/new")} className="gap-2">
          <Plus className="w-4 h-4" />
          {t.tickets.createNew}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`${t.common.search}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t.common.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            {Object.keys(t.ticketStatus).map(k => (
              <SelectItem key={k} value={k}>{getStatusLabel(k)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t.tickets.priority} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            {Object.keys(t.priority).map(k => (
              <SelectItem key={k} value={k}>{getPriorityLabel(k)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !tickets?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">{t.tickets.noTickets}</h3>
            <p className="text-sm text-muted-foreground">{t.common.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => (
            <Card
              key={ticket.id}
              className="hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer"
              onClick={() => setLocation(`/tickets/${ticket.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                      <Badge variant="outline" className={`text-[11px] ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                        {getPriorityLabel(ticket.priority)}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-sm truncate">{ticket.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{getCategoryLabel(ticket.category)}</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString(locale)}</span>
                    </div>
                  </div>
                  <Badge className={`status-badge shrink-0 ${STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                    {getStatusLabel(ticket.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
