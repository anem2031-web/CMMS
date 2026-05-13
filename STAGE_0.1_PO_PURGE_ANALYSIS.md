# Stage 0.1: Purchase Order Data Purge Analysis (Read-Only)

## 📋 Overview
This report provides a comprehensive, read-only analysis of the `purchase_orders` table and its dependencies within the CMMS database. The objective is to design a safe data purge strategy that removes unnecessary purchase orders while strictly preserving records associated with specific key personnel (FATAH and KHALED) and their roles.

**Status:** Dry-run and Analysis Only. No destructive operations have been executed.

---

## 🔍 Phase A: Dependency Discovery

A thorough inspection of the database schema (`information_schema`) revealed the following dependency chain for `purchase_orders`:

### Primary Dependencies (Direct Foreign Keys)
1. **`purchase_order_items`**: Contains individual line items for each PO. (FK: `purchaseOrderId`)
2. **`procurement_comments`**: Stores discussion threads related to POs. (FK: `purchaseOrderId`)
3. **`notifications`**: System alerts generated for PO events. (FK: `relatedPOId`)

### Secondary & Polymorphic Dependencies
1. **`audit_logs`**: Tracks changes where `entityType = 'purchase_order'` or `entityType = 'purchase_order_item'`.
2. **`attachments`**: Files uploaded for POs where `entityType = 'purchase_order'` or `entityType = 'purchase_order_item'`.
3. **`inventory_transactions`**: Could theoretically link to PO items upon receiving (none found in current dataset).

### Schema Characteristics
- **Triggers**: No database-level triggers found.
- **Views**: No materialized or standard views referencing POs.
- **Soft Deletes**: The `purchase_orders` table does **not** have soft-delete columns (e.g., `deletedAt`, `isDeleted`). Hard deletion is required.

---

## 🛡️ Phase B: Preservation Logic

The business rule dictates preserving all POs related to "FATAH" (User ID: 3541355) and "KHALED" (User ID: 3390036). These users hold the `maintenance_manager` role.

### Preservation Criteria
A Purchase Order is **PRESERVED** if it meets ANY of the following conditions:
1. `requestedById` is FATAH or KHALED.
2. `accountingApprovedById` is FATAH or KHALED.
3. `managementApprovedById` is FATAH or KHALED.
4. `rejectedById` is FATAH or KHALED.
5. The PO is referenced in `audit_logs` where the actor (`userId`) is FATAH or KHALED.

### Edge Cases Detected
During analysis, edge cases were discovered where a user interacted with a PO without being the creator or final approver:
- **PO ID 3689**: Touched by KHALED (recorded in `audit_logs` as a `review_po_items` action and set as `rejectedById`), but originally requested by a different user. This PO is safely caught by the comprehensive preservation logic.

---

## 📊 Phase C: Dry Run Simulation

Based on the preservation logic, the dataset was evaluated to determine the exact impact of the purge.

### Candidate Identification
- **Total Purchase Orders**: 4,001
- **Protected Purchase Orders**: 27
- **Candidate Purchase Orders (To Delete)**: 3,974

### Dependent Rows Impact (To Delete)
If the 3,974 candidate POs are deleted, the following dependent rows must also be purged:
- `purchase_orders`: 3,974 rows
- `purchase_order_items`: 9,943 rows
- `notifications`: 22 rows
- `audit_logs` (PO entity): 22 rows
- `procurement_comments`: 0 rows
- `attachments`: 0 rows
- `inventory_transactions`: 0 rows

### Risk Analysis
- **FK Risk**: High. Deleting a `purchase_order` without first deleting its `purchase_order_items` will cause a foreign key constraint violation.
- **Orphan Risk**: Medium. Polymorphic tables (`audit_logs`, `notifications`) do not enforce database-level foreign keys. Failing to delete these will leave orphan records.
- **Ticket Linkage**: None of the candidate POs are currently linked to `tickets` (`ticketId IS NULL`).

---

## 🏗️ Phase D: Safety Architecture & Execution Strategy

Because the schema does not support soft deletes, a **Hard Delete** strategy must be employed. To ensure absolute safety during the production purge, the following architecture is recommended:

### 1. Pre-Purge Backup
- Execute a full mysqldump of the `cmms` database.
- Create temporary archive tables (e.g., `archive_purchase_orders`) and `INSERT INTO ... SELECT ...` the candidate rows before deletion. This provides an immediate, localized rollback mechanism.

### 2. Transactional Batching
To prevent long table locks and transaction log overflow, the deletion must be chunked (e.g., 500 POs per batch).

### 3. Safe Deletion Order (Bottom-Up)
Deletions must occur in the following strict order within each transaction batch to satisfy foreign key constraints:
1. Delete from `audit_logs` (`entityType = 'purchase_order_item'`)
2. Delete from `attachments` (`entityType = 'purchase_order_item'`)
3. Delete from `purchase_order_items`
4. Delete from `audit_logs` (`entityType = 'purchase_order'`)
5. Delete from `attachments` (`entityType = 'purchase_order'`)
6. Delete from `notifications` (`relatedPOId`)
7. Delete from `procurement_comments`
8. Delete from `purchase_orders`

### 4. Rollback Plan
If any batch fails:
- The database transaction will automatically roll back the current batch.
- If data corruption is detected post-execution, records can be restored from the `archive_purchase_orders` tables or the pre-purge SQL dump.

---
*Report generated by Manus AI on 2026-05-12. No data was modified during this analysis.*
