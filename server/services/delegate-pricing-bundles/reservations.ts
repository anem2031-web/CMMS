import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { executionRows } from "../operational-issues/issue-reference";
export const pricingBundlesEnabled = () => process.env.DELEGATE_PRICING_BUNDLES_ENABLED === "true";
export async function reservedPricingItemIds(database: any, itemIds: number[]) {
  if (!pricingBundlesEnabled() || itemIds.length === 0) return new Set<number>();
  const rows = await executionRows(database, sql`SELECT reservedItemId FROM delegate_pricing_bundle_items WHERE reservedItemId IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)})`);
  return new Set<number>(rows.map((row: any) => Number(row.reservedItemId)));
}
export async function assertItemOutsidePricingBundle(database: any, itemId: number) {
  if ((await reservedPricingItemIds(database, [itemId])).size) throw new TRPCError({ code: "CONFLICT", message: "أرجع الصنف من حزمة التسعير أولًا قبل تعديل تسعيره أو إرساله منفردًا" });
}
