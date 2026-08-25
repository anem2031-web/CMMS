import * as schema from "../../../drizzle/schema";
import ExcelJS from "exceljs";
import { and, eq, inArray, like, or } from "drizzle-orm";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };
  row.alignment = { horizontal: "center", vertical: "middle" };
}

function naturalCodeCompare(a: string, b: string) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function sortTreeChildren(nodes: any[]) {
  return [...nodes].sort((a, b) => {
    const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (sortDiff) return sortDiff;
    const codeDiff = naturalCodeCompare(String(a.code || ""), String(b.code || ""));
    if (codeDiff) return codeDiff;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function buildNodeMaps(allNodes: any[]) {
  const nodeById = new Map<number, any>();
  const childrenByParent = new Map<number | null, any[]>();

  for (const node of allNodes) {
    nodeById.set(Number(node.id), node);
    const parentId = node.parentId ? Number(node.parentId) : null;
    const children = childrenByParent.get(parentId) || [];
    children.push(node);
    childrenByParent.set(parentId, children);
  }

  for (const [key, children] of childrenByParent.entries()) {
    childrenByParent.set(key, sortTreeChildren(children));
  }

  return { nodeById, childrenByParent };
}

function getNodePath(nodeById: Map<number, any>, nodeId: number | null | undefined) {
  if (!nodeId) return [] as any[];
  const path: any[] = [];
  const visited = new Set<number>();
  let current = nodeById.get(Number(nodeId));

  while (current && !visited.has(Number(current.id))) {
    path.push(current);
    visited.add(Number(current.id));
    current = current.parentId ? nodeById.get(Number(current.parentId)) : undefined;
  }

  return path.reverse();
}

function buildDepthFirstTree(allNodes: any[]) {
  const { childrenByParent } = buildNodeMaps(allNodes);
  const rows: Array<{ node: any; depth: number; displayNumber: string }> = [];

  const walk = (parentId: number | null, depth: number, prefix: string) => {
    const children = childrenByParent.get(parentId) || [];
    children.forEach((node, index) => {
      const displayNumber = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      rows.push({ node, depth, displayNumber });
      walk(Number(node.id), depth + 1, displayNumber);
    });
  };

  walk(null, 0, "");
  return rows;
}

/**
 * Existing import/backup-compatible full catalog export.
 * Kept unchanged in shape because catalog import expects taxonomy_nodes + catalog_items.
 */
export async function exportCatalogExcel(db: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const allNodes: any[] = await db.select().from(schema.catalogNodes);

  const nodeIdToCode = new Map<number, string>();
  allNodes.forEach((n: any) => {
    if (n.id && n.code) nodeIdToCode.set(n.id, n.code);
  });

  const taxonomySheet = workbook.addWorksheet("taxonomy_nodes");
  taxonomySheet.columns = [
    { header: "code", key: "code", width: 15 },
    { header: "parent_code", key: "parentCode", width: 15 },
    { header: "name_ar", key: "nameAr", width: 40 },
    { header: "name_en", key: "nameEn", width: 40 },
    { header: "level", key: "level", width: 10 },
  ];

  const sortedNodes = [...allNodes].sort((a, b) => {
    const la = (a.code || "").length;
    const lb = (b.code || "").length;
    return la - lb;
  });

  sortedNodes.forEach((node: any) => {
    const parentCode = node.parentId ? (nodeIdToCode.get(node.parentId) ?? "") : "";
    taxonomySheet.addRow({
      code: node.code ?? "",
      parentCode,
      nameAr: node.nameAr ?? "",
      nameEn: node.nameEn ?? "",
      level: node.level ?? 1,
    });
  });

  taxonomySheet.getRow(1).font = { bold: true };
  taxonomySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD6E4F0" },
  };

  const allItems: any[] = await db.select().from(schema.catalogItems);
  const nodeIdToCodeForItems = new Map<number, string>();
  allNodes.forEach((n: any) => nodeIdToCodeForItems.set(n.id, n.code ?? ""));

  const itemsSheet = workbook.addWorksheet("catalog_items");
  itemsSheet.columns = [
    { header: "code", key: "code", width: 20 },
    { header: "node_code", key: "nodeCode", width: 15 },
    { header: "name_ar", key: "nameAr", width: 40 },
    { header: "name_en", key: "nameEn", width: 40 },
    { header: "unit", key: "unit", width: 15 },
    { header: "manufacturer", key: "manufacturer", width: 30 },
  ];

  allItems.forEach((item: any) => {
    const nodeCode = item.nodeId ? (nodeIdToCodeForItems.get(item.nodeId) ?? "") : "";
    itemsSheet.addRow({
      code: item.code ?? "",
      nodeCode,
      nameAr: item.nameAr ?? "",
      nameEn: item.nameEn ?? "",
      unit: item.unit ?? "",
      manufacturer: item.manufacturer ?? "",
    });
  });

  itemsSheet.getRow(1).font = { bold: true };
  itemsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD6E4F0" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type CatalogItemsExportFilters = {
  search?: string;
  nodeIds?: number[];
  includeInactive?: boolean;
};

/**
 * User-facing items export. It intentionally exports ALL rows matching the
 * active catalog filters, never just the current UI page.
 */
export async function exportCatalogItemsExcel(
  db: any,
  filters: CatalogItemsExportFilters = {},
): Promise<Buffer> {
  const allNodes: any[] = await db.select().from(schema.catalogNodes);
  const { nodeById } = buildNodeMaps(allNodes);
  const treeOrder = buildDepthFirstTree(allNodes);
  const nodeOrder = new Map<number, number>(treeOrder.map((entry, index) => [Number(entry.node.id), index]));

  const conditions: any[] = [];
  if (!filters.includeInactive) conditions.push(eq(schema.catalogItems.isActive, 1));
  if (filters.nodeIds && filters.nodeIds.length > 0) {
    conditions.push(inArray(schema.catalogItems.nodeId, filters.nodeIds));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(
      like(schema.catalogItems.nameAr, term),
      like(schema.catalogItems.nameEn, term),
      like(schema.catalogItems.code, term),
      like(schema.catalogItems.manufacturer, term),
      like(schema.catalogItems.unit, term),
    ));
  }

  let query = db.select().from(schema.catalogItems);
  if (conditions.length > 0) query = query.where(and(...conditions)) as any;
  const items: any[] = await query;

  items.sort((a, b) => {
    const nodeDiff = (nodeOrder.get(Number(a.nodeId)) ?? Number.MAX_SAFE_INTEGER)
      - (nodeOrder.get(Number(b.nodeId)) ?? Number.MAX_SAFE_INTEGER);
    if (nodeDiff) return nodeDiff;
    const codeDiff = naturalCodeCompare(String(a.code || ""), String(b.code || ""));
    if (codeDiff) return codeDiff;
    return Number(a.id || 0) - Number(b.id || 0);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("الأصناف", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "كود الصنف", key: "code", width: 18 },
    { header: "مسار التصنيف", key: "categoryPath", width: 45 },
    { header: "كود التصنيف", key: "nodeCode", width: 16 },
    { header: "اسم الصنف", key: "nameAr", width: 38 },
    { header: "الاسم الإنجليزي", key: "nameEn", width: 38 },
    { header: "الوحدة", key: "unit", width: 16 },
    { header: "المصنّع", key: "manufacturer", width: 26 },
    { header: "الحالة", key: "status", width: 12 },
  ];
  styleHeader(sheet.getRow(1));

  for (const item of items) {
    const path = getNodePath(nodeById, Number(item.nodeId));
    const node = nodeById.get(Number(item.nodeId));
    sheet.addRow({
      code: item.code ?? "",
      categoryPath: path.map((n: any) => n.nameAr || n.nameEn || n.code || `#${n.id}`).join(" › "),
      nodeCode: node?.code ?? "",
      nameAr: item.nameAr ?? "",
      nameEn: item.nameEn ?? "",
      unit: item.unit ?? "",
      manufacturer: item.manufacturer ?? "",
      status: Number(item.isActive) === 1 ? "نشط" : "معطّل",
    });
  }

  sheet.autoFilter = { from: "A1", to: `H${Math.max(1, sheet.rowCount)}` };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Human-readable taxonomy tree export. The first column is presentation
 * numbering (1, 1.1, 1.1.1...), while catalog code stays a separate source-of-truth column.
 */
export async function exportCatalogTaxonomyTreeExcel(
  db: any,
  includeInactive = true,
): Promise<Buffer> {
  let query = db.select().from(schema.catalogNodes);
  if (!includeInactive) query = query.where(eq(schema.catalogNodes.isActive, 1)) as any;
  const allNodes: any[] = await query;

  const { nodeById } = buildNodeMaps(allNodes);
  const treeRows = buildDepthFirstTree(allNodes);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("شجرة الكتالوج", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "الترقيم", key: "displayNumber", width: 16 },
    { header: "كود التصنيف", key: "code", width: 16 },
    { header: "التصنيف", key: "nameAr", width: 42 },
    { header: "الاسم الإنجليزي", key: "nameEn", width: 38 },
    { header: "المستوى", key: "level", width: 10 },
    { header: "المسار", key: "path", width: 55 },
    { header: "الحالة", key: "status", width: 12 },
  ];
  styleHeader(sheet.getRow(1));

  for (const entry of treeRows) {
    const { node, depth, displayNumber } = entry;
    const path = getNodePath(nodeById, Number(node.id));
    const row = sheet.addRow({
      displayNumber,
      code: node.code ?? "",
      nameAr: node.nameAr ?? "",
      nameEn: node.nameEn ?? "",
      level: node.level ?? depth + 1,
      path: path.map((n: any) => n.nameAr || n.nameEn || n.code || `#${n.id}`).join(" › "),
      status: Number(node.isActive) === 1 ? "نشط" : "معطّل",
    });
    row.getCell("nameAr").alignment = { horizontal: "right", vertical: "middle", indent: Math.min(depth, 15) };
    row.outlineLevel = Math.min(depth, 7);
  }

  sheet.autoFilter = { from: "A1", to: `G${Math.max(1, sheet.rowCount)}` };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
