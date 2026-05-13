# Stage 0.1C: Exact SQL Execution Plan

**STATUS:** AWAITING HUMAN APPROVAL. NO DESTRUCTIVE OPERATIONS PERFORMED.

---

## 1. Exact Affected Tables & Estimated Deleted Row Counts

Based on the live read-only verification queries, the purge will affect the following tables with exact row counts:

| Sequence | Table Name | Target Entity | Estimated Rows to Delete |
| :--- | :--- | :--- | :--- |
| 1 | `audit_logs` | `purchase_order_item`, `po_item` | 0 |
| 2 | `attachments` | `purchase_order_item`, `po_item` | 0 |
| 3 | `purchase_order_items` | - | 9,943 |
| 4 | `audit_logs` | `purchase_order` | 22 |
| 5 | `attachments` | `purchase_order` | 0 |
| 6 | `notifications` | `relatedPOId` | 22 |
| 7 | `procurement_comments` | `purchaseOrderId` | 0 |
| 8 | `purchase_orders` | Root Entity | 3,974 |
| **Total** | | | **13,961 Rows** |

*Note: Protected POs (27 total) and their associated items/logs are strictly excluded from these counts.*

---

## 2. Exact Deletion Sequence & SQL Execution Plan

The execution will be performed via a Node.js script using Drizzle ORM's `sql.raw` to ensure transactional safety and batching.

### Step 1: Define Candidate Subquery
```sql
-- This subquery defines the 3,974 disposable test POs
SELECT id FROM purchase_orders
WHERE requestedById NOT IN (3541355, 3390036)
  AND (accountingApprovedById IS NULL OR accountingApprovedById NOT IN (3541355, 3390036))
  AND (managementApprovedById IS NULL OR managementApprovedById NOT IN (3541355, 3390036))
  AND (rejectedById IS NULL OR rejectedById NOT IN (3541355, 3390036))
  AND id NOT IN (
    SELECT DISTINCT entityId FROM audit_logs 
    WHERE entityType = 'purchase_order' AND userId IN (3541355, 3390036)
  )
```

### Step 2: Transactional Batch Loop
The script will loop through the candidate IDs in batches of **500**. For each batch, it will execute the following sequence inside a single `START TRANSACTION; ... COMMIT;` block:

```sql
-- Sequence 1: Clean PO Item Orphans
DELETE FROM audit_logs 
WHERE entityType IN ('purchase_order_item', 'po_item') 
  AND entityId IN (SELECT id FROM purchase_order_items WHERE purchaseOrderId IN (?));

DELETE FROM attachments 
WHERE entityType IN ('purchase_order_item', 'po_item') 
  AND entityId IN (SELECT id FROM purchase_order_items WHERE purchaseOrderId IN (?));

-- Sequence 2: Delete PO Items
DELETE FROM purchase_order_items 
WHERE purchaseOrderId IN (?);

-- Sequence 3: Clean PO Orphans
DELETE FROM audit_logs 
WHERE entityType = 'purchase_order' AND entityId IN (?);

DELETE FROM attachments 
WHERE entityType = 'purchase_order' AND entityId IN (?);

DELETE FROM notifications 
WHERE relatedPOId IN (?);

DELETE FROM procurement_comments 
WHERE purchaseOrderId IN (?);

-- Sequence 4: Delete Root Purchase Orders
DELETE FROM purchase_orders 
WHERE id IN (?);
```
*(Where `?` is the comma-separated list of 500 IDs for the current batch).*

---

## 3. Estimated Execution Time

- **Pre-execution Backup (`mysqldump`):** ~60 seconds
- **Deletion Script Execution (8 batches x 500):** ~10 - 15 seconds
- **Application Cache Reset (`pkill` & `pnpm dev`):** ~45 seconds
- **Total Maintenance Window:** **~2 Minutes**

---

## 4. Pre-Execution Verification Checklist

Before typing "GO", ensure the following:
- [x] The 27 protected POs belong exclusively to FATAH and KHALED.
- [x] You agree that the remaining 3,974 POs are disposable test data.
- [x] You agree to the deletion of the 9,943 associated `purchase_order_items`.
- [x] You acknowledge that dashboard counters (`pendingApprovals`, `pendingPurchaseItems`) will drop to reflect only the 27 protected POs.
- [x] You acknowledge that the Node.js application will be restarted immediately after execution to flush the cache.

**Awaiting Final Human Approval. Please reply with "GO" to proceed with the destructive purge.**
