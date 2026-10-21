import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { warehouseProcedure } from "../_shared/procedures";
import { getPurchaseReceiptContext } from "../../services/inventory/purchaseReceiptEligibility";

// Dependency injection keeps the actual auth/input boundary executable in tests
// without opening a production database connection.
export function createPurchaseReceiptContextProcedure(getDatabase: () => Promise<any>) {
  return warehouseProcedure
    .input(z.object({
      purchaseOrderId: z.number().int().positive(),
      invoiceNumber: z.string().max(100).optional(),
      purchaseOrderIds: z.array(z.number().int().positive()).min(1).max(500).optional(),
    }))
    .query(async ({ input }) => {
      const database = await getDatabase();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الاتصال بقاعدة البيانات" });
      return getPurchaseReceiptContext(database, input.purchaseOrderId, input.invoiceNumber, input.purchaseOrderIds);
    });
}
