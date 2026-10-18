import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { catalogItems, catalogUnits, inventory, warehouses } from "../../../drizzle/schema";
import { canRoleAccessPath } from "../../../shared/roles";
import { summarizeCatalogStock } from "../../../shared/catalog-stock";
import { inventoryReadProcedure } from "../_shared/procedures";

/** A bounded batch read for the purchase form; no prices, suppliers, lots or stock writes. */
export function createCatalogStockProcedure(getDatabase: () => Promise<any>) {
  return inventoryReadProcedure.input(z.object({
    catalogItemIds: z.array(z.number().int().positive()).min(1).max(500),
  })).query(async ({ input, ctx }) => {
    if (!canRoleAccessPath(ctx.user.role, "/inventory")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لعرض أرصدة المخزون" });
    }
    const database = await getDatabase();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تحميل أرصدة المخزون" });
    const [rows, units] = await Promise.all([
      database.select({
        catalogItemId: catalogItems.id,
        catalogUnit: catalogItems.unit,
        inventoryId: inventory.id,
        warehouseId: inventory.warehouseId,
        nameAr: warehouses.nameAr,
        nameEn: warehouses.nameEn,
        quantity: inventory.quantity,
        unit: sql<string>`COALESCE(NULLIF(TRIM(${inventory.issueUnit}), ''), ${inventory.unit})`,
      }).from(catalogItems)
        .leftJoin(inventory, eq(inventory.linkedItemId, catalogItems.id))
        .leftJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
        .where(inArray(catalogItems.id, Array.from(new Set(input.catalogItemIds)))),
      database.select({ nameAr: catalogUnits.nameAr, nameEn: catalogUnits.nameEn }).from(catalogUnits),
    ]);
    return summarizeCatalogStock(rows, units);
  });
}
