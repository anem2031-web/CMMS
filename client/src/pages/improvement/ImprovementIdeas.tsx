import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ImprovementFinancialPanel } from "@/components/improvement/ImprovementFinancialPanel";
import { getLocalizedName } from "@/hooks/useTranslatedField";
import { hasCompleteCostStudy } from "@shared/improvement-execution";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Lightbulb, Search, Plus, ChevronLeft, ChevronRight, Trash2, Folder, ArrowRight,
  CloudUpload, X, ImageIcon, ExternalLink, CheckCircle2,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback, DragEvent } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const IMPROVEMENT_FLOW_LABELS = {
  "ar": {
    "currentSituation": "الوضع الحالي والمشكلة",
    "targetOutcome": "الهدف من التطوير",
    "successMetric": "مؤشر قياس النجاح",
    "baselineValue": "القيمة قبل التحسين (اختياري)",
    "targetValue": "القيمة المستهدفة (اختياري)",
    "study": "دراسة التكلفة التقديرية",
    "saveStudy": "حفظ دراسة التكلفة",
    "materialsCost": "تكلفة المواد",
    "laborCost": "تكلفة العمالة",
    "servicesCost": "تكلفة الخدمات",
    "totalCost": "إجمالي التكلفة التقديرية",
    "costStudyNotes": "مبررات التكلفة والجدوى",
    "studyRequired": "تجب دراسة التكلفة قبل الموافقة",
    "studyReady": "دراسة التكلفة مكتملة",
    "legacy": "فكرة سابقة (إجراءاتها القديمة متاحة)",
    "studyMissing": "لم تسجل دراسة تكلفة بعد",
    "approvalBlocked": "لا يمكن الموافقة قبل دراسة التكلفة",
    "plan": "خطة تنفيذ التحسين",
    "savePlan": "حفظ خطة التنفيذ",
    "planOwner": "المسؤول عن التنفيذ",
    "startDate": "تاريخ بداية التنفيذ",
    "dueDate": "الموعد المستهدف",
    "progress": "نسبة الإنجاز %",
    "planNotes": "ملاحظات التنفيذ",
    "planRequired": "حدد المسؤول والموعد المستهدف قبل التحويل",
    "evaluation": "تقييم نتائج التطوير",
    "actualCost": "التكلفة الفعلية",
    "achievedValue": "القيمة الفعلية للمؤشر",
    "resultRating": "تقييم النتيجة",
    "resultNotes": "النتائج المحققة وملاحظات التقييم",
    "achieved": "تحقق الهدف",
    "partial": "تحقق جزئيًا",
    "not_achieved": "لم يتحقق الهدف",
    "achievementRate": "نسبة تحقيق المستهدف",
    "details": "تفاصيل التحسين",
    "resultPending": "لم يُقيّم الأثر بعد",
    "invalidValues": "أدخل القيم المطلوبة بشكل صحيح",
    "requireResults": "يجب تسجيل التكلفة الفعلية والتقييم والنتيجة قبل الإغلاق",
    "submit": "حفظ",
    "required": "حقل مطلوب",
    "noStudy": "لا توجد دراسة تكلفة محفوظة",
    "costDifference": "فرق التكلفة (فعلي − تقديري)",
    "noMetric": "لم تُحدد قيم رقمية لحساب نسبة الإنجاز",
    "planSaveSuccess": "تم حفظ خطة التنفيذ",
    "studySaveSuccess": "تم حفظ دراسة التكلفة",
    "targetRequired": "القيمة الفعلية للمؤشر مطلوبة عند تحديد قيمة مستهدفة",
    "review": "تسجيل نتائج التطوير"
  },
  "en": {
    "currentSituation": "Current situation / problem",
    "targetOutcome": "Target outcome",
    "successMetric": "Success measure",
    "baselineValue": "Baseline (optional)",
    "targetValue": "Target value (optional)",
    "study": "Estimated cost study",
    "saveStudy": "Save cost study",
    "materialsCost": "Materials cost",
    "laborCost": "Labor cost",
    "servicesCost": "Services cost",
    "totalCost": "Total estimated cost",
    "costStudyNotes": "Feasibility and cost justification",
    "studyRequired": "Cost study required before approval",
    "studyReady": "Cost study completed",
    "legacy": "Existing idea (legacy workflow)",
    "studyMissing": "No cost study recorded",
    "approvalBlocked": "Cost study required for approval",
    "plan": "Improvement execution plan",
    "savePlan": "Save execution plan",
    "planOwner": "Execution owner",
    "startDate": "Start date",
    "dueDate": "Target due date",
    "progress": "Progress %",
    "planNotes": "Execution notes",
    "planRequired": "Add execution owner and due date before conversion",
    "evaluation": "Development outcome evaluation",
    "actualCost": "Actual cost",
    "achievedValue": "Actual metric value",
    "resultRating": "Outcome rating",
    "resultNotes": "Achieved results / evaluation notes",
    "achieved": "Achieved",
    "partial": "Partially achieved",
    "not_achieved": "Not achieved",
    "achievementRate": "Target attainment",
    "details": "Improvement details",
    "resultPending": "Outcome not evaluated yet",
    "invalidValues": "Enter valid required values",
    "requireResults": "Complete actual cost, outcome and notes before closing",
    "submit": "Save",
    "required": "Required",
    "noStudy": "No saved cost study",
    "costDifference": "Cost variance (actual − estimate)",
    "noMetric": "No numeric values to calculate attainment",
    "planSaveSuccess": "Execution plan saved",
    "studySaveSuccess": "Cost study saved",
    "targetRequired": "Actual metric value is required when a target value exists",
    "review": "Record development outcome"
  },
  "ur": {
    "currentSituation": "موجودہ صورتِ حال / مسئلہ",
    "targetOutcome": "مطلوبہ نتیجہ",
    "successMetric": "کامیابی کا پیمانہ",
    "baselineValue": "ابتدائی قدر (اختیاری)",
    "targetValue": "ہدف کی قدر (اختیاری)",
    "study": "تخمینی لاگت کا مطالعہ",
    "saveStudy": "لاگت کا مطالعہ محفوظ کریں",
    "materialsCost": "مواد کی لاگت",
    "laborCost": "محنت کی لاگت",
    "servicesCost": "خدمات کی لاگت",
    "totalCost": "کل تخمینی لاگت",
    "costStudyNotes": "لاگت اور فائدے کا جواز",
    "studyRequired": "منظوری سے پہلے لاگت کا مطالعہ ضروری ہے",
    "studyReady": "لاگت کا مطالعہ مکمل",
    "legacy": "پرانا خیال (سابقہ طریقہ جاری)",
    "studyMissing": "لاگت کا مطالعہ موجود نہیں",
    "approvalBlocked": "منظوری کے لیے لاگت کا مطالعہ ضروری ہے",
    "plan": "عملدرآمد کا منصوبہ",
    "savePlan": "منصوبہ محفوظ کریں",
    "planOwner": "ذمہ دار فرد",
    "startDate": "آغاز کی تاریخ",
    "dueDate": "مطلوبہ تکمیل تاریخ",
    "progress": "پیش رفت %",
    "planNotes": "عملدرآمد کے نوٹس",
    "planRequired": "تبدیلی سے پہلے ذمہ دار اور تاریخ لکھیں",
    "evaluation": "نتائج کا جائزہ",
    "actualCost": "حقیقی لاگت",
    "achievedValue": "حاصل شدہ قدر",
    "resultRating": "نتیجہ",
    "resultNotes": "حاصل شدہ نتائج اور تبصرے",
    "achieved": "ہدف پورا ہوا",
    "partial": "جزوی کامیابی",
    "not_achieved": "ہدف پورا نہیں ہوا",
    "achievementRate": "ہدف کی تکمیل",
    "details": "بہتری کی تفصیل",
    "resultPending": "ابھی نتائج کا جائزہ نہیں ہوا",
    "invalidValues": "درست اور لازمی قدریں درج کریں",
    "requireResults": "بند کرنے سے پہلے حقیقی لاگت، نتیجہ اور نوٹس درج کریں",
    "submit": "محفوظ کریں",
    "required": "لازمی",
    "noStudy": "لاگت کا مطالعہ نہیں",
    "costDifference": "لاگت کا فرق (حقیقی − تخمینہ)",
    "noMetric": "تکمیل کا تناسب نکالنے کے لیے عددی معلومات نہیں",
    "planSaveSuccess": "عملدرآمد کا منصوبہ محفوظ ہوا",
    "studySaveSuccess": "لاگت کا مطالعہ محفوظ ہوا",
    "targetRequired": "ہدف مقرر ہونے پر اصل قدر درج کریں",
    "review": "ترقی کے نتائج درج کریں"
  }
} as const;

