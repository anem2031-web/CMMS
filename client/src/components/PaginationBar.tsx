import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional: label language direction. Defaults to "rtl" */
  dir?: "ltr" | "rtl";
}

/**
 * Stage 0.5 Phase 2 — reusable pagination bar.
 * Renders Previous / page info / Next controls.
 * Hides itself when there is only one page or no data.
 */
export function PaginationBar({ page, pageSize, total, onPageChange, dir = "rtl" }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const isRtl = dir === "rtl";
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 pt-2 pb-1 border-t border-border/40 mt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={prevDisabled}
        className="gap-1"
      >
        {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {isRtl ? "السابق" : "Previous"}
      </Button>

      <span className="text-xs text-muted-foreground select-none">
        {isRtl
          ? `${start}–${end} من ${total.toLocaleString("ar-SA")} | صفحة ${page} من ${totalPages}`
          : `${start}–${end} of ${total.toLocaleString()} | Page ${page} of ${totalPages}`}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={nextDisabled}
        className="gap-1"
      >
        {isRtl ? "التالي" : "Next"}
        {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
