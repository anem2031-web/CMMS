# Stage 0.1C: Safe Test-Data Purge Execution Plan

## 📋 Overview
This document outlines the final, lightweight, and safe execution plan to purge 3,974 test Purchase Orders (POs) from the CMMS database. The goal is to perform a safe system cleanup while strictly preserving 27 POs associated with the Maintenance Managers (FATAH and KHALED).

**Status:** Execution Planning Only. No data modifications have been performed.

---

## 1. 🛡️ Protected Data Rules
The following 27 Purchase Order IDs have been identified as **PROTECTED** based on interactions by FATAH (ID: 3541355) and KHALED (ID: 3390036) and will **NOT** be deleted:
`1, 174, 206, 398, 436, 1088, 1417, 1470, 1632, 1698, 1719, 2447, 2650, 2874, 3181, 3228, 3344, 3397, 3538, 3549, 3689, 3789, 3854, 3869, 3928, 3982, 3993`

All remaining **3,974** POs are considered disposable test data.

---

## 2. 🗑️ Final Deletion Order & Batch Strategy

To avoid Foreign Key (FK) violations, orphan records, and database locks, the deletion will be executed bottom-up in transactional batches.

### Batch Strategy
- **Batch Size:** 500 Candidate POs per transaction.
- **Estimated Batches:** 8 batches total.
- **Transaction Guarantee:** If any query within a batch fails, the entire batch rolls back.

### Safe Deletion Order (Per Batch)
Within each transaction, the following sequence MUST be executed for the current batch of candidate PO IDs:

1. **Clean Polymorphic Orphans (PO Items):**
   `DELETE FROM audit_logs WHERE entityType IN ('purchase_order_item', 'po_item') AND entityId IN (SELECT id FROM purchase_order_items WHERE purchaseOrderId IN (batch_ids))`
   `DELETE FROM attachments WHERE entityType IN ('purchase_order_item', 'po_item') AND entityId IN (SELECT id FROM purchase_order_items WHERE purchaseOrderId IN (batch_ids))`

2. **Delete PO Items (Direct FK):**
   `DELETE FROM purchase_order_items WHERE purchaseOrderId IN (batch_ids)`

3. **Clean Polymorphic Orphans (POs):**
   `DELETE FROM audit_logs WHERE entityType = 'purchase_order' AND entityId IN (batch_ids)`
   `DELETE FROM attachments WHERE entityType = 'purchase_order' AND entityId IN (batch_ids)`
   `DELETE FROM notifications WHERE relatedPOId IN (batch_ids)`
   `DELETE FROM procurement_comments WHERE purchaseOrderId IN (batch_ids)`

4. **Delete Purchase Orders (Root):**
   `DELETE FROM purchase_orders WHERE id IN (batch_ids)`

---

## 3. ⏪ Rollback Checkpoint Plan

Since this is a test-data cleanup and not an enterprise archival scenario, the rollback plan is lightweight:

1. **Pre-Execution Checkpoint:** 
   Execute a simple mysqldump of the `cmms` database before running the purge script.
   `mysqldump -u [user] -p[pass] cmms > /home/ubuntu/CMMS_REAL/cmms_pre_purge_backup.sql`
2. **Failure Handling:** 
   If the script crashes mid-execution, the current transactional batch will roll back automatically. Previous successful batches remain deleted. If data corruption is detected post-purge, the entire database can be restored from the SQL dump.

---

## 4. 🧹 Cache Reset Procedure

The CMMS application uses `node-cache` which stores POs in memory (`purchase-orders:role:${role}`).
After the purge script completes successfully:
1. **Action:** Restart the Node.js application process.
   `pkill -f "tsx watch server/_core/index.ts" && pnpm dev`
2. **Result:** This guarantees all stale caches are flushed and the frontend will fetch the fresh, purged state.

---

## 5. ✅ Verification Workflow & Application Validation

Immediately after the purge and cache reset, the following validation checklist MUST be executed:

### Post-Purge Queries
1. **Verify Candidate Deletion:** `SELECT COUNT(*) FROM purchase_orders` (Should equal 27).
2. **Verify Protected POs Exist:** `SELECT COUNT(*) FROM purchase_orders WHERE id IN (1, 174, ...)` (Should equal 27).
3. **Verify No Orphans:** 
   - `SELECT COUNT(*) FROM purchase_order_items WHERE purchaseOrderId NOT IN (SELECT id FROM purchase_orders)` (Should be 0).
   - `SELECT COUNT(*) FROM notifications WHERE relatedPOId IS NOT NULL AND relatedPOId NOT IN (SELECT id FROM purchase_orders)` (Should be 0).

### Application Validation Checklist
- [ ] **Dashboard Integrity:** Verify `pendingApprovals` and `pendingPurchaseItems` counters load without errors and reflect the new, smaller counts.
- [ ] **Reports Loading:** Navigate to the `PurchaseCycleReport` and `Reports` pages. Ensure they render successfully without division-by-zero crashes.
- [ ] **Procurement Pages:** Navigate to `/purchase-orders`. Ensure the list loads quickly and pagination/empty states handle the reduced volume gracefully.
- [ ] **Audit Log Rendering:** Navigate to `/audit-log`. Filter by "Purchase Order". Ensure the page loads without referencing missing IDs.
- [ ] **API Responses:** Verify the `kpi.getPOTimelines` endpoint returns a valid 200 OK response.

---

## 6. ⏱️ Execution Estimates & Risk Assessment

- **Estimated Execution Duration:** < 2 minutes (Backup: 60s, Script: 10s, Restart/Verify: 50s).
- **Final Production Risk Assessment:** **LOW**. 
  - The deletion order strictly prevents FK violations.
  - The batching strategy prevents database locks.
  - The application code has been verified to handle empty states safely.

### 🟢 GO / NO-GO Recommendation: **GO**
The execution plan is safe, lightweight, and ready for execution.
