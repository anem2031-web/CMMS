import {
  ClipboardList,
  PackageSearch,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  TECHNICIAN_BUCKETS,
  type TechnicianBucket,
} from "@shared/technician-task-buckets";
export function technicianBucketTitle(
  bucket: TechnicianBucket,
  language: string
) {
  const labels = {
    execution: ["مهام التنفيذ", "Execution tasks", "عمل درآمد کے کام"],
    materials: ["بانتظار المواد", "Waiting for materials", "مواد کا انتظار"],
    manager: ["بانتظار المسؤول", "Waiting for manager", "ذمہ دار کا انتظار"],
    done: ["تم تنفيذها", "Executed", "کام مکمل"],
  };
  return labels[bucket][language === "ar" ? 0 : language === "ur" ? 2 : 1];
}
export function TechnicianStatusCards({
  counts,
  value,
  onChange,
  language,
  loading = false,
}: {
  counts: Record<TechnicianBucket, number>;
  value: TechnicianBucket;
  onChange: (bucket: TechnicianBucket) => void;
  language: string;
  loading?: boolean;
}) {
  const icons = {
    execution: ClipboardList,
    materials: PackageSearch,
    manager: Users,
    done: CheckCircle2,
  };
  return (
    <div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label={
        language === "ar"
          ? "حالات مهام الفني"
          : language === "ur"
            ? "ٹیکنیشن کے کام کی حالت"
            : "Technician task states"
      }
    >
      {TECHNICIAN_BUCKETS.map(bucket => {
        const Icon = icons[bucket];
        return (
          <button
            key={bucket}
            type="button"
            aria-pressed={value === bucket}
            onClick={() => onChange(bucket)}
            className={`rounded-xl border p-4 text-start transition-colors ${value === bucket ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:bg-muted/50"}`}
          >
            <Icon className="mb-3 h-5 w-5 text-primary" />
            <p className="font-semibold">
              {technicianBucketTitle(bucket, language)}
            </p>
            <p className="mt-2 text-2xl font-bold" aria-live="polite">
              {loading ? "—" : counts[bucket]}
            </p>
          </button>
        );
      })}
    </div>
  );
}
