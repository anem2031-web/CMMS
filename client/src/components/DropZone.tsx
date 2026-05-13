/**
 * DropZone - Reusable Drag & Drop file upload component
 * OPTIMIZED: Image Lifecycle Isolation & Memory Stabilization (Phase 1)
 * 
 * Key improvements:
 * 1. File objects moved to useRef (outside React State) to prevent render storms
 * 2. Controlled throttling on progress updates (100ms) for UI responsiveness
 * 3. Explicit cleanup of File references after upload completion/cancellation
 * 4. Metadata-only State for efficient re-renders
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { Upload, Loader2, CheckCircle2, XCircle, RotateCcw, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  progress: number; // 0-100
  status: "pending" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
  // NOTE: File object is now stored in fileRefsMap, NOT here
};

type DropZoneProps = {
  onFilesUploaded: (files: UploadedFile[]) => void;
  accept?: string;
  maxSizeMB?: number;
  maxFiles?: number;
  uploadUrl?: string;
  label?: string;
  sublabel?: string;
  className?: string;
  disabled?: boolean;
};

const DEFAULT_ACCEPT = "image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DEFAULT_MAX_MB = 10;
const PROGRESS_THROTTLE_MS = 100; // Throttle progress updates to prevent render storms

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
  return <FileText className="w-4 h-4 text-amber-500" />;
}

export default function DropZone({
  onFilesUploaded,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_MB,
  maxFiles = 10,
  uploadUrl = "/api/upload",
  label,
  sublabel,
  className,
  disabled = false,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  // OPTIMIZATION: State now contains only metadata, NOT File objects
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // OPTIMIZATION: Store actual File objects in refs to prevent render storms
  const fileRefsMap = useRef<Map<string, File>>(new Map());
  
  // OPTIMIZATION: Track last progress update time for throttling
  const lastProgressUpdateRef = useRef<Map<string, number>>(new Map());

  /**
   * Cleanup: Explicitly remove File reference after upload completes or is cancelled
   * This prevents orphaned references and memory leaks
   */
  const cleanupFileRef = useCallback((fileId: string) => {
    fileRefsMap.current.delete(fileId);
    lastProgressUpdateRef.current.delete(fileId);
  }, []);

  /**
   * Cleanup: Called when component unmounts to clean all remaining refs
   * SAFETY: Prevents orphaned File references if component is destroyed mid-upload
   */
  useEffect(() => {
    return () => {
      // Component unmount cleanup
      fileRefsMap.current.clear();
      lastProgressUpdateRef.current.clear();
    };
  }, []);

  const uploadFile = useCallback(async (fileEntry: UploadedFile) => {
    // Get File object from ref (not from State)
    const fileObj = fileRefsMap.current.get(fileEntry.id);
    if (!fileObj) {
      setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: "error", error: "File reference lost" } : f));
      return;
    }

    setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: "uploading", progress: 0 } : f));

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      // SAFETY: FormData still receives the File object correctly
      formData.append("file", fileObj);

      // OPTIMIZATION: Throttle progress updates to prevent render storms
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          const lastUpdate = lastProgressUpdateRef.current.get(fileEntry.id) || 0;
          
          // Only update if throttle window has passed
          if (now - lastUpdate >= PROGRESS_THROTTLE_MS) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, progress: pct } : f));
            lastProgressUpdateRef.current.set(fileEntry.id, now);
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            setFiles(prev => {
              const updated = prev.map(f =>
                f.id === fileEntry.id ? { ...f, status: "done" as const, progress: 100, url: data.url } : f
              );
              // Notify parent with all done files
              const doneFiles = updated.filter(f => f.status === "done");
              onFilesUploaded(doneFiles);
              return updated;
            });
          } catch {
            setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: "error", error: "Parse error" } : f));
          }
        } else {
          setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: "error", error: `HTTP ${xhr.status}` } : f));
        }
        // CLEANUP: Remove File ref after upload completes (success or failure)
        cleanupFileRef(fileEntry.id);
        resolve();
      };

      xhr.onerror = () => {
        setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: "error", error: "Network error" } : f));
        // CLEANUP: Remove File ref on network error
        cleanupFileRef(fileEntry.id);
        resolve();
      };

      xhr.open("POST", uploadUrl);
      xhr.send(formData);
    });
  }, [uploadUrl, onFilesUploaded, cleanupFileRef]);

  const processFiles = useCallback(async (rawFiles: File[]) => {
    if (disabled) return;
    const maxMB = maxSizeMB * 1024 * 1024;
    const toAdd: UploadedFile[] = [];

    for (const file of rawFiles.slice(0, maxFiles)) {
      if (file.size > maxMB) continue; // skip oversized
      const fileId = `${Date.now()}-${Math.random()}`;
      
      // OPTIMIZATION: Store File object in ref, not in State
      fileRefsMap.current.set(fileId, file);
      
      const entry: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        progress: 0,
        status: "pending",
      };
      toAdd.push(entry);
    }

    if (toAdd.length === 0) return;
    setFiles(prev => [...prev, ...toAdd]);

    // Upload sequentially
    for (const entry of toAdd) {
      await uploadFile(entry);
    }
  }, [disabled, maxFiles, maxSizeMB, uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    processFiles(dropped);
  }, [processFiles]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      onFilesUploaded(updated.filter(f => f.status === "done"));
      return updated;
    });
    // CLEANUP: Remove File ref when user deletes the file
    cleanupFileRef(id);
  };

  const retryFile = (entry: UploadedFile) => {
    setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "pending", progress: 0, error: undefined } : f));
    uploadFile({ ...entry, status: "pending", progress: 0 });
  };

  const hasFiles = files.length > 0;
  const isUploading = files.some(f => f.status === "uploading");

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 select-none",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01] shadow-md"
            : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />

        <div className={cn(
          "flex flex-col items-center gap-2 transition-transform duration-200",
          isDragging && "scale-105"
        )}>
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <Upload className={cn("w-8 h-8 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
          )}
          <div>
            <p className={cn("text-sm font-medium transition-colors", isDragging ? "text-primary" : "text-foreground")}>
              {isDragging ? "أفلت الملفات هنا" : (label || "اسحب وأفلت الملفات هنا")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sublabel || `أو انقر للاختيار — الحد الأقصى ${maxSizeMB} MB لكل ملف`}
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {hasFiles && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className={cn(
              "flex items-center gap-3 p-3 rounded-lg border text-sm transition-colors",
              f.status === "done" && "border-green-200 bg-green-50/50",
              f.status === "error" && "border-red-200 bg-red-50/50",
              f.status === "uploading" && "border-blue-200 bg-blue-50/50",
              f.status === "pending" && "border-muted bg-muted/30"
            )}>
              {/* Icon */}
              <div className="shrink-0">{getFileIcon(f.mimeType)}</div>

              {/* Name + Progress */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-xs">{f.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>

                {/* Progress Bar */}
                {(f.status === "uploading" || f.status === "done") && (
                  <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        f.status === "done" ? "bg-green-500" : "bg-primary"
                      )}
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}

                {f.status === "error" && (
                  <p className="text-xs text-red-500 mt-0.5">{f.error || "فشل الرفع"}</p>
                )}
              </div>

              {/* Status Icon */}
              <div className="shrink-0 flex items-center gap-1">
                {f.status === "uploading" && (
                  <span className="text-xs text-blue-600 font-medium">{f.progress}%</span>
                )}
                {f.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {f.status === "error" && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); retryFile(f); }}>
                    <RotateCcw className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}>
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
