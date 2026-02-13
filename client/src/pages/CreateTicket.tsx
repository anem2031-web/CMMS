import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Upload, Loader2, X, FileText, Image as ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";

type UploadedFile = {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export default function CreateTicket() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { getPriorityLabel, getCategoryLabel } = useStaticLabels();
  const { data: sites } = trpc.sites.list.useQuery();

  const [form, setForm] = useState({ title: "", description: "", priority: "medium", category: "general", siteId: "", locationDetail: "", beforePhotoUrl: "" });
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createMut = trpc.tickets.create.useMutation({
    onSuccess: async (data) => {
      // Save attachments for this ticket
      if (attachments.length > 0) {
        for (const att of attachments) {
          try {
            await createAttachmentMut.mutateAsync({
              entityType: "ticket",
              entityId: data.id!,
              fileName: att.fileName,
              fileUrl: att.url,
              fileKey: att.url.split('/').pop() || att.fileName,
              mimeType: att.fileType,
              fileSize: att.fileSize,
            });
          } catch (err) {
            console.error("Failed to save attachment:", err);
          }
        }
      }
      toast.success(`${t.tickets.createNew} ${data.ticketNumber}`);
      setLocation(`/tickets/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const createAttachmentMut = trpc.attachments.add.useMutation();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          const newFile: UploadedFile = {
            url: data.url,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          };
          setAttachments(prev => [...prev, newFile]);
          // Set first image as beforePhotoUrl
          if (file.type.startsWith("image/") && !form.beforePhotoUrl) {
            setForm(f => ({ ...f, beforePhotoUrl: data.url }));
          }
        } else {
          toast.error(`${(t as any).attachments?.uploadFailed || "فشل رفع الملف"}: ${file.name}`);
        }
      } catch {
        toast.error(`${(t as any).attachments?.uploadFailed || "فشل رفع الملف"}: ${file.name}`);
      }
    }
    setUploading(false);
    // Reset input
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const removed = prev[index];
      const newList = prev.filter((_, i) => i !== index);
      // If removed was the beforePhotoUrl, update it
      if (removed.url === form.beforePhotoUrl) {
        const nextImage = newList.find(f => f.fileType.startsWith("image/"));
        setForm(f => ({ ...f, beforePhotoUrl: nextImage?.url || "" }));
      }
      return newList;
    });
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error(t.tickets.ticketTitle); return; }
    createMut.mutate({
      ...form,
      siteId: form.siteId ? parseInt(form.siteId) : undefined,
    });
  };

  const isImage = (type: string) => type.startsWith("image/");
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tickets")}><ArrowRight className="w-5 h-5" /></Button>
        <h1 className="text-xl font-bold">{t.tickets.createNew}</h1>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t.tickets.ticketTitle} *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t.tickets.description}</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.tickets.priority}</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(t.priority).map(k => <SelectItem key={k} value={k}>{getPriorityLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.tickets.category}</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(t.category).map(k => <SelectItem key={k} value={k}>{getCategoryLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.tickets.site}</Label>
              <Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v }))}>
                <SelectTrigger><SelectValue placeholder={t.tickets.site} /></SelectTrigger>
                <SelectContent>
                  {sites?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.tickets.site}</Label>
              <Input value={form.locationDetail} onChange={e => setForm(f => ({ ...f, locationDetail: e.target.value }))} />
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-3">
            <Label>{(t as any).attachments?.title || "المرفقات"}</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleUpload}
              className="hidden"
              multiple
            />
            
            {/* Upload Button */}
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-20 border-dashed gap-2"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {uploading
                ? (t.common.loading)
                : ((t as any).attachments?.uploadHint || "اضغط لرفع صور أو ملفات (يمكنك اختيار عدة ملفات)")
              }
            </Button>

            {/* Uploaded Files Preview */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {(t as any).attachments?.filesCount?.replace("{count}", String(attachments.length)) || `${attachments.length} ملف مرفق`}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative group border rounded-lg overflow-hidden">
                      {isImage(att.fileType) ? (
                        <img src={att.url} alt={att.fileName} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 flex flex-col items-center justify-center bg-muted/50 gap-2">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate max-w-[90%] px-2">{att.fileName}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 flex justify-between items-center">
                        <span className="truncate flex-1">{att.fileName}</span>
                        <span className="mr-2 shrink-0">{formatSize(att.fileSize)}</span>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 left-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAttachment(idx)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={createMut.isPending} className="w-full" size="lg">
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            {t.tickets.createNew}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
