import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";
import { purchaseOrderItems, warehouseReceiptItems, warehouseReceipts } from "../../drizzle/schema";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

function reader(file: string, name: string, database: any) {
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const node=source.statements.find(statement=>ts.isFunctionDeclaration(statement)&&statement.name?.text===name)!;
  const code=ts.transpileModule(node.getText(source).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return new Function('getDb','warehouseReceipts','warehouseReceiptItems','purchaseOrderItems','eq','desc','and','or','sql',`${code}; return ${name};`)(async()=>database,warehouseReceipts,warehouseReceiptItems,purchaseOrderItems,eq,desc,and,or,sql);
}
describe('receipt member PO filters executed against temporary SQLite',()=>{
  it('finds one shared receipt for either source PO, without duplicate rows or foreign matches',async()=>{
    const memory=new DatabaseSync(':memory:');
    try {
      memory.exec(`CREATE TABLE warehouse_receipts(id INTEGER,purchaseOrderId INTEGER,createdAt TEXT);
      CREATE TABLE warehouse_receipt_items(receiptId INTEGER,purchaseOrderItemId INTEGER);
      CREATE TABLE purchase_order_items(id INTEGER,purchaseOrderId INTEGER);
      INSERT INTO warehouse_receipts VALUES(1,10,'2026-10-21'),(2,20,'2026-10-20'),(3,NULL,'2026-10-19');
      INSERT INTO purchase_order_items VALUES(101,10),(201,20),(202,20),(301,30);
      INSERT INTO warehouse_receipt_items VALUES(1,101),(1,201),(1,202),(2,301);`);
      const dialect=new MySqlDialect();
      const database={select(){let filter:any;const q:any={from:()=>q,where:(condition:any)=>{filter=dialect.sqlToQuery(condition);return q;},orderBy:()=>q,limit:()=>q,offset:()=>q,
        then:(resolve:any,reject:any)=>Promise.resolve().then(()=>memory.prepare(`SELECT id FROM warehouse_receipts WHERE ${filter.sql} ORDER BY createdAt DESC`).all(...filter.params)).then(resolve,reject)};return q;}};
      const old=reader('server/_core/db/warehouse-receipts.ts','getWarehouseReceiptByPO',database);
      const newer=reader('server/_core/db/warehouse-returns.ts','listWarehouseReceiptsV2',database);
      for(const [poId,expected] of [[10,[1]],[20,[1,2]],[30,[2]],[99,[]]] as const){
        expect((await old(poId)).map((row:any)=>row.id)).toEqual(expected);
        expect((await newer({purchaseOrderId:poId})).map((row:any)=>row.id)).toEqual(expected);
      }
    } finally { memory.close(); }
  });
});
