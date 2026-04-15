import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Calendar, Clock, CheckSquare, AlertTriangle,
  Play, CheckCircle, Trash2, Edit, ClipboardList, RefreshCw,
} from "lucide-react";
import { nanoid } from "nanoid";

type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual";
type WOStatus = "scheduled" | "in_progress" | "completed" | "overdue" | "cancelled";

interface ChecklistItem {
  id: string;
  text: string;
  required?: boolean;
}

interface PlanForm {
  title: string;
  description: string;
  assetId: string;
  siteId: string;
  frequency: Frequency;
  frequencyValue: string;
  estimatedDurationMinutes: string;
  assignedToId: string;
  checklist: ChecklistItem[];
  nextDueDate: string;
}

const defaultPlanForm: PlanForm = {
  title: "", description: "", assetId: "", siteId: "",
  frequency: "monthly", frequencyValue: "1",
  estimatedDurationMinutes: "", assignedToId: "",
  checklist: [], nextDueDate: "",
};

const woStatusConfig: Record<WOStatus, { color: string; label: string }> = {
  scheduled: { color: "bg-blue-100 text-blue-800", label: "" },
  in_progress: { color: "bg-yellow-100 text-yellow-800", label: "" },
  completed: { color: "bg-green-100 text-green-800", label: "" },
  overdue: { color: "bg-red-100 text-red-800", label: "" },
  cancelled: { color: "bg-gray-100 text-gray-800", label: "" },
};

