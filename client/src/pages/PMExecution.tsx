import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Wrench, AlertTriangle, ChevronRight,
  Clock, MapPin, Tag, ClipboardList, ArrowLeft, Loader2,
  CheckSquare, Flag,
} from "lucide-react";
import { useLocation } from "wouter";

interface PMExecutionProps {
  workOrderId: number;
  onClose?: () => void;
}

export default function PMExecution({ workOrderId, onClose }: PMExecutionProps) {
  const [, setLocation] = useLocation();
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showFixedDialog, setShowFixedDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [fixNotes, setFixNotes] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start execution session
  const startMutation = trpc.preventive.startExecution.useMutation();
  const submitItemMutation = trpc.preventive.submitItemResult.useMutation();
  const completeMutation = trpc.preventive.completeExecution.useMutation();
  const createTicketMutation = trpc.preventive.createIssueTicket.useMutation();

  const { data: progressData, refetch: refetchProgress, isLoading } =
    trpc.preventive.getExecutionProgress.useQuery({ workOrderId }, { enabled: false });

  const utils = trpc.useUtils();

  // Start session on mount
  useEffect(() => {
    startMutation.mutate({ workOrderId }, {
      onSuccess: () => {
        refetchProgress();
        // Start timer
        timerRef.current = setInterval(() => {
          setElapsedSeconds(s => s + 1);
        }, 1000);
      },
      onError: (err) => {
        toast.error("فشل في بدء جلسة الفحص: " + err.message);
      }
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [workOrderId]);

  // Sync current item index with completed items
  useEffect(() => {
    if (progressData) {
      const completedIds = new Set(progressData.results.map((r: any) => r.checklistItemId));
      const firstIncomplete = progressData.items.findIndex((item: any) => !completedIds.has(item.id));
      if (firstIncomplete !== -1) {
        setCurrentItemIndex(firstIncomplete);
      } else if (progressData.items.length > 0) {
        setCurrentItemIndex(progressData.items.length); // all done
      }
    }
  }, [progressData]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const items = progressData?.items ?? [];
  const results = progressData?.results ?? [];
  const workOrder = progressData?.workOrder as any;
  const totalItems = items.length;
  const completedItems = results.length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const currentItem = items[currentItemIndex];
  const isAllDone = completedItems >= totalItems && totalItems > 0;

  const getItemResult = (itemId: number) =>
    results.find((r: any) => r.checklistItemId === itemId);

  const handleOk = () => {
    if (!currentItem) return;
    submitItemMutation.mutate({
      workOrderId,
      checklistItemId: currentItem.id,
      status: "ok",
    }, {
      onSuccess: () => {
        refetchProgress();
        setCurrentItemIndex(i => i + 1);
      },
      onError: (err) => toast.error("خطأ: " + err.message),
    });
  };

  const handleFixed = () => {
    setShowFixedDialog(true);
  };

  const handleFixedSubmit = () => {
    if (!currentItem) return;
    submitItemMutation.mutate({
      workOrderId,
      checklistItemId: currentItem.id,
      status: "fixed",
      fixNotes,
    }, {
      onSuccess: () => {
        setShowFixedDialog(false);
        setFixNotes("");
        refetchProgress();
        setCurrentItemIndex(i => i + 1);
      },
      onError: (err) => toast.error("خطأ: " + err.message),
    });
  };

  const handleIssue = () => {
    setShowIssueDialog(true);
  };

  const handleIssueSubmit = () => {
    if (!currentItem) return;
    // First mark as issue
    submitItemMutation.mutate({
      workOrderId,
      checklistItemId: currentItem.id,
      status: "issue",
    }, {
      onSuccess: () => {
        // Then create ticket
        createTicketMutation.mutate({
          workOrderId,
          checklistItemId: currentItem.id,
          assetId: workOrder?.assetId ?? undefined,
          siteId: workOrder?.siteId ?? undefined,
          description: issueDescription,
        }, {
          onSuccess: (data) => {
            toast.success(`تم فتح بلاغ عطل رقم ${data.ticketNumber} تلقائياً`);
            setShowIssueDialog(false);
            setIssueDescription("");
            refetchProgress();
            setCurrentItemIndex(i => i + 1);
          },
          onError: (err) => toast.error("خطأ في فتح البلاغ: " + err.message),
        });
      },
      onError: (err) => toast.error("خطأ: " + err.message),
    });
  };

  const handleComplete = () => {
    setShowCompleteDialog(true);
  };

  const handleCompleteSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    completeMutation.mutate({ workOrderId, generalNotes }, {
      onSuccess: (data) => {
        toast.success("تم إنهاء الفحص بنجاح!");
        utils.preventive.listWorkOrders.invalidate();
        setShowCompleteDialog(false);
        if (onClose) onClose();
        else setLocation("/preventive-maintenance");
      },
      onError: (err) => toast.error("خطأ: " + err.message),
    });
  };

  if (isLoading || startMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري تحميل بنود الفحص...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { if (onClose) onClose(); else setLocation("/preventive-maintenance"); }}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-mono">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Work Order Info */}
      {workOrder && (
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h2 className="font-bold text-lg">{workOrder.title}</h2>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {workOrder.assetName && (
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                {workOrder.assetName}
              </span>
            )}
            {workOrder.siteName && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {workOrder.siteName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {isAllDone ? "✅ اكتمل الفحص" : `البند ${Math.min(currentItemIndex + 1, totalItems)} من ${totalItems}`}
          </span>
          <span className="text-muted-foreground">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-3" />
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            سليم: {results.filter((r: any) => r.status === "ok").length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            تم إصلاحه: {results.filter((r: any) => r.status === "fixed").length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            خلل: {results.filter((r: any) => r.status === "issue").length}
          </span>
        </div>
      </div>

      {/* Current Item Card */}
      {!isAllDone && currentItem ? (
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>بند الفحص</span>
              {currentItem.isRequired && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">إلزامي</Badge>
              )}
            </div>
            <p className="text-xl font-semibold leading-relaxed">{currentItem.text}</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleOk}
              disabled={submitItemMutation.isPending}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <span className="text-sm font-semibold text-green-700">سليم ✓</span>
            </button>

            <button
              onClick={handleFixed}
              disabled={submitItemMutation.isPending}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 hover:border-blue-400 transition-all active:scale-95 disabled:opacity-50"
            >
              <Wrench className="w-8 h-8 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">تم إصلاحه</span>
            </button>

            <button
              onClick={handleIssue}
              disabled={submitItemMutation.isPending}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-50 hover:bg-red-100 border-2 border-red-200 hover:border-red-400 transition-all active:scale-95 disabled:opacity-50"
            >
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <span className="text-sm font-semibold text-red-700">يوجد خلل</span>
            </button>
          </div>
        </div>
      ) : isAllDone ? (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center space-y-4">
          <CheckSquare className="w-16 h-16 text-green-600 mx-auto" />
          <h3 className="text-xl font-bold text-green-800">اكتمل الفحص!</h3>
          <p className="text-green-700 text-sm">
            تم فحص جميع {totalItems} بند بنجاح
          </p>
          <Button onClick={handleComplete} className="w-full bg-green-600 hover:bg-green-700 text-white">
            <Flag className="w-4 h-4 ml-2" />
            إنهاء وإرسال التقرير
          </Button>
        </div>
      ) : null}

      {/* Completed Items List */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">البنود المنجزة</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {items.map((item: any, idx: number) => {
              const result = getItemResult(item.id);
              if (!result) return null;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-sm ${
                    result.status === "ok" ? "bg-green-50 border border-green-100" :
                    result.status === "fixed" ? "bg-blue-50 border border-blue-100" :
                    "bg-red-50 border border-red-100"
                  }`}
                >
                  {result.status === "ok" && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                  {result.status === "fixed" && <Wrench className="w-4 h-4 text-blue-600 shrink-0" />}
                  {result.status === "issue" && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                  <span className="flex-1 truncate">{item.text}</span>
                  <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fixed Dialog */}
      <Dialog open={showFixedDialog} onOpenChange={setShowFixedDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              وصف الإصلاح الفوري
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">البند: <strong>{currentItem?.text}</strong></p>
            <div>
              <Label>ماذا تم إصلاحه؟</Label>
              <Textarea
                value={fixNotes}
                onChange={e => setFixNotes(e.target.value)}
                placeholder="اكتب وصفاً مختصراً للإصلاح الذي قمت به..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowFixedDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleFixedSubmit}
              disabled={!fixNotes.trim() || submitItemMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitItemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الإصلاح"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Dialog */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              فتح بلاغ عطل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">البند: <strong>{currentItem?.text}</strong></p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              سيتم فتح بلاغ عطل تلقائياً وإرساله لمدير الصيانة
            </div>
            <div>
              <Label>وصف الخلل</Label>
              <Textarea
                value={issueDescription}
                onChange={e => setIssueDescription(e.target.value)}
                placeholder="اكتب وصفاً للخلل الذي اكتشفته..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowIssueDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleIssueSubmit}
              disabled={!issueDescription.trim() || submitItemMutation.isPending || createTicketMutation.isPending}
              variant="destructive"
            >
              {(submitItemMutation.isPending || createTicketMutation.isPending)
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : "فتح بلاغ عطل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckSquare className="w-5 h-5" />
              إنهاء الفحص الدوري
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 rounded-lg p-2">
                <div className="text-2xl font-bold text-green-700">
                  {results.filter((r: any) => r.status === "ok").length}
                </div>
                <div className="text-xs text-green-600">سليم</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="text-2xl font-bold text-blue-700">
                  {results.filter((r: any) => r.status === "fixed").length}
                </div>
                <div className="text-xs text-blue-600">تم إصلاحه</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <div className="text-2xl font-bold text-red-700">
                  {results.filter((r: any) => r.status === "issue").length}
                </div>
                <div className="text-xs text-red-600">خلل</div>
              </div>
            </div>
            <div>
              <Label>ملاحظات عامة (اختياري)</Label>
              <Textarea
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية تريد إضافتها..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleCompleteSubmit}
              disabled={completeMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {completeMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : "إنهاء وإرسال"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
