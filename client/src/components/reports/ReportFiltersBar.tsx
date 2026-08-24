import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportFiltersBarProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

/** Shared visual shell for Phase 6 report filters. Actual filters remain report-specific. */
export function ReportFiltersBar({ children, title, className }: ReportFiltersBarProps) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-sm", className)} data-report-filters>
      {title && (
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </section>
  );
}
