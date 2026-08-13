import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Search, UserRound, Building2, Clock3, ArrowLeft } from "lucide-react";
import { STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";
import { MAINTENANCE_INSPECTION_WORKFLOW_STATUS, MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "@shared/roles";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { useTranslatedField } from "@/hooks/useTranslatedField";
import { useTranslation } from "@/contexts/LanguageContext";
import { TICKET_ITEM_STEPS, getTicketItemStepIndex } from "@/lib/ticketItemSteps";

const inspectionStatusLabel = (value?: string | null) => {
  switch (value) {
    case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION: return "بانتظار نتيجة الفحص";
    case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW: return "بانتظار اعتماد النتيجة";
    case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.RETURNED_FOR_CORRECTION: return "الفحص معاد للتصحيح";
    case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED: return "الفحص معتمد";
    default: return null;
  }
};

const MANAGER_ACTION_STATUSES = new Set([
  "under_inspection",
  "work_approved",
  "needs_purchase",
  "purchase_pending_estimate",
  "purchase_approved",
  "partial_purchase",
  "purchased",
  "received_warehouse",
  "ready_for_closure",
  "repaired",
]);

export function ConstructionTicketsPanel() {
  const [, setLocation] = useLocation();
  const { language } = useTranslation();
  const { getStatusLabel, getPriorityLabel, getCategoryLabel } = useStaticLabels();
  const { getField } = useTranslatedField();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [technicianId, setTechnicianId] = useState("all");

  const { data: tickets = [], isLoading } = trpc.tickets.list.useQuery({
    maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
  });
  const { data: technicians = [] } = trpc.users.listTechnicians.useQuery();

  // بند "مهمتي" داخل كل بلاغ — الخطوة 2 من ميزة البلاغ متعدد الجهات (2026-08-08).
  // بعد إصلاح الصلاحيات بالخطوة 1، قد تظهر هنا بلاغات المستخدم فيها جهة ثانوية
  // (لا الرئيسية) — هذا الاستعلام يجلب بنده تحديدًا لعرضه بدل حقول البلاغ العامة.
  const ticketIds = useMemo(() => tickets.map((t: any) => t.id), [tickets]);
  const { data: myItems = [] } = trpc.tickets.myItemsForTickets.useQuery(
    { ticketIds },
    { enabled: ticketIds.length > 0 },
  );
  const myItemByTicketId = useMemo(() => {
    const map = new Map<number, any>();
    for (const item of myItems) {
      // بلاغ متعدد البنود قد يملك المستخدم أكثر من بند فيه (حالة نادرة) — نعرض الأول فقط.
      if (!map.has(item.ticketId)) map.set(item.ticketId, item);
    }
    return map;
  }, [myItems]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((ticket: any) => {
      if (status !== "all" && ticket.status !== status) return false;
      if (technicianId !== "all" && ticket.assignedToId !== Number(technicianId)) return false;
      if (!query) return true;
      return [ticket.ticketNumber, ticket.title, ticket.description, ticket.locationDetail]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [tickets, search, status, technicianId]);

  const actionable = useMemo(
    () => filtered.filter((ticket: any) => MANAGER_ACTION_STATUSES.has(ticket.status)),
    [filtered],
  );

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";

  const renderTickets = (items: any[]) => {
    if (isLoading) {
      return <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
      ))}</div>;
    }

    if (items.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="mx-auto mb-3 h-11 w-11 text-muted-foreground/40" />
            <h3 className="font-semibold">لا توجد بلاغات إنشائية مطابقة</h3>
            <p className="mt-1 text-sm text-muted-foreground">تظهر هنا البلاغات التي تم توجيهها إلى قسم الإنشاءات بعد الفرز.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((ticket: any) => {
          // بند "مهمتي" — يُعرَض فقط عندما يمثّل مهمة إضافية (بند رقم >1) أو
          // مسارًا مختلفًا عن رأس البلاغ، تفاديًا لتكرار نفس المعلومة مرتين
          // للبلاغات أحادية البند (الأغلبية الساحقة، بما فيها كل البلاغات القديمة).
          const myItem = myItemByTicketId.get(ticket.id);
          const showItemCard = myItem && myItem.itemNumber > 1;
          const currentStep = showItemCard ? getTicketItemStepIndex(myItem.status, myItem.maintenancePath) : null;

          return (
          <Card
            key={ticket.id}
            className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
            onClick={() => setLocation(`/tickets/${ticket.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                    {showItemCard && (
                      <Badge variant="outline" className="text-purple-700 border-purple-300">بند {myItem.itemNumber}</Badge>
                    )}
                    <Badge className={STATUS_COLORS[showItemCard ? myItem.status : ticket.status] || "bg-gray-100 text-gray-700"}>
                      {getStatusLabel(showItemCard ? myItem.status : ticket.status)}
                    </Badge>
                    <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority] || ""}>{getPriorityLabel(ticket.priority)}</Badge>
                    {ticket.status === "under_inspection" && inspectionStatusLabel(ticket.inspectionWorkflowStatus) && (
                      <Badge variant="secondary">{inspectionStatusLabel(ticket.inspectionWorkflowStatus)}</Badge>
                    )}
                  </div>
                  <h3 className="truncate font-semibold">{getField(ticket, "title")}</h3>
                  {showItemCard && myItem.description && (
                    <p className="mt-1 text-sm text-muted-foreground">المطلوب: {myItem.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{getCategoryLabel(ticket.category)}</span>
                    <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{ticket.assignedToUserName || "لم يُعيّن فني بعد"}</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{new Date(ticket.updatedAt || ticket.createdAt).toLocaleDateString(locale)}</span>
                  </div>
                  {showItemCard && currentStep !== null && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {TICKET_ITEM_STEPS.map((step, idx) => (
                        <span key={step.key} className={`text-[10px] px-1.5 py-0.5 rounded ${
                          idx === currentStep ? "bg-blue-100 text-blue-700 font-semibold" :
                          idx < currentStep ? "bg-emerald-50 text-emerald-600" : "text-muted-foreground/50"
                        }`}>
                          {idx < currentStep ? "✓ " : ""}{step.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={(event) => {
                  event.stopPropagation();
                  setLocation(`/tickets/${ticket.id}`);
                }}>
                  فتح البلاغ <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-900/40">
            <Building2 className="h-5 w-5 text-stone-700 dark:text-stone-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">بلاغات الإنشاءات</h1>
            <p className="text-sm text-muted-foreground">متابعة البلاغات المحوّلة إلى قسم الإنشاءات من بعد الفرز حتى الإغلاق.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">بحث</span>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رقم البلاغ أو العنوان أو الوصف..." />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">الحالة</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {Array.from(new Set(tickets.map((ticket: any) => ticket.status))).map((value: any) => (
                <SelectItem key={value} value={value}>{getStatusLabel(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">الفني المسؤول</span>
          <Select value={technicianId} onValueChange={setTechnicianId}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفنيين</SelectItem>
              {technicians.map((technician: any) => (
                <SelectItem key={technician.id} value={String(technician.id)}>{technician.name || technician.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="actionable" dir="rtl">
        <TabsList>
          <TabsTrigger value="actionable">بانتظار إجرائي ({actionable.length})</TabsTrigger>
          <TabsTrigger value="all">جميع بلاغات الإنشاءات ({filtered.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="actionable" className="mt-4">{renderTickets(actionable)}</TabsContent>
        <TabsContent value="all" className="mt-4">{renderTickets(filtered)}</TabsContent>
      </Tabs>
    </div>
  );
}


/**
 * Backward-compatible route target. The construction ticket workspace now lives
 * inside /tickets as a permission-aware tab.
 */
export default function ConstructionTicketsRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/tickets?tab=construction");
  }, [setLocation]);

  return null;
}
