import { z } from "zod";
import { inventoryReadProcedure, router } from "../_shared/procedures";
import * as db from "../../_core/db";

export const returnDocumentsRouter = router({

  // جلب كل وثائق المرتجعات — تُنشأ تلقائياً بالخادم مع كل مرتجع (لا حاجة
  // لإجراء "generate" منفصل تستدعيه الواجهة)
  list: inventoryReadProcedure.query(async () => {
    return db.getReturnDocuments();
  }),

  incrementPrint: inventoryReadProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const count = await db.incrementReturnDocPrintCount(input.id);
    return { printCount: count };
  }),
});