function useFlowLabels() {
  const { language } = useTranslation();
  return IMPROVEMENT_FLOW_LABELS[language];
}

function moneyValue(value: unknown): number | null {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 999999999999.99 ? n : null;
}

function estimatedTotal(idea: any) {
  return Number(idea.estimatedMaterialsCost ?? 0) + Number(idea.estimatedLaborCost ?? 0) + Number(idea.estimatedServicesCost ?? 0);
}

function achievementPercent(idea: any): number | null {
  const b = idea.baselineValue, t = idea.targetValue, a = idea.achievedValue;
  if (b == null || t == null || a == null) return null;
  const span = Number(t) - Number(b);
  if (!Number.isFinite(span) || span === 0) return null;
  const pct = ((Number(a) - Number(b)) / span) * 100;
  return Number.isFinite(pct) ? Math.round(pct * 10) / 10 : null;
}

function currencyNumber(n: number) { return n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }); }

const PAGE_SIZE = 10;
const MAX_IMAGES = 5;
// تحكم مؤقت: إخفاء حقلي الموقع والقسم بنافذة تقديم الفكرة (بدون حذف المنطق) — لإعادتها لاحقاً غيّر القيمة إلى true
const SHOW_SITE_SECTION_FIELDS = true;

const IDEA_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  classified: "bg-amber-100 text-amber-700",
  approved: "bg-teal-100 text-teal-700",
  in_progress: "bg-violet-100 text-violet-700",
  completed: "bg-emerald-100 text-emerald-700",
  postponed: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

function getPageNumbers(current: number, total: number): (number | "dots")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const range: (number | "dots")[] = [1];
  if (left > 2) range.push("dots");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("dots");
  range.push(total);
  return range;
}

type FileEntry = { id: string; file: File; status: "pending" | "uploading" | "done" | "error"; progress: number; url?: string; fileKey?: string };

