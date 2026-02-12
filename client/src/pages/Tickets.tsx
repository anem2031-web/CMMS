import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";
import { Plus, Search, Filter, ClipboardList } from "lucide-react";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Tickets() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const { data: tickets, isLoading } = trpc.tickets.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">البلاغات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة ومتابعة بلاغات الصيانة</p>
        </div>
        <Button onClick={() => setLocation("/tickets/new")} className="gap-2">
          <Plus className="w-4 h-4" />
          بلاغ جديد
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم البلاغ أو العنوان..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="الأولوية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأولويات</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
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
            <h3 className="font-semibold text-lg mb-1">لا توجد بلاغات</h3>
            <p className="text-sm text-muted-foreground">لم يتم العثور على بلاغات مطابقة للبحث</p>
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
                        {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-sm truncate">{ticket.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString("ar-SA")}</span>
                    </div>
                  </div>
                  <Badge className={`status-badge shrink-0 ${STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                    {STATUS_LABELS[ticket.status] || ticket.status}
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