export default function PreventiveMaintenance() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("plans");
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(defaultPlanForm);
  const [deletePlanId, setDeletePlanId] = useState<number | null>(null);
  const [generateWOPlanId, setGenerateWOPlanId] = useState<number | null>(null);
  const [generateDate, setGenerateDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedWO, setSelectedWO] = useState<any | null>(null);
  const [newChecklistText, setNewChecklistText] = useState("");

  const utils = trpc.useUtils();

  const { data: plans = [], isLoading: plansLoading } = trpc.preventive.listPlans.useQuery({});
  const { data: workOrders = [], isLoading: woLoading } = trpc.preventive.listWorkOrders.useQuery({});
  const { data: assets = [] } = trpc.assets.list.useQuery({});
  const { data: sites = [] } = trpc.sites.list.useQuery();
  const { data: users = [] } = trpc.users.list.useQuery();

  const createPlanMut = trpc.preventive.createPlan.useMutation({
    onSuccess: () => {
      toast.success(t.preventive.planCreated);
      utils.preventive.listPlans.invalidate();
      setShowPlanForm(false);
      setPlanForm(defaultPlanForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePlanMut = trpc.preventive.updatePlan.useMutation({
    onSuccess: () => {
      toast.success(t.preventive.planUpdated);
      utils.preventive.listPlans.invalidate();
      setShowPlanForm(false);
      setEditPlanId(null);
      setPlanForm(defaultPlanForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePlanMut = trpc.preventive.deletePlan.useMutation({
    onSuccess: () => {
      toast.success(t.common.deletedSuccessfully);
      utils.preventive.listPlans.invalidate();
      setDeletePlanId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const generateWOMut = trpc.preventive.generateWorkOrder.useMutation({
    onSuccess: () => {
      toast.success(t.preventive.workOrderCreated);
      utils.preventive.listWorkOrders.invalidate();
      utils.preventive.listPlans.invalidate();
      setGenerateWOPlanId(null);
      setTab("workOrders");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateWOMut = trpc.preventive.updateWorkOrder.useMutation({
    onSuccess: () => {
      toast.success(t.preventive.workOrderUpdated);
      utils.preventive.listWorkOrders.invalidate();
      setSelectedWO(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePlanSubmit = () => {
    const payload = {
      title: planForm.title,
      description: planForm.description || undefined,
      assetId: planForm.assetId ? Number(planForm.assetId) : undefined,
      siteId: planForm.siteId ? Number(planForm.siteId) : undefined,
      frequency: planForm.frequency,
      frequencyValue: planForm.frequencyValue ? Number(planForm.frequencyValue) : 1,
      estimatedDurationMinutes: planForm.estimatedDurationMinutes ? Number(planForm.estimatedDurationMinutes) : undefined,
      assignedToId: planForm.assignedToId ? Number(planForm.assignedToId) : undefined,
      checklist: planForm.checklist,
      nextDueDate: planForm.nextDueDate || undefined,
    };
    if (editPlanId) {
      updatePlanMut.mutate({ id: editPlanId, ...payload });
    } else {
      createPlanMut.mutate(payload);
    }
  };

  const openEditPlan = (plan: any) => {
    setEditPlanId(plan.id);
    setPlanForm({
      title: plan.title ?? "",
      description: plan.description ?? "",
      assetId: plan.assetId ? String(plan.assetId) : "",
      siteId: plan.siteId ? String(plan.siteId) : "",
      frequency: plan.frequency ?? "monthly",
      frequencyValue: plan.frequencyValue ? String(plan.frequencyValue) : "1",
      estimatedDurationMinutes: plan.estimatedDurationMinutes ? String(plan.estimatedDurationMinutes) : "",
      assignedToId: plan.assignedToId ? String(plan.assignedToId) : "",
      checklist: plan.checklist ?? [],
      nextDueDate: plan.nextDueDate ? new Date(plan.nextDueDate).toISOString().split("T")[0] : "",
    });
    setShowPlanForm(true);
  };

  const addChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setPlanForm(f => ({
      ...f,
      checklist: [...f.checklist, { id: nanoid(), text: newChecklistText.trim() }],
    }));
    setNewChecklistText("");
  };

  const removeChecklistItem = (id: string) => {
    setPlanForm(f => ({ ...f, checklist: f.checklist.filter(c => c.id !== id) }));
  };

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      total: plans.length,
      overdue: plans.filter((p: any) => p.nextDueDate && new Date(p.nextDueDate) < now).length,
      upcoming: plans.filter((p: any) => {
        if (!p.nextDueDate) return false;
        const d = new Date(p.nextDueDate);
        return d >= now && d <= weekFromNow;
      }).length,
      pendingWO: workOrders.filter((w: any) => w.status === "scheduled" || w.status === "in_progress").length,
    };
  }, [plans, workOrders]);

  const freqLabel = (f: Frequency) => {
    const map: Record<Frequency, string> = {
      daily: t.preventive.daily,
      weekly: t.preventive.weekly,
      monthly: t.preventive.monthly,
      quarterly: t.preventive.quarterly,
      biannual: t.preventive.biannual,
      annual: t.preventive.annual,
    };
    return map[f] ?? f;
  };

  const woStatusLabel = (s: WOStatus) => {
    const map: Record<WOStatus, string> = {
      scheduled: t.preventive.scheduled,
      in_progress: t.preventive.in_progress,
      completed: t.preventive.completed,
      overdue: t.preventive.overdue,
      cancelled: t.preventive.cancelled,
    };
    return map[s] ?? s;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.preventive.title}</h1>
          <p className="text-muted-foreground text-sm">{t.preventive.description}</p>
        </div>
        {tab === "plans" && (
          <Button onClick={() => { setEditPlanId(null); setPlanForm(defaultPlanForm); setShowPlanForm(true); }}>
            <Plus className="h-4 w-4 ml-2" />
            {t.preventive.addPlan}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t.preventive.plans}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">{t.preventive.overduePlans}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{stats.upcoming}</p>
              <p className="text-xs text-muted-foreground">{t.preventive.upcomingThisWeek}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Play className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.pendingWO}</p>
              <p className="text-xs text-muted-foreground">{t.preventive.workOrders}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plans">{t.preventive.plans}</TabsTrigger>
          <TabsTrigger value="workOrders">{t.preventive.workOrders}</TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="mt-4">
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-40 bg-muted/30" /></Card>)}
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t.preventive.noPlans}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan: any) => {
                const isOverdue = plan.nextDueDate && new Date(plan.nextDueDate) < new Date();
                return (
                  <Card key={plan.id} className={`hover:shadow-md transition-shadow ${isOverdue ? "border-red-200" : ""}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">{plan.planNumber}</p>
                          <CardTitle className="text-base truncate">{plan.title}</CardTitle>
                        </div>
                        <Badge variant="outline" className="shrink-0">{freqLabel(plan.frequency)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {plan.nextDueDate && (
                        <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          <Calendar className="h-3 w-3" />
                          {t.preventive.nextDueDate}: {new Date(plan.nextDueDate).toLocaleDateString()}
                          {isOverdue && <AlertTriangle className="h-3 w-3 mr-1" />}
                        </div>
                      )}
                      {plan.estimatedDurationMinutes && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {plan.estimatedDurationMinutes} {t.common.description.includes("دق") ? "دقيقة" : "min"}
                        </div>
                      )}
                      {plan.checklist && plan.checklist.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckSquare className="h-3 w-3" />
                          {plan.checklist.length} {t.preventive.checklist}
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="default" className="flex-1" onClick={() => { setGenerateWOPlanId(plan.id); setGenerateDate(new Date().toISOString().split("T")[0]); }}>
                          <Play className="h-3 w-3 ml-1" />
                          {t.preventive.generateWorkOrder}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeletePlanId(plan.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Work Orders Tab */}
        <TabsContent value="workOrders" className="mt-4">
          {woLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20 bg-muted/30" /></Card>)}
            </div>
          ) : workOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t.preventive.noWorkOrders}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workOrders.map((wo: any) => {
                const cfg = woStatusConfig[wo.status as WOStatus] ?? woStatusConfig.scheduled;
                return (
                  <Card key={wo.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setSelectedWO(wo)}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{wo.workOrderNumber}</p>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            {woStatusLabel(wo.status)}
                          </span>
                        </div>
                        <p className="font-medium truncate">{wo.title}</p>
                        {wo.scheduledDate && (
                          <p className="text-xs text-muted-foreground">
                            {t.preventive.scheduledDate}: {new Date(wo.scheduledDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {wo.checklistResults && wo.checklistResults.length > 0 && (
                        <div className="text-xs text-muted-foreground shrink-0">
                          {wo.checklistResults.filter((c: any) => c.done).length}/{wo.checklistResults.length}
                          <CheckSquare className="h-3 w-3 inline mr-1" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Plan Form Dialog */}
      <Dialog open={showPlanForm} onOpenChange={(o) => { if (!o) { setShowPlanForm(false); setEditPlanId(null); setPlanForm(defaultPlanForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPlanId ? t.preventive.editPlan : t.preventive.addPlan}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{t.preventive.planTitle} *</Label>
              <Input value={planForm.title} onChange={e => setPlanForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>{t.preventive.frequency}</Label>
              <Select value={planForm.frequency} onValueChange={v => setPlanForm(f => ({ ...f, frequency: v as Frequency }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["daily","weekly","monthly","quarterly","biannual","annual"] as Frequency[]).map(f => (
                    <SelectItem key={f} value={f}>{freqLabel(f)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.preventive.estimatedDuration}</Label>
              <Input type="number" value={planForm.estimatedDurationMinutes} onChange={e => setPlanForm(f => ({ ...f, estimatedDurationMinutes: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.location}</Label>
              <Select value={planForm.siteId} onValueChange={v => setPlanForm(f => ({ ...f, siteId: v }))}>
                <SelectTrigger><SelectValue placeholder={t.common.none} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.common.none}</SelectItem>
                  {sites.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.preventive.assignedTo}</Label>
              <Select value={planForm.assignedToId} onValueChange={v => setPlanForm(f => ({ ...f, assignedToId: v }))}>
                <SelectTrigger><SelectValue placeholder={t.common.none} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.common.none}</SelectItem>
                  {users.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.preventive.nextDueDate}</Label>
              <Input type="date" value={planForm.nextDueDate} onChange={e => setPlanForm(f => ({ ...f, nextDueDate: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.assetName}</Label>
              <Select value={planForm.assetId} onValueChange={v => setPlanForm(f => ({ ...f, assetId: v }))}>
                <SelectTrigger><SelectValue placeholder={t.common.none} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.common.none}</SelectItem>
                  {assets.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>{t.common.description}</Label>
              <Textarea value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            {/* Checklist */}
            <div className="col-span-2">
              <Label>{t.preventive.checklist}</Label>
              <div className="space-y-2 mt-1">
                {planForm.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-1.5">
                    <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">{item.text}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeChecklistItem(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder={t.preventive.addChecklistItem}
                    value={newChecklistText}
                    onChange={e => setNewChecklistText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
                  />
                  <Button type="button" variant="outline" onClick={addChecklistItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPlanForm(false); setEditPlanId(null); setPlanForm(defaultPlanForm); }}>
              {t.common.cancel}
            </Button>
            <Button onClick={handlePlanSubmit} disabled={!planForm.title || createPlanMut.isPending || updatePlanMut.isPending}>
              {createPlanMut.isPending || updatePlanMut.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Work Order Dialog */}
      <Dialog open={!!generateWOPlanId} onOpenChange={(o) => { if (!o) setGenerateWOPlanId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.preventive.generateWorkOrder}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>{t.preventive.scheduledDate}</Label>
            <Input type="date" value={generateDate} onChange={e => setGenerateDate(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateWOPlanId(null)}>{t.common.cancel}</Button>
            <Button
              onClick={() => generateWOPlanId && generateWOMut.mutate({ planId: generateWOPlanId, scheduledDate: generateDate })}
              disabled={generateWOMut.isPending}
            >
              {generateWOMut.isPending ? t.common.saving : t.preventive.generateWorkOrder}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Work Order Detail Dialog */}
      {selectedWO && (
        <Dialog open={!!selectedWO} onOpenChange={(o) => { if (!o) setSelectedWO(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedWO.workOrderNumber} - {selectedWO.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select
                  value={selectedWO.status}
                  onValueChange={v => setSelectedWO((w: any) => ({ ...w, status: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["scheduled","in_progress","completed","overdue","cancelled"] as WOStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{woStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Checklist */}
              {selectedWO.checklistResults && selectedWO.checklistResults.length > 0 && (
                <div>
                  <Label className="mb-2 block">{t.preventive.checklist}</Label>
                  <div className="space-y-2">
                    {selectedWO.checklistResults.map((item: any, idx: number) => (
                      <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-2">
                        <Checkbox
                          checked={item.done ?? false}
                          onCheckedChange={(checked) => {
                            const updated = [...selectedWO.checklistResults];
                            updated[idx] = { ...item, done: !!checked };
                            setSelectedWO((w: any) => ({ ...w, checklistResults: updated }));
                          }}
                        />
                        <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>{t.preventive.technicianNotes}</Label>
                <Textarea
                  value={selectedWO.technicianNotes ?? ""}
                  onChange={e => setSelectedWO((w: any) => ({ ...w, technicianNotes: e.target.value }))}
                  rows={3}
                  className="mt-1"
                />
              </div>
              {selectedWO.status === "completed" && (
                <div>
                  <Label>{t.preventive.completedDate}</Label>
                  <Input
                    type="date"
                    value={selectedWO.completedDate ? new Date(selectedWO.completedDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]}
                    onChange={e => setSelectedWO((w: any) => ({ ...w, completedDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedWO(null)}>{t.common.cancel}</Button>
              <Button
                onClick={() => updateWOMut.mutate({
                  id: selectedWO.id,
                  status: selectedWO.status,
                  checklistResults: selectedWO.checklistResults,
                  technicianNotes: selectedWO.technicianNotes,
                  completedDate: selectedWO.completedDate,
                })}
                disabled={updateWOMut.isPending}
              >
                {updateWOMut.isPending ? t.common.saving : t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Plan Confirm */}
      <Dialog open={!!deletePlanId} onOpenChange={(o) => { if (!o) setDeletePlanId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.preventive.editPlan}</DialogTitle></DialogHeader>
          <p>{t.common.deleteWarning}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePlanId(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deletePlanId && deletePlanMut.mutate({ id: deletePlanId })} disabled={deletePlanMut.isPending}>
              {deletePlanMut.isPending ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