// ── مكوّن رفع الصور (حتى 5 صور) — يُستخدم بنافذة تقديم فكرة جديدة ──────────
function IdeaImageUploader({ fileEntries, setFileEntries }: { fileEntries: FileEntry[]; setFileEntries: React.Dispatch<React.SetStateAction<FileEntry[]>> }) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (entry: FileEntry) => {
    setFileEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: "uploading", progress: 0 } : e));
    try {
      const formData = new FormData();
      formData.append("file", entry.file);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 90);
            setFileEntries(prev => prev.map(e => e.id === entry.id ? { ...e, progress: pct } : e));
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.url) {
                setFileEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: "done", progress: 100, url: data.url, fileKey: data.fileKey } : e));
                resolve();
              } else reject(new Error("no url"));
            } catch { reject(new Error("invalid response")); }
          } else reject(new Error(`upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("network error"));
        xhr.send(formData);
      });
    } catch (err: any) {
      setFileEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: "error", progress: 0 } : e));
    }
  }, [setFileEntries]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    const room = MAX_IMAGES - fileEntries.length;
    if (room <= 0) { toast.error(`${t.improvementIdeas.attachImages} (${MAX_IMAGES})`); return; }
    const valid = arr.slice(0, room);
    const entries: FileEntry[] = valid.map(file => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, status: "pending", progress: 0 }));
    setFileEntries(prev => [...prev, ...entries]);
    entries.forEach(e => uploadFile(e));
  }, [fileEntries.length, setFileEntries, uploadFile, t]);

  const removeEntry = (id: string) => setFileEntries(prev => prev.filter(e => e.id !== id));

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        onClick={() => fileEntries.length < MAX_IMAGES && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"} ${fileEntries.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""}`}
      >
        <CloudUpload className="w-6 h-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center">{t.improvementIdeas.attachImages} ({fileEntries.length}/{MAX_IMAGES})</p>
      </div>
      {fileEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileEntries.map(entry => (
            <div key={entry.id} className="relative w-16 h-16 rounded-md overflow-hidden border bg-muted shrink-0">
              {entry.url ? <img src={entry.url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>}
              {entry.status === "uploading" && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px]">{entry.progress}%</div>}
              <button onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── شارة صور المرفقات لعرض مصغّر داخل أي بطاقة/نافذة فكرة ──────────────────
function IdeaImagesPreview({ ideaId }: { ideaId: number }) {
  const { data: files = [] } = trpc.attachments.list.useQuery({ entityType: "improvement_idea", entityId: ideaId });
  if (!files.length) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {files.map((f: any) => (
        <a key={f.id} href={f.fileUrl} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-md overflow-hidden border shrink-0">
          <img src={f.fileUrl} className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// نافذة تقديم فكرة جديدة (تتاح للجميع)
// ════════════════════════════════════════════════════════════════════════
function CreateIdeaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, language } = useTranslation();
  const w = useFlowLabels();
  const { getPriorityLabel } = useStaticLabels();
  const utils = trpc.useUtils();
  const { data: sites = [] } = trpc.sites.list.useQuery();
  const { data: allSections } = trpc.sections.list.useQuery(undefined);

  const [form, setForm] = useState({ title: "", description: "", category: "operational", priority: "medium", expectedBenefit: "", currentSituation: "", targetOutcome: "", successMetric: "", baselineValue: "", targetValue: "", siteId: "", sectionId: "", assetId: "" });
  const { data: assets = [] } = trpc.assets.list.useQuery({ sectionId: Number(form.sectionId) }, { enabled: !!form.sectionId });
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const addAttachmentMut = trpc.attachments.add.useMutation();

  const resetForm = () => { setForm({ title: "", description: "", category: "operational", priority: "medium", expectedBenefit: "", currentSituation: "", targetOutcome: "", successMetric: "", baselineValue: "", targetValue: "", siteId: "", sectionId: "", assetId: "" }); setFileEntries([]); };

  const createMutation = trpc.improvementIdeas.create.useMutation({
    onSuccess: async (res) => {
      const doneEntries = fileEntries.filter(e => e.status === "done" && e.url);
      for (const entry of doneEntries) {
        try {
          await addAttachmentMut.mutateAsync({
            entityType: "improvement_idea", entityId: res.id!, fileName: entry.file.name,
            fileUrl: entry.url!, fileKey: entry.fileKey || entry.file.name,
            mimeType: entry.file.type, fileSize: entry.file.size,
          });
        } catch { /* تجاهل فشل مرفق منفرد */ }
      }
      toast.success(`${t.improvementIdeas.createNew} ${res.requestNumber}`);
      utils.improvementIdeas.listPaginated.invalidate();
      onOpenChange(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!form.title.trim()) { toast.error(t.improvementIdeas.title); return; }
    if (!form.description.trim() || !form.expectedBenefit.trim() || !form.siteId || !form.sectionId || !form.currentSituation.trim() || !form.targetOutcome.trim() || !form.successMetric.trim()) { toast.error(w.required); return; }
    const baseline = form.baselineValue.trim() ? Number(form.baselineValue) : undefined;
    const target = form.targetValue.trim() ? Number(form.targetValue) : undefined;
    if ((baseline !== undefined && !Number.isFinite(baseline)) || (target !== undefined && !Number.isFinite(target)) || ((baseline === undefined) !== (target === undefined))) { toast.error(w.invalidValues); return; }
    const uploading = fileEntries.some(e => e.status === "uploading" || e.status === "pending");
    if (uploading) { toast.error(t.attachments?.uploading || "الرجاء انتظار اكتمال رفع الصور"); return; }
    createMutation.mutate({
      title: form.title,
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      expectedBenefit: form.expectedBenefit.trim(),
      currentSituation: form.currentSituation.trim(),
      targetOutcome: form.targetOutcome.trim(),
      successMetric: form.successMetric.trim(),
      baselineValue: baseline,
      targetValue: target,
      siteId: Number(form.siteId),
      sectionId: Number(form.sectionId),
      assetId: form.assetId ? Number(form.assetId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t.improvementIdeas.createNew}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t.improvementIdeas.title} *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>{t.improvementIdeas.description} *</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1"><Label>{w.currentSituation} *</Label><Textarea value={form.currentSituation} onChange={e => setForm(f => ({ ...f, currentSituation: e.target.value }))} /></div>
          <div className="space-y-1"><Label>{w.targetOutcome} *</Label><Textarea value={form.targetOutcome} onChange={e => setForm(f => ({ ...f, targetOutcome: e.target.value }))} /></div>
          <div className="space-y-1"><Label>{w.successMetric} *</Label><Input value={form.successMetric} onChange={e => setForm(f => ({ ...f, successMetric: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>{w.baselineValue}</Label><Input type="number" step="any" value={form.baselineValue} onChange={e => setForm(f => ({ ...f, baselineValue: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{w.targetValue}</Label><Input type="number" step="any" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t.improvementIdeas.category}</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(t.improvementIdeas.categories).map(k => <SelectItem key={k} value={k}>{(t.improvementIdeas.categories as any)[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t.improvementIdeas.priority}</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(t.priority).map(k => <SelectItem key={k} value={k}>{getPriorityLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t.improvementIdeas.expectedBenefit} *</Label>
            <Textarea value={form.expectedBenefit} onChange={e => setForm(f => ({ ...f, expectedBenefit: e.target.value }))} />
          </div>
          {SHOW_SITE_SECTION_FIELDS && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t.improvementIdeas.site} *</Label>
                <Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v, sectionId: "", assetId: "" }))}>
                  <SelectTrigger><SelectValue placeholder={t.improvementIdeas.site} /></SelectTrigger>
                  <SelectContent>{sites.filter((s: any) => s.isActive).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{getLocalizedName(s, language)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t.improvementIdeas.section} *</Label>
                <Select value={form.sectionId} onValueChange={v => setForm(f => ({ ...f, sectionId: v, assetId: "" }))} disabled={!form.siteId}>
                  <SelectTrigger><SelectValue placeholder={t.improvementIdeas.section} /></SelectTrigger>
                  <SelectContent>
                    {allSections?.filter((s: any) => s.isActive && s.siteId === Number(form.siteId)).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{getLocalizedName(s, language)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1"><Label>{t.assets.title}</Label>
            <Select value={form.assetId || "none"} disabled={!form.sectionId} onValueChange={v => setForm(f => ({ ...f, assetId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{assets.filter((a: any) => a.sectionId === Number(form.sectionId)).map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{getLocalizedName(a, language)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t.improvementIdeas.attachImages}</Label>
            <IdeaImageUploader fileEntries={fileEntries} setFileEntries={setFileEntries} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>{t.common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════
// نافذة الفرز والتصنيف (مدير الصيانة / مدير النظام / مالك النظام فقط)
// ════════════════════════════════════════════════════════════════════════
function ClassifyDialog({ idea, onClose }: { idea: any; onClose: () => void }) {
  const { t } = useTranslation();
  const w = useFlowLabels();
  const { getPriorityLabel } = useStaticLabels();
  const utils = trpc.useUtils();
  const [category, setCategory] = useState(idea.category);
  const [groupCategory, setGroupCategory] = useState("");
  const [priority, setPriority] = useState(idea.priority);

  const classifyMut = trpc.improvementIdeas.classify.useMutation({
    onSuccess: () => {
      toast.success(t.improvementIdeas.classify);
      utils.improvementIdeas.listPaginated.invalidate();
      utils.improvementIdeas.getGroupedClassifiedCounts.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{idea.requestNumber}</span>{idea.title}
          </DialogTitle>
          <DialogDescription>{t.improvementIdeas.classifyHint}</DialogDescription>
        </DialogHeader>
        {idea.description && <p className="text-sm text-muted-foreground">{idea.description}</p>}
        {idea.currentSituation && <p className="text-sm"><b>{w.currentSituation}: </b>{idea.currentSituation}</p>}
        {idea.targetOutcome && <p className="text-sm"><b>{w.targetOutcome}: </b>{idea.targetOutcome}</p>}
        <IdeaImagesPreview ideaId={idea.id} />
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label>{t.improvementIdeas.category}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(t.improvementIdeas.categories).map(k => <SelectItem key={k} value={k}>{(t.improvementIdeas.categories as any)[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t.improvementIdeas.groupCategory}</Label>
            <Select value={groupCategory} onValueChange={setGroupCategory}>
              <SelectTrigger><SelectValue placeholder={t.improvementIdeas.groupCategory} /></SelectTrigger>
              <SelectContent>{Object.keys(t.improvementIdeas.groups).map(k => <SelectItem key={k} value={k}>{(t.improvementIdeas.groups as any)[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t.improvementIdeas.priority}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(t.priority).map(k => <SelectItem key={k} value={k}>{getPriorityLabel(k)}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground pt-1">{t.improvementIdeas.classificationCriteriaHint}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            disabled={!groupCategory || classifyMut.isPending}
            onClick={() => classifyMut.mutate({ id: idea.id, category, groupCategory, priority })}
          >
            {t.improvementIdeas.classify}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════
// نافذة قرار الإدارة العليا
// ════════════════════════════════════════════════════════════════════════
function DecideDialog({ idea, onClose }: { idea: any; onClose: () => void }) {
  const { t } = useTranslation();
  const w = useFlowLabels();
  const utils = trpc.useUtils();
  const [decision, setDecision] = useState<"approved" | "postponed" | "cancelled" | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [postponedUntil, setPostponedUntil] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const decideMut = trpc.improvementIdeas.decide.useMutation({
    onSuccess: () => {
      toast.success(t.common.savedSuccessfully);
      utils.improvementIdeas.getClassifiedByGroup.invalidate();
      utils.improvementIdeas.getGroupedClassifiedCounts.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!decision) return;
    if (decision === "approved" && idea.costStudyRequired && !(idea.executionTrackingVersion === 1 ? hasCompleteCostStudy(idea) : idea.costStudiedAt)) { toast.error(w.approvalBlocked); return; }
    if (decision === "postponed" && !postponedUntil) { toast.error(t.improvementIdeas.postponedUntil); return; }
    decideMut.mutate({
      id: idea.id, decision,
      decisionNotes: decisionNotes || undefined,
      postponedUntil: decision === "postponed" ? postponedUntil : undefined,
      cancelReason: decision === "cancelled" ? (cancelReason || undefined) : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{idea.requestNumber}</span>{idea.title}
          </DialogTitle>
        </DialogHeader>
        {idea.description && <p className="text-sm text-muted-foreground">{idea.description}</p>}
        <IdeaImagesPreview ideaId={idea.id} />
        {idea.expectedBenefit && <p className="text-sm"><span className="font-medium">{t.improvementIdeas.expectedBenefit}: </span>{idea.expectedBenefit}</p>}
        {idea.currentSituation && <p className="text-sm"><b>{w.currentSituation}:</b> {idea.currentSituation}</p>}
        {idea.targetOutcome && <p className="text-sm"><b>{w.targetOutcome}:</b> {idea.targetOutcome}</p>}
        {idea.successMetric && <p className="text-sm"><b>{w.successMetric}:</b> {idea.successMetric}</p>}
        <div className="border rounded-md p-3 space-y-1 text-sm bg-muted/30">
          <p className="font-medium">{w.study}</p>
          {idea.costStudiedAt ? <>
            <p>{w.materialsCost}: {currencyNumber(Number(idea.estimatedMaterialsCost ?? 0))}</p>
            <p>{w.laborCost}: {currencyNumber(Number(idea.estimatedLaborCost ?? 0))}</p>
            <p>{w.servicesCost}: {currencyNumber(Number(idea.estimatedServicesCost ?? 0))}</p>
            <p className="font-semibold">{w.totalCost}: {currencyNumber(estimatedTotal(idea))}</p>
            {idea.costStudiedAt && <p>{idea.costStudyAuthorName || "—"} — {new Date(idea.costStudiedAt).toLocaleDateString()}</p>}
      {idea.costStudyNotes && <p>{w.costStudyNotes}: {idea.costStudyNotes}</p>}
          </> : <p className="text-amber-700">{idea.costStudyRequired ? w.studyRequired : w.legacy}</p>}
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1" variant={decision === "approved" ? "default" : "outline"} disabled={!!idea.costStudyRequired && !(idea.executionTrackingVersion === 1 ? hasCompleteCostStudy(idea) : idea.costStudiedAt)} onClick={() => setDecision("approved")}>{t.improvementIdeas.approve}</Button>
          <Button size="sm" className="flex-1" variant={decision === "postponed" ? "default" : "outline"} onClick={() => setDecision("postponed")}>{t.improvementIdeas.postpone}</Button>
          <Button size="sm" className="flex-1" variant={decision === "cancelled" ? "destructive" : "outline"} onClick={() => setDecision("cancelled")}>{t.improvementIdeas.cancel}</Button>
        </div>
        {decision === "postponed" && (
          <div className="space-y-1"><Label className="text-xs">{t.improvementIdeas.postponedUntil}</Label><Input type="date" value={postponedUntil} onChange={e => setPostponedUntil(e.target.value)} /></div>
        )}
        {decision === "cancelled" && (
          <div className="space-y-1"><Label className="text-xs">{t.improvementIdeas.cancelReason}</Label><Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} /></div>
        )}
        {decision && (
          <div className="space-y-1"><Label className="text-xs">{t.improvementIdeas.decisionNotes}</Label><Textarea value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} /></div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          <Button disabled={!decision || decideMut.isPending} onClick={handleSubmit}>{t.common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════
// تبويب: الأفكار الجديدة
// ════════════════════════════════════════════════════════════════════════
function NewIdeasTab({ canClassify }: { canClassify: boolean }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [classifyTarget, setClassifyTarget] = useState<any>(null);
  const { data, isLoading } = trpc.improvementIdeas.listPaginated.useQuery({ status: "new", page, pageSize: PAGE_SIZE }, { placeholderData: keepPreviousData });
  const ideas = data?.ideas ?? [];

  if (isLoading) return <div className="space-y-2 pt-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (!ideas.length) return <p className="text-center text-muted-foreground py-12">{t.improvementIdeas.noIdeas}</p>;

  return (
    <div className="space-y-2 pt-3">
      {ideas.map((idea: any) => (
        <Card key={idea.id} className={canClassify ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={() => canClassify && setClassifyTarget(idea)}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{idea.requestNumber}</span>
                <Badge variant="outline" className="text-xs">{(t.improvementIdeas.categories as any)[idea.category] || idea.category}</Badge>
              </div>
              <p className="font-medium truncate">{idea.title}</p>
              <p className="text-xs text-muted-foreground">{idea.submitterName || "—"}</p>
            </div>
            {canClassify && <Button size="sm" variant="outline">{t.improvementIdeas.classify}</Button>}
          </CardContent>
        </Card>
      ))}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem><PaginationLink href="#" onClick={e => { e.preventDefault(); if (page > 1) setPage(page - 1); }} className={page <= 1 ? "pointer-events-none opacity-50" : ""}><ChevronLeft className="w-4 h-4" /></PaginationLink></PaginationItem>
              {getPageNumbers(page, data.totalPages).map((p, i) => p === "dots" ? <PaginationItem key={i}><PaginationEllipsis /></PaginationItem> : <PaginationItem key={p}><PaginationLink href="#" isActive={p === page} onClick={e => { e.preventDefault(); setPage(p as number); }}>{p}</PaginationLink></PaginationItem>)}
              <PaginationItem><PaginationLink href="#" onClick={e => { e.preventDefault(); if (page < data.totalPages) setPage(page + 1); }} className={page >= data.totalPages ? "pointer-events-none opacity-50" : ""}><ChevronRight className="w-4 h-4" /></PaginationLink></PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      {classifyTarget && <ClassifyDialog idea={classifyTarget} onClose={() => setClassifyTarget(null)} />}
    </div>
  );
}

// ── مرحلة دراسة التكلفة ───────────────────────────────────────────────
function CostStudyDialog({ idea, onClose }: { idea: any; onClose: () => void }) {
  const w = useFlowLabels();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [materials, setMaterials] = useState(String(idea.estimatedMaterialsCost ?? "0"));
  const [labor, setLabor] = useState(String(idea.estimatedLaborCost ?? "0"));
  const [services, setServices] = useState(String(idea.estimatedServicesCost ?? "0"));
  const [notes, setNotes] = useState(idea.costStudyNotes ?? "");
  const save = trpc.improvementIdeas.saveCostStudy.useMutation({
    onSuccess: () => { toast.success(w.studySaveSuccess); utils.improvementIdeas.getClassifiedByGroup.invalidate(); onClose(); },
    onError: e => toast.error(e.message),
  });
  const costs = [materials, labor, services].map(moneyValue);
  const canSave = costs.every(n => n !== null) && notes.trim().length > 0;
  return <Dialog open onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{w.study} — {idea.requestNumber}</DialogTitle></DialogHeader>
      <p className="text-sm">{idea.title}</p>
      {idea.expectedBenefit && <p className="text-xs text-muted-foreground">{idea.expectedBenefit}</p>}
      {idea.targetOutcome && <p className="text-xs"><b>{w.targetOutcome}:</b> {idea.targetOutcome}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {([ [w.materialsCost, materials, setMaterials], [w.laborCost, labor, setLabor], [w.servicesCost, services, setServices] ] as const).map(([label, value, setter]) => (
          <div className="space-y-1" key={label}><Label>{label}</Label><Input type="number" step="0.01" min="0" value={value} onChange={e => setter(e.target.value)} /></div>
        ))}
      </div>
      <p className="text-sm font-semibold">{w.totalCost}: {costs.every(n => n !== null) ? currencyNumber(costs.reduce<number>((total, n) => total + (n ?? 0), 0)) : "—"}</p>
      <div className="space-y-1"><Label>{w.costStudyNotes} *</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
        <Button disabled={!canSave || save.isPending} onClick={() => save.mutate({ id: idea.id, estimatedMaterialsCost: costs[0]!, estimatedLaborCost: costs[1]!, estimatedServicesCost: costs[2]!, costStudyNotes: notes.trim() })}>{w.saveStudy}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

// ── خطة التنفيذ للمقترحات المعتمدة أو الجارية ─────────────────────────
function ExecutionPlanDialog({ idea, onClose }: { idea: any; onClose: () => void }) {
  const w = useFlowLabels();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [owner, setOwner] = useState(idea.implementationOwner || "");
  const [startDate, setStartDate] = useState(idea.implementationStartDate || "");
  const [dueDate, setDueDate] = useState(idea.implementationDueDate || "");
  const [progress, setProgress] = useState(String(idea.implementationProgress ?? 0));
  const [notes, setNotes] = useState(idea.implementationNotes || "");
  const save = trpc.improvementIdeas.savePlan.useMutation({
    onSuccess: () => { toast.success(w.planSaveSuccess); utils.improvementIdeas.getApproved.invalidate(); onClose(); },
    onError: e => toast.error(e.message),
  });
  const progressNumber = Number(progress);
  const valid = owner.trim() && dueDate && (!startDate || startDate <= dueDate) && Number.isInteger(progressNumber) && progressNumber >= 0 && progressNumber <= 100;
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{w.plan} — {idea.requestNumber}</DialogTitle></DialogHeader>
    <div className="space-y-2"><Label>{w.planOwner} *</Label><Input value={owner} maxLength={200} onChange={e => setOwner(e.target.value)} /></div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1"><Label>{w.startDate}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
      <div className="space-y-1"><Label>{w.dueDate} *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
    </div>
    <div className="space-y-1"><Label>{w.progress}</Label><Input type="number" step="1" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} /></div>
    <div className="space-y-1"><Label>{w.planNotes}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <DialogFooter><Button variant="outline" onClick={onClose}>{t.common.cancel}</Button><Button disabled={!valid || save.isPending} onClick={() => save.mutate({ id: idea.id, implementationOwner: owner.trim(), implementationStartDate: startDate || undefined, implementationDueDate: dueDate, implementationProgress: progressNumber, implementationNotes: notes })}>{w.savePlan}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

// ── تفاصيل نتائج الأفكار المنفذة / التقييم المالي ────────────────────
function IdeaOutcomeDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const w = useFlowLabels();
  const { user } = useAuth();
  const canSeeFinancials = !!user && ["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "senior_management", "executive_director", "owner", "admin"].includes(user.role);
  const { data: idea, isLoading } = trpc.improvementIdeas.getById.useQuery({ id });
  const percent = idea ? achievementPercent(idea) : null;
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{w.details}</DialogTitle></DialogHeader>
    {isLoading ? <Skeleton className="h-32" /> : idea ? <div className="space-y-2 text-sm">
      <p className="font-semibold">{idea.requestNumber} — {idea.title}</p>
      {canSeeFinancials && idea.executionTrackingVersion === 1 && <ImprovementFinancialPanel ideaId={id} />}
      <p>{idea.siteName} — {idea.sectionName}{idea.assetName ? ` — ${idea.assetName}` : ""}</p>
      {idea.currentSituation && <p><b>{w.currentSituation}: </b>{idea.currentSituation}</p>}
      {idea.targetOutcome && <p><b>{w.targetOutcome}: </b>{idea.targetOutcome}</p>}
      {idea.successMetric && <p><b>{w.successMetric}: </b>{idea.successMetric}</p>}
      <p><b>{w.study}: </b>{idea.costStudiedAt ? currencyNumber(estimatedTotal(idea)) : w.noStudy}</p>
      {idea.costStudiedAt && <p>{idea.costStudyAuthorName || "—"} — {new Date(idea.costStudiedAt).toLocaleDateString()}</p>}
      {idea.costStudyNotes && <p><b>{w.costStudyNotes}: </b>{idea.costStudyNotes}</p>}
      {idea.implementationOwner && <p><b>{w.planOwner}: </b>{idea.implementationOwner}</p>}
      {idea.implementationDueDate && <p><b>{w.dueDate}: </b>{idea.implementationDueDate}</p>}
      {idea.status === 'completed' ? <>
        {idea.evaluatedAt ? <>
          <p><b>{w.actualCost}: </b>{idea.actualCost != null ? currencyNumber(Number(idea.actualCost)) : '—'}</p>
          {idea.costStudiedAt && idea.actualCost != null && <p><b>{w.costDifference}: </b>{currencyNumber(Number(idea.actualCost) - estimatedTotal(idea))}</p>}
          <p><b>{w.resultRating}: </b>{idea.resultRating ? w[idea.resultRating as 'achieved' | 'partial' | 'not_achieved'] : '—'}</p>
          {idea.achievedValue != null && <p><b>{w.achievedValue}: </b>{idea.achievedValue}</p>}
          {percent !== null && <p><b>{w.achievementRate}: </b>{percent}%</p>}
          {idea.resultNotes && <p><b>{w.resultNotes}: </b>{idea.resultNotes}</p>}
        </> : <p>{w.resultPending}</p>}
      </> : <p>{w.resultPending}</p>}
    </div> : <p>—</p>}
  </DialogContent></Dialog>;
}

// ════════════════════════════════════════════════════════════════════════
// تبويب: الأفكار المصنّفة (مجلدات)
// ════════════════════════════════════════════════════════════════════════
function ClassifiedTab({ canDecide, canStudy }: { canDecide: boolean; canStudy: boolean }) {
  const { t } = useTranslation();
  const w = useFlowLabels();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [decideTarget, setDecideTarget] = useState<any>(null);
  const [studyTarget, setStudyTarget] = useState<any>(null);
  const { data: counts = [], isLoading } = trpc.improvementIdeas.getGroupedClassifiedCounts.useQuery();
  const { data: groupIdeas = [], isLoading: loadingGroup } = trpc.improvementIdeas.getClassifiedByGroup.useQuery({ groupCategory: openGroup! }, { enabled: !!openGroup });

  if (openGroup) {
    return (
      <div className="space-y-2 pt-3">
        <Button variant="ghost" size="sm" onClick={() => setOpenGroup(null)}><ArrowRight className="w-4 h-4 ml-1" />{t.improvementIdeas.folders}</Button>
        <p className="font-medium flex items-center gap-2"><Folder className="w-4 h-4" />{(t.improvementIdeas.groups as any)[openGroup]}</p>
        {loadingGroup ? <Skeleton className="h-20 w-full" /> : !groupIdeas.length ? <p className="text-center text-muted-foreground py-8">{t.improvementIdeas.noIdeas}</p> : (
          groupIdeas.map((idea: any) => (
            <Card key={idea.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <span className="text-xs text-muted-foreground font-mono">{idea.requestNumber}</span>
                  <p className="font-medium truncate">{idea.title}</p>
                  <p className="text-xs text-muted-foreground">{idea.submitterName || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge className={`border ${PRIORITY_COLORS[idea.priority] || ""}`}>{idea.priority}</Badge>
                  {idea.costStudiedAt ? <Badge variant="secondary">{w.studyReady}</Badge> : !!idea.costStudyRequired && <Badge variant="outline">{w.studyRequired}</Badge>}
                  {canStudy && <Button size="sm" variant="outline" onClick={() => setStudyTarget(idea)}>{w.study}</Button>}
                  {canDecide && <Button size="sm" disabled={!!idea.costStudyRequired && !(idea.executionTrackingVersion === 1 ? hasCompleteCostStudy(idea) : idea.costStudiedAt)} onClick={() => setDecideTarget(idea)}>{t.improvementIdeas.decidedBy}</Button>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {decideTarget && <DecideDialog idea={decideTarget} onClose={() => setDecideTarget(null)} />}
        {studyTarget && <CostStudyDialog idea={studyTarget} onClose={() => setStudyTarget(null)} />}
      </div>
    );
  }

  if (isLoading) return <div className="grid grid-cols-2 gap-3 pt-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!counts.length) return <p className="text-center text-muted-foreground py-12">{t.improvementIdeas.noIdeas}</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
      {counts.map((c: any) => (
        <Card key={c.groupCategory} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenGroup(c.groupCategory)}>
          <CardContent className="p-4 flex items-center gap-3">
            <Folder className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="font-medium">{(t.improvementIdeas.groups as any)[c.groupCategory] || c.groupCategory}</span>
            <Badge variant="outline" className="mr-auto">{c.count}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// تبويب: المقترحات المعتمدة (تحويل + تتبّع)
// ════════════════════════════════════════════════════════════════════════
function ApprovedTab() {
  const { t } = useTranslation();
  const w = useFlowLabels();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: ideas = [], isLoading } = trpc.improvementIdeas.getApproved.useQuery();
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [planTarget, setPlanTarget] = useState<any>(null);
  const [financialId, setFinancialId] = useState<number | null>(null);
  const [actualCost, setActualCost] = useState("");
  const [achievedValue, setAchievedValue] = useState("");
  const [resultRating, setResultRating] = useState<"achieved" | "partial" | "not_achieved" | "">("");
  const [resultNotes, setResultNotes] = useState("");

  const completeMut = trpc.improvementIdeas.complete.useMutation({
    onSuccess: () => { toast.success(t.improvementIdeas.complete); utils.improvementIdeas.getApproved.invalidate(); utils.improvementIdeas.listPaginated.invalidate(); setCompletingId(null); setCompletionNotes(""); setActualCost(""); setAchievedValue(""); setResultRating(""); setResultNotes(""); },
    onError: (err) => toast.error(err.message),
  });

  const convert = (idea: any, type: "ticket" | "po") => {
    const context = new URLSearchParams({ fromIdeaId: String(idea.id), ...(idea.siteId ? {siteId: String(idea.siteId)} : {}), ...(idea.sectionId ? {sectionId: String(idea.sectionId)} : {}), ...(idea.assetId ? {assetId: String(idea.assetId)} : {}) });
    const titleParam = encodeURIComponent(idea.title);
    const descParam = encodeURIComponent(`[${idea.requestNumber}] ${idea.description || ""}`);
    if (type === "ticket") {
      setLocation(`/tickets/new?prefillTitle=${titleParam}&prefillDescription=${descParam}&${context.toString()}`);
    } else {
      const notesParam = encodeURIComponent(`[${idea.requestNumber}] ${idea.title}\n${idea.description || ""}`);
      setLocation(`/purchase-orders/new?prefillNotes=${notesParam}&${context.toString()}`);
    }
  };

  if (isLoading) return <div className="space-y-2 pt-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (!ideas.length) return <p className="text-center text-muted-foreground py-12">{t.improvementIdeas.noIdeas}</p>;

  return (
    <div className="space-y-2 pt-3">
      {ideas.map((idea: any) => (
        <Card key={idea.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground font-mono">{idea.requestNumber}</span>
                <p className="font-medium truncate">{idea.title}</p>
              </div>
              <Badge className={IDEA_STATUS_COLORS[idea.status]}>{(t.improvementIdeas.statuses as any)[idea.status]}</Badge>
            </div>

            <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
              {idea.costStudiedAt && <span>{w.totalCost}: {currencyNumber(estimatedTotal(idea))}</span>}
              {idea.implementationOwner && <span>{w.planOwner}: {idea.implementationOwner}</span>}
              {idea.implementationDueDate && <span>{w.dueDate}: {idea.implementationDueDate}</span>}
              {idea.status === "in_progress" && <span>{w.progress}: {idea.implementationProgress ?? 0}%</span>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setPlanTarget(idea)}>{w.plan}</Button>
            {idea.status === "approved" && (!idea.costStudyRequired || (idea.implementationOwner && idea.implementationDueDate)) ? (
              <Select onValueChange={(v) => convert(idea, v as "ticket" | "po")}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder={t.improvementIdeas.convertTo} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticket">{t.improvementIdeas.convertToTicket}</SelectItem>
                  <SelectItem value="po">{t.improvementIdeas.convertToPurchaseOrder}</SelectItem>
                </SelectContent>
              </Select>
            ) : idea.status === "approved" && <p className="text-xs text-amber-700">{w.planRequired}</p>}

            {idea.status === "in_progress" && (
              <div className="space-y-2 text-sm">
                {idea.linkedTicketNumber && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground">{t.improvementIdeas.linkedTicket}: {idea.linkedTicketNumber} — {idea.linkedTicketStatus}</span>
                    <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setLocation(`/tickets/${idea.linkedTicketId}`)}><ExternalLink className="w-3 h-3 ml-1" />{t.improvementIdeas.goToLinked}</Button>
                  </div>
                )}
                {idea.linkedPONumber && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground">{t.improvementIdeas.linkedPurchaseOrder}: {idea.linkedPONumber} — {idea.linkedPOStatus}</span>
                    <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setLocation(`/purchase-orders/${idea.linkedPurchaseOrderId}`)}><ExternalLink className="w-3 h-3 ml-1" />{t.improvementIdeas.goToLinked}</Button>
                  </div>
                )}
                {idea.executionTrackingVersion === 1 && <Button size="sm" variant="outline" onClick={() => setFinancialId(financialId === idea.id ? null : idea.id)}>{w.details}</Button>}
                {idea.executionTrackingVersion === 1 && (financialId === idea.id || completingId === idea.id) && <ImprovementFinancialPanel ideaId={idea.id} />}
                {completingId === idea.id ? (
                  <div className="space-y-2 border rounded-lg p-3">
                    <p className="font-medium">{w.evaluation}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {idea.executionTrackingVersion !== 1 && <div className="space-y-1"><Label>{w.actualCost}{idea.costStudyRequired ? " *" : ""}</Label><Input type="number" step="0.01" min="0" value={actualCost} onChange={e => setActualCost(e.target.value)} /></div>}
                      <div className="space-y-1"><Label>{w.achievedValue}{idea.targetValue != null && idea.costStudyRequired ? " *" : ""}</Label><Input type="number" step="any" value={achievedValue} onChange={e => setAchievedValue(e.target.value)} /></div>
                    </div>
                    {idea.targetValue != null && <p className="text-xs text-muted-foreground">{w.targetValue}: {idea.targetValue} — {w.baselineValue}: {idea.baselineValue ?? '—'}</p>}
                    <div className="space-y-1"><Label>{w.resultRating}{idea.costStudyRequired ? " *" : ""}</Label>
                      <Select value={resultRating} onValueChange={v => setResultRating(v as typeof resultRating)}><SelectTrigger><SelectValue placeholder={w.resultRating} /></SelectTrigger><SelectContent>
                        <SelectItem value="achieved">{w.achieved}</SelectItem><SelectItem value="partial">{w.partial}</SelectItem><SelectItem value="not_achieved">{w.not_achieved}</SelectItem>
                      </SelectContent></Select>
                    </div>
                    <div className="space-y-1"><Label>{w.resultNotes}{idea.costStudyRequired ? " *" : ""}</Label><Textarea value={resultNotes} onChange={e => setResultNotes(e.target.value)} /></div>
                    <Textarea placeholder={t.improvementIdeas.completionNotes} value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={completeMut.isPending} onClick={() => {
                        const cost = moneyValue(actualCost);
                        const actualMetric = achievedValue.trim() ? Number(achievedValue) : undefined;
                        if (actualCost.trim() && cost === null || actualMetric !== undefined && !Number.isFinite(actualMetric)) { toast.error(w.invalidValues); return; }
                        if (idea.costStudyRequired && ((idea.executionTrackingVersion !== 1 && cost === null) || !resultRating || !resultNotes.trim())) { toast.error(w.requireResults); return; }
                        if (idea.costStudyRequired && idea.targetValue != null && actualMetric === undefined) { toast.error(w.targetRequired); return; }
                        completeMut.mutate({ id: idea.id, completionNotes: completionNotes || undefined, actualCost: cost ?? undefined, achievedValue: actualMetric, resultRating: resultRating || undefined, resultNotes: resultNotes.trim() || undefined });
                      }}>{w.review}</Button>
                      <Button size="sm" variant="outline" onClick={() => setCompletingId(null)}>{t.common.cancel}</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setCompletingId(idea.id); setActualCost(""); setAchievedValue(""); setResultRating(""); setResultNotes(""); }}><CheckCircle2 className="w-4 h-4 ml-1" />{w.review}</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {planTarget && <ExecutionPlanDialog idea={planTarget} onClose={() => setPlanTarget(null)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// تبويب: الكل (قائمة كاملة قابلة للفلترة)
// ════════════════════════════════════════════════════════════════════════
function AllIdeasTab() {
  const { t } = useTranslation();
  const w = useFlowLabels();
  const [detailId, setDetailId] = useState<number | null>(null);
  const { getPriorityLabel } = useStaticLabels();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const { data, isLoading } = trpc.improvementIdeas.listPaginated.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined, page, pageSize: PAGE_SIZE,
  }, { placeholderData: keepPreviousData });
  const ideas = data?.ideas ?? [];

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={`${t.common.search}...`} value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            {Object.keys(t.improvementIdeas.statuses).map(k => <SelectItem key={k} value={k}>{(t.improvementIdeas.statuses as any)[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : !ideas.length ? (
        <p className="text-center text-muted-foreground py-12">{t.improvementIdeas.noIdeas}</p>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea: any) => (
            <Card key={idea.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground font-mono">{idea.requestNumber}</span>
                  <p className="font-medium truncate">{idea.title}</p>
                  <p className="text-xs text-muted-foreground">{idea.submitterName || "—"}</p>
                  <Button size="sm" variant="link" className="h-auto px-0" onClick={() => setDetailId(idea.id)}>{w.details}</Button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`border ${PRIORITY_COLORS[idea.priority] || ""}`}>{getPriorityLabel(idea.priority)}</Badge>
                  <Badge className={IDEA_STATUS_COLORS[idea.status]}>{(t.improvementIdeas.statuses as any)[idea.status]}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {detailId !== null && <IdeaOutcomeDialog id={detailId} onClose={() => setDetailId(null)} />}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem><PaginationLink href="#" onClick={e => { e.preventDefault(); if (page > 1) setPage(page - 1); }} className={page <= 1 ? "pointer-events-none opacity-50" : ""}><ChevronLeft className="w-4 h-4" /></PaginationLink></PaginationItem>
              {getPageNumbers(page, data.totalPages).map((p, i) => p === "dots" ? <PaginationItem key={i}><PaginationEllipsis /></PaginationItem> : <PaginationItem key={p}><PaginationLink href="#" isActive={p === page} onClick={e => { e.preventDefault(); setPage(p as number); }}>{p}</PaginationLink></PaginationItem>)}
              <PaginationItem><PaginationLink href="#" onClick={e => { e.preventDefault(); if (page < data.totalPages) setPage(page + 1); }} className={page >= data.totalPages ? "pointer-events-none opacity-50" : ""}><ChevronRight className="w-4 h-4" /></PaginationLink></PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// عرض الموظف العادي: "أفكاري" فقط — بدون أي بيانات داخلية عن المراجعة/القرار
// ════════════════════════════════════════════════════════════════════════
function MyIdeasView({ onCreateClick }: { onCreateClick: () => void }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.improvementIdeas.listPaginated.useQuery({ page, pageSize: PAGE_SIZE }, { placeholderData: keepPreviousData });
  const ideas = data?.ideas ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Lightbulb className="w-6 h-6 text-amber-500" /><h1 className="text-xl font-bold">{t.improvementIdeas.myIdeas}</h1></div>
        <Button onClick={onCreateClick}><Plus className="w-4 h-4 ml-1" />{t.improvementIdeas.createNew}</Button>
      </div>
      {isLoading ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div> : !ideas.length ? (
        <p className="text-center text-muted-foreground py-12">{t.improvementIdeas.noIdeas}</p>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea: any) => (
            <Card key={idea.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground font-mono">{idea.requestNumber}</span>
                    <p className="font-medium truncate">{idea.title}</p>
                  </div>
                  <Badge className={IDEA_STATUS_COLORS[idea.status]}>{(t.improvementIdeas.statuses as any)[idea.status]}</Badge>
                </div>
                {idea.description && <p className="text-sm text-muted-foreground">{idea.description}</p>}
                <IdeaImagesPreview ideaId={idea.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem><PaginationLink href="#" onClick={e => { e.preventDefault(); if (page > 1) setPage(page - 1); }} className={page <= 1 ? "pointer-events-none opacity-50" : ""}><ChevronLeft className="w-4 h-4" /></PaginationLink></PaginationItem>
              {getPageNumbers(page, data.totalPages).map((p, i) => p === "dots" ? <PaginationItem key={i}><PaginationEllipsis /></PaginationItem> : <PaginationItem key={p}><PaginationLink href="#" isActive={p === page} onClick={e => { e.preventDefault(); setPage(p as number); }}>{p}</PaginationLink></PaginationItem>)}
              <PaginationItem><PaginationLink href="#" onClick={e => { e.preventDefault(); if (page < data.totalPages) setPage(page + 1); }} className={page >= data.totalPages ? "pointer-events-none opacity-50" : ""}><ChevronRight className="w-4 h-4" /></PaginationLink></PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════════════
export default function ImprovementIdeas() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const detailId = Number(new URLSearchParams(search).get("ideaId"));
  const sourceDetails = Number.isInteger(detailId) && detailId > 0 ? <IdeaOutcomeDialog id={detailId} onClose={() => setLocation("/improvement-ideas")} /> : null;

  const isTriageRole = !!user && ["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "owner", "admin"].includes(user.role);
  const isSeniorMgmt = !!user && ["senior_management", "executive_director"].includes(user.role);
  const isElevated = isTriageRole || isSeniorMgmt;
  // صلاحية القرار النهائي: الإدارة العليا + owner/admin (نفس قاعدة التجاوز الشامل المعتمدة بكل النظام)
  const canDecide = !!user && ["senior_management", "executive_director", "owner", "admin"].includes(user.role);

  const [activeTab, setActiveTab] = useState(isSeniorMgmt ? "classified" : "new");

  if (!isElevated) {
    return (
      <>
        {sourceDetails}
        <MyIdeasView onCreateClick={() => setCreateOpen(true)} />
        <CreateIdeaDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {sourceDetails}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Lightbulb className="w-6 h-6 text-amber-500" /><h1 className="text-xl font-bold">{t.improvementIdeas.pageTitle}</h1></div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 ml-1" />{t.improvementIdeas.createNew}</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex flex-wrap gap-1">
          {isTriageRole && <TabsTrigger value="new">{t.improvementIdeas.newIdeasTab}</TabsTrigger>}
          <TabsTrigger value="classified">{t.improvementIdeas.classifiedTab}</TabsTrigger>
          {!!user && user.role === "senior_management" && <TabsTrigger value="new">{t.improvementIdeas.newIdeasTab}</TabsTrigger>}
          {isTriageRole && <TabsTrigger value="approved">{t.improvementIdeas.approvedTab}</TabsTrigger>}
          {isTriageRole && <TabsTrigger value="all">{t.improvementIdeas.allTab}</TabsTrigger>}
        </TabsList>
        <TabsContent value="new"><NewIdeasTab canClassify={isTriageRole} /></TabsContent>
        <TabsContent value="classified"><ClassifiedTab canDecide={canDecide} canStudy={isTriageRole} /></TabsContent>
        {isTriageRole && <TabsContent value="approved"><ApprovedTab /></TabsContent>}
        {isTriageRole && <TabsContent value="all"><AllIdeasTab /></TabsContent>}
      </Tabs>

      <CreateIdeaDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
