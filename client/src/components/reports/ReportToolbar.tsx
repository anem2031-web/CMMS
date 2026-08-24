import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

export type ReportExportState = "excel" | "pdf" | null;

interface ReportToolbarProps {
  onRefresh?: () => void | Promise<void>;
  onResetFilters?: () => void;
  onPrint?: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  isRefreshing?: boolean;
  exportState?: ReportExportState;
  disabled?: boolean;
  className?: string;
}

/**
 * Shared Phase 6 report toolbar.
 *
 * Keep report actions in one predictable place:
 * Refresh -> Reset Filters | Print -> Export (Excel/PDF).
 * Missing handlers stay visible but disabled so report pages preserve the same UX.
 */
export function ReportToolbar({
  onRefresh,
  onResetFilters,
  onPrint,
  onExportExcel,
  onExportPdf,
  isRefreshing = false,
  exportState = null,
  disabled = false,
  className,
}: ReportToolbarProps) {
  const { t, dir } = useTranslation();
  const labels = t.inventoryReports.toolbar;
  const exportBusy = exportState !== null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm",
        className,
      )}
      dir={dir}
      data-report-toolbar
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={disabled || !onRefresh || isRefreshing}
      >
        {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {labels.refresh}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onResetFilters}
        disabled={disabled || !onResetFilters}
      >
        <RotateCcw className="h-4 w-4" />
        {labels.resetFilters}
      </Button>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPrint}
        disabled={disabled || !onPrint}
      >
        <Printer className="h-4 w-4" />
        {labels.print}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={disabled || exportBusy || (!onExportExcel && !onExportPdf)}
          >
            {exportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {exportBusy ? labels.preparing : labels.export}
            {!exportBusy && <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44" dir={dir}>
          <DropdownMenuItem onSelect={() => onExportExcel?.()} disabled={!onExportExcel || exportBusy}>
            <FileSpreadsheet className="h-4 w-4" />
            {labels.exportExcel}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExportPdf?.()} disabled={!onExportPdf || exportBusy}>
            <FileDown className="h-4 w-4" />
            {labels.exportPdf}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
