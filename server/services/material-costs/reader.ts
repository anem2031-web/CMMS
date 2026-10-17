import { sql } from "drizzle-orm";
import type { MaterialCostIssue, MaterialCostReturn } from "../../../shared/material-execution-costs";

async function rows(database: any, statement: any): Promise<any[]> {
  const result = await database.execute(statement);
  return Array.isArray(result[0]) ? result[0] : [];
}

/** SELECT-only. Historical allocations without an explicit execution context are excluded.
 * No PO cost or current lot price is used as a fallback for an original snapshot.
 */
export async function readMaterialCostIssues(database: any, filter: { sourceId?: number; source?: "ticket" | "pmv2" | "independent"; from?: string; to?: string; siteId?: number; sectionId?: number; assetId?: number } = {}): Promise<MaterialCostIssue[]> {
  const conditions = [sql`e.executionSource IS NOT NULL`];
  if (filter.source === "ticket") conditions.push(sql`e.executionSource IN ('ticket_named','ticket_team')`);
  else if (filter.source) conditions.push(sql`e.executionSource=${filter.source}`);
  if (filter.sourceId) conditions.push(sql`e.executionId=${filter.sourceId}`);
  if (filter.siteId) conditions.push(sql`a.beneficiarySiteId=${filter.siteId}`);
  if (filter.sectionId) conditions.push(sql`a.beneficiarySectionId=${filter.sectionId}`);
  if (filter.assetId) conditions.push(sql`a.beneficiaryAssetId=${filter.assetId}`);
  if (filter.from || filter.to) {
    const inPeriod = (column: any) => sql`${sql.join([
      ...(filter.from ? [sql`${column}>=${`${filter.from} 00:00:00`}`] : []),
      ...(filter.to ? [sql`${column}<=${`${filter.to} 23:59:59`}`] : []),
    ], sql` AND `)}`;
    conditions.push(sql`(${inPeriod(sql`a.createdAt`)} OR EXISTS (SELECT 1 FROM warehouse_returns wr WHERE wr.sourceDeliveryDocumentId=d.id AND ${inPeriod(sql`wr.createdAt`)}))`);
  }
  const issues = await rows(database, sql`SELECT a.id,a.inventoryTransactionId AS transactionId,d.id AS deliveryId,a.deliveryNumber,
    e.executionSource AS source,e.executionId AS sourceId,e.executionItemId AS sourceItemId,e.executionNumber AS sourceNumber,
    a.beneficiarySiteId AS siteId,COALESCE(s.name,'غير مسجل') AS siteName,a.beneficiarySectionId AS sectionId,COALESCE(c.name,'') AS sectionName,
    a.beneficiaryAssetId AS assetId,COALESCE(x.name,'') AS assetName,COALESCE(d.itemName,v.itemName,'') AS itemName,COALESCE(d.unit,v.unit,'') AS unit,
    COALESCE(l.lotCode,'') AS lotCode,a.quantity,a.lotIssueUnitCostSnapshot AS lotUnitCost,a.allocatedCostTotal AS allocatedValue,
    m.totalCost AS financialValue,CAST(a.createdAt AS CHAR) AS createdAt,COALESCE(d.deliveredToName,'') AS receiverName
    FROM inventory_issue_cost_allocations a
    INNER JOIN material_execution_cost_contexts e ON e.inventoryTransactionId=a.inventoryTransactionId
    LEFT JOIN inventory_transactions m ON m.id=a.inventoryTransactionId
    LEFT JOIN delivery_documents d ON d.inventoryTransactionId=a.inventoryTransactionId
    LEFT JOIN inventory v ON v.id=a.inventoryId LEFT JOIN inventory_lots l ON l.id=a.lotId
    LEFT JOIN sites s ON s.id=a.beneficiarySiteId LEFT JOIN sections c ON c.id=a.beneficiarySectionId LEFT JOIN assets x ON x.id=a.beneficiaryAssetId
    WHERE ${sql.join(conditions, sql` AND `)} ORDER BY a.id`);
  if (!issues.length) return [];
  const deliveryIds = Array.from(new Set<number>(issues.filter(row => row.deliveryId != null).map(row => Number(row.deliveryId))));
  // Fetch all original returns, including those before the selected period, for cent-accurate cumulative allocation.
  const returned: any[] = [];
  for (let start = 0; start < deliveryIds.length; start += 500) {
    const ids = deliveryIds.slice(start, start + 500);
    returned.push(...await rows(database, sql`SELECT r.id,r.returnNumber AS number,r.sourceDeliveryDocumentId AS deliveryId,r.returnedQuantity AS quantity,
      CAST(r.createdAt AS CHAR) AS createdAt,(SELECT SUM(t.totalCost) FROM inventory_transactions t WHERE t.returnId=r.id AND t.type='in' AND t.transactionType='return') AS financialValue
      FROM warehouse_returns r WHERE r.sourceDeliveryDocumentId IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)}) ORDER BY r.createdAt,r.id`));
  }
  const byDelivery = new Map<number, MaterialCostReturn[]>();
  for (const row of returned) {
    const id = Number(row.deliveryId), list = byDelivery.get(id) ?? [];
    list.push({ ...row, id: Number(row.id) }); byDelivery.set(id, list);
  }
  return issues.map(row => ({ ...row, id: Number(row.id), transactionId: Number(row.transactionId), deliveryId: Number(row.deliveryId),
    sourceId: row.sourceId == null ? null : Number(row.sourceId), sourceItemId: row.sourceItemId == null ? null : Number(row.sourceItemId),
    siteId: Number(row.siteId), sectionId: row.sectionId == null ? null : Number(row.sectionId), assetId: row.assetId == null ? null : Number(row.assetId),
    returns: byDelivery.get(Number(row.deliveryId)) ?? [],
  }));
}
