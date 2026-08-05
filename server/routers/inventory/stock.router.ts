import { z } from "zod";
import { router, inventoryReadProcedure, warehouseProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";

// Stock movement queries — complements inventory.router.ts
export const stockRouter = router({
  getTransactions: inventoryReadProcedure
    .input(z.object({
      inventoryId: z.number().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return db.getInventoryTransactions(input);
    }),

  getLowStockItems: inventoryReadProcedure.query(async () => {
    return db.getLowStockInventoryItems();
  }),
});
