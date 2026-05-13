# Stage 0.2: Global Operational Data Reset Analysis

## 📋 Executive Summary
This report presents a comprehensive, read-only analysis for a **Global Operational Data Reset** of the CMMS system. The objective is to safely purge all operational, transactional, and workflow data while strictly preserving the **Core Master Data**.

**Recommendation:** ✅ **GO** (with strict adherence to the execution strategy).

---

## 1. 🗄️ Table Classification & Row Counts

Based on the live database analysis, tables are classified into two categories: **Protected (Master Data)** and **Purgeable (Operational Data)**.

### Protected Tables (Core Master Data) — DO NOT TOUCH
These tables form the foundation of the system and must be preserved:
| Table Name | Exact Row Count | Description |
| :--- | :--- | :--- |
| `__drizzle_migrations` | 22 | System schema history |
| `users` | 296 | System users |
| `roles` (implicit) | - | User roles |
| `permissions` (implicit) | - | System permissions |
| `sites` | 2 | Locations/Sites |
| `sections` | 20 | Departments/Sections |
| `technicians` | 12 | Technician profiles |
| `assets` | 2,073 | Physical assets |
| `asset_categories` | 1 | Asset classification |
| `asset_spare_parts` | 0 | Master spare parts catalog |
| `inventory` | 0 | Master inventory items |
| `preventive_plans` | 0 | Master PM plans |
| `push_subscriptions` | 0 | User push notification endpoints |
| `two_factor_secrets` | 0 | User 2FA data |
| `entity_translations` | 0 | System translations |
| `translation_versions` | 0 | System translations |

### Purgeable Tables (Operational Data) — TARGET FOR RESET
These tables contain transactional data generated during system operation:
| Table Name | Exact Row Count | FK Dependencies |
| :--- | :--- | :--- |
| `ticket_status_history` | 45,000 | Depends on `tickets` |
| `tickets` | 40,000 | Root operational entity |
| `notifications` | 20,002 | Polymorphic (`relatedTicketId`, `relatedPOId`) |
| `attachments` | 18 | Polymorphic (`entityType`, `entityId`) |
| `audit_logs` | 4 | Polymorphic (`entityType`, `entityId`) |
| `purchase_order_items` | 65 | Depends on `purchase_orders` |
| `purchase_orders` | 27 | Root operational entity |
| `pm_work_orders` | 1 | Depends on `preventive_plans`, `assets` |
| `backups` | 1 | System backups |
| `asset_metrics` | 0 | Computed metrics |
| `inspection_results` | 0 | Depends on `tickets`, `assets` |
| `inventory_transactions` | 0 | Depends on `inventory`, `tickets`, `purchase_order_items` |
| `pm_jobs` | 0 | Depends on `preventive_plans`, `tickets` |
| `pm_execution_sessions` | 0 | PM workflow |
| `pm_execution_results` | 0 | PM workflow |
| `pm_checklist_items` | 0 | PM workflow |
| `procurement_comments` | 0 | Depends on `purchase_orders` |
| `translation_jobs` | 0 | Temporary translation jobs |
| `two_factor_audit_logs` | 0 | Operational audit |

---

## 2. 🔗 Dependency Map & FK-Safe Deletion Order

To prevent Foreign Key constraint violations and avoid orphan records, deletion must occur strictly from the **leaves (child tables)** up to the **roots (parent tables)**.

### Polymorphic Dependencies
- `attachments` and `audit_logs` reference multiple entities via `entityType` and `entityId`.
- `notifications` reference multiple entities via `relatedTicketId` and `relatedPOId`.

### Safe Deletion Sequence
1. **Level 1 (Deepest Leaves & Polymorphics):**
   - `audit_logs`
   - `attachments`
   - `notifications`
   - `two_factor_audit_logs`
   - `translation_jobs`
2. **Level 2 (Workflow & Metrics):**
   - `ticket_status_history`
   - `inspection_results`
   - `inventory_transactions`
   - `asset_metrics`
   - `procurement_comments`
3. **Level 3 (PM & Procurement Items):**
   - `pm_checklist_items`
   - `pm_execution_results`
   - `pm_execution_sessions`
   - `pm_jobs`
   - `purchase_order_items`
4. **Level 4 (Operational Roots):**
   - `tickets`
   - `purchase_orders`
   - `pm_work_orders`
5. **Level 5 (System Logs):**
   - `backups`

---

## 3. ⚠️ Application-Level Risks & Mitigation

### A. Scheduler / Background Jobs Risk
- **`pm-automation.ts`:** Reads `preventive_plans` and inserts into `pm_work_orders`. **Safe**, as `preventive_plans` are protected.
- **`pm-reminder.ts` & `sla-overdue-push.ts`:** Query `pm_work_orders` and `tickets`. **Safe**, they will simply process 0 records after the reset.
- **`backup-cleanup.ts`:** Deletes old `backups`. **Safe**.

### B. Cache Risk
- The system uses `NodeCache` (`server/_core/cache.ts`) with a 300-second TTL.
- Cached keys include `tickets:stats:user:*`, `report:*`, and `purchase-orders:*`.
- **Mitigation:** The application process (`pnpm dev`) **must be restarted** immediately after the database purge to flush the in-memory cache and prevent serving stale operational data.

### C. Dashboard & Reports Risk (Division by Zero)
- `Reports.tsx`, `CostReport.tsx`, and `PerformanceDashboard.tsx` contain extensive aggregations.
- Code review confirms robust empty-state handling (e.g., `groups.length > 0 && grandTotal > 0`, `?.length || 0`).
- **Mitigation:** No division-by-zero crashes are expected. The UI will gracefully display empty charts or "0" counters.

### D. Frontend Empty-State Risk
- 36 frontend pages implement explicit empty-state handling (`EmptyState` components, `length === 0` checks).
- **Mitigation:** The UI is designed to handle empty operational tables without crashing.

---

## 4. 🛡️ Safe Reset Execution Strategy

To execute this reset safely without `TRUNCATE` or disabling FK checks:

1. **Pre-Flight Backup:** Take a full `mysqldump` of the database.
2. **Maintenance Window:** Stop the application server (`pkill -f "pnpm dev"`) to prevent concurrent writes during the purge.
3. **Transactional Batch Deletion:** Use a Node.js script with Drizzle `sql.raw` to delete records in the exact **Safe Deletion Sequence** outlined above. Large tables (e.g., `tickets` and `ticket_status_history`) must be deleted in batches of 1,000-5,000 to avoid locking the database.
4. **Cache Flush:** Start the application server fresh to clear `NodeCache`.
5. **Verification:** Run a post-purge script to assert that all operational tables have exactly 0 rows, and master data tables remain unchanged.

---

## 5. ✅ Final Recommendation

**GO.**

The CMMS architecture cleanly separates Master Data from Operational Data. The application code (schedulers, reports, frontend) is highly resilient to empty operational tables. By following the strict FK-safe deletion sequence and batching large deletes, the Global Operational Data Reset can be performed safely with zero impact on system stability or Core Master Data integrity.
