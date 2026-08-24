import { z } from "zod";
import { router, protectedProcedure, inventoryReadProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { loadInventoryStockBalanceReport } from "../../services/reports/inventoryStockBalanceReport";
import { loadInventoryMovementMeta, loadInventoryMovementReport } from "../../services/reports/inventoryMovementReport";
import { loadInventoryValuationReport } from "../../services/reports/inventoryValuationReport";
import { loadInventoryValueDistributionReport } from "../../services/reports/inventoryValueDistributionReport";
import { loadInventoryAccountingReviewReport } from "../../services/reports/inventoryAccountingReviewReport";
import { loadInventoryAnalyticsReport } from "../../services/reports/inventoryAnalyticsReport";

export const inventoryReportsRouter = router({
  // Main Phase 6.2.1 — read-only Stock Balance & Status report.
  // The query intentionally reuses the same report service as Excel/PDF/Print so
  // the screen and exported files are generated from identical filters/data rules.
  stockBalance: inventoryReadProcedure
    .input(z.object({
      search: z.string().trim().max(200).optional(),
      warehouseId: z.number().int().positive().optional(),
      status: z.enum(["all", "normal", "low", "zero", "negative"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      return loadInventoryStockBalanceReport(input || {});
    }),


  // Main Phase 6.2.2 — read-only unified inventory movement report + stock card.
  // Main Phase 6.3.1 — read-only Inventory Valuation report.
  // Uses stored inventory.totalCostValue as the report value basis; it does not
  // recalculate or revalue inventory.
  valuation: inventoryReadProcedure
    .input(z.object({
      search: z.string().trim().max(200).optional(),
      warehouseId: z.number().int().positive().optional(),
      status: z.enum(["all", "positive", "zero", "negative"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      return loadInventoryValuationReport(input || {});
    }),

  // Former 6.3.2 / current merged 6.3.1 — read-only current inventory value grouped by warehouse/category.
  // Reuses 6.3.1 stored totalCostValue basis and the accepted 2B-9 catalog taxonomy.
  valueDistribution: inventoryReadProcedure
    .input(z.object({
      search: z.string().trim().max(200).optional(),
      warehouseId: z.number().int().positive().optional(),
      status: z.enum(["all", "positive", "zero", "negative"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      return loadInventoryValueDistributionReport(input || {});
    }),

  // Merged Main Phase 6.3.2 — read-only Inventory Variance & Accounting Review.
  // Reuses 6.3.1 stored-value rows and the authoritative Main Phase 5.4 reconciliation engine.
  accountingReview: inventoryReadProcedure
    .input(z.object({
      search: z.string().trim().max(200).optional(),
      warehouseId: z.number().int().positive().optional(),
      status: z.enum(["all", "positive", "zero", "negative"]).default("all"),
      category: z.string().trim().max(80).default("all"),
      condition: z.enum(["all", "value_mismatch", "negative_stored_value", "negative_quantity", "reconciliation_exception"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      return loadInventoryAccountingReviewReport(input || {});
    }),

  // Main Phase 6.4 — read-only Inventory Analytics & Planning.
  // Current-state / recorded-history analytics only; no backfill, revaluation, auto-fix, or accounting posting.
  analytics: inventoryReadProcedure
    .input(z.object({
      search: z.string().trim().max(200).optional(),
      warehouseId: z.number().int().positive().optional(),
      category: z.string().trim().max(120).default("all"),
      slowDays: z.number().int().min(1).max(3650).default(90),
      deadDays: z.number().int().min(2).max(3650).default(180),
      turnoverDays: z.number().int().min(1).max(3650).default(365),
    }).optional())
    .query(async ({ input }) => {
      return loadInventoryAnalyticsReport(input || {});
    }),

  movementMeta: inventoryReadProcedure.query(async () => {
    return loadInventoryMovementMeta();
  }),

  movements: inventoryReadProcedure
    .input(z.object({
      search: z.string().trim().max(200).optional(),
      warehouseId: z.number().int().positive().optional(),
      movementType: z.enum(["all", "purchase", "return", "delivery", "adjustment", "disposal", "transfer"]).default("all"),
      direction: z.enum(["all", "in", "out"]).default("all"),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      itemKey: z.string().trim().max(120).optional(),
    }).optional())
    .query(async ({ input }) => {
      return loadInventoryMovementReport(input || {});
    }),

  externalTechnicianPerformance: protectedProcedure.input(z.object({
      period: z.enum(["week", "month", "quarter", "year", "all", "custom"]).default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const period = input?.period || "all";
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;
      if (period === "custom" && input?.dateFrom && input?.dateTo) {
        dateFrom = new Date(input.dateFrom);
        dateTo = new Date(input.dateTo);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period !== "all") {
        dateTo = new Date();
        dateFrom = new Date();
        switch (period) {
          case "week": dateFrom.setDate(dateFrom.getDate() - 7); break;
          case "month": dateFrom.setMonth(dateFrom.getMonth() - 1); break;
          case "quarter": dateFrom.setMonth(dateFrom.getMonth() - 3); break;
          case "year": dateFrom.setFullYear(dateFrom.getFullYear() - 1); break;
        }
      }
      return db.getExternalTechnicianPerformance(period === "all" ? undefined : { dateFrom, dateTo });
    }),
});
