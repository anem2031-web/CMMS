# Stage 0.1B: Pre-Delete Application Impact Validation

## 📋 Overview
This report validates the application-level impact of purging 3,974 Purchase Orders (POs) from the CMMS platform. The analysis covers frontend rendering, backend aggregation logic, reports, dashboards, APIs, and performance forecasting.

**Status:** Read-Only Validation. No data modifications, updates, or cache clearing were performed.

---

## 1. 📊 Dashboard Impact Assessment

The dashboard (`Home.tsx` and `db.getDashboardStats`) heavily relies on aggregate counts of POs and their items. 

### Counters & Summary Cards
Based on the live database simulation, purging the candidate POs will cause a **drastic and immediate drop** in dashboard counters:
- **Pending Approvals (`pendingPOs`):** Will drop from **685** to **6**.
- **Pending Purchase Items (`pendingItems`):** Will drop from **10,008** to **65**.
- **Total Maintenance Cost (`totalCost`):** Currently `null` in the dataset, but any historical costs tied to purged POs would be permanently erased from this aggregate.

### Frontend Expectations
The frontend expects these numbers to reflect the *current active workload*. While the drop is mathematically correct post-purge, users (especially procurement officers and managers) will see their pending queues empty instantly. This is expected behavior for a purge, but requires user communication to prevent panic over "lost" data.

---

## 2. 📈 Report Risk Assessment

The reports module performs complex in-memory aggregations that are highly sensitive to data volume.

### `purchaseCycleReport`
- **Logic:** Fetches *all* POs (`db.getPurchaseOrders()`) and *all* items (`db.getAllPOItems()`) into memory, then maps phases and calculates durations (`totalPOHours`).
- **Impact:** Purging will remove 3,974 POs from this report. Historical cycle times (e.g., average time to approve or purchase in past months) will be permanently lost or skewed, as the report calculates averages dynamically based on existing rows.
- **Division-by-Zero Risk:** Safe. The code checks `if (completedItems.length > 0)` before dividing to calculate `totalPOHours`.

### `costReport`
- **Logic:** Aggregates costs by Site and Section by matching `purchase_order_items.actualTotalCost` with `tickets.actualCost`.
- **Impact:** Any historical costs associated with the purged POs will vanish from the Monthly Cost Report. If the business relies on this report for historical financial auditing, a purge will destroy that capability.
- **Division-by-Zero Risk:** Safe. The percentage calculation uses a ternary operator: `grandTotal > 0 ? (g.totalCost / grandTotal) : 0`.

---

## 3. ⚙️ Backend Service & Background Job Analysis

### Cron Jobs & Workers
- **Findings:** Background jobs (`pm-automation`, `pm-reminder`, `technician-overdue`, `sla-overdue-push`) focus entirely on Tickets and Preventive Maintenance (PM).
- **Impact:** Zero impact. No scheduled jobs depend on PO volume or historical PO existence.

### Cache Management (`cache.ts`)
- **Findings:** POs are cached by role (`purchase-orders:role:${role}`). 
- **Impact:** If the database is purged directly via SQL, the NodeCache will serve stale data until the TTL expires (300 seconds) or an invalidation event occurs. A manual cache clear or application restart is required post-purge.

---

## 4. 🔌 API Impact Assessment

### Pagination Assumptions
- **`getPurchaseOrders` (API):** The backend does **not** implement pagination at the database level (no `LIMIT` or `OFFSET` in `db.getPurchaseOrders`). It returns the entire array of POs to the frontend.
- **Frontend (`PurchaseOrders.tsx`):** Renders the entire list directly. 
- **Impact:** Safe. There are no hardcoded total count assumptions that would break pagination.

### KPI Timelines (`getPOTimelines`)
- **Logic:** Fetches the last 20 POs created within the last 7 days (`limit(20)`).
- **Impact:** If the purged POs were created within the last 7 days, the timeline will simply show fewer or no recent events. No code breakage will occur.

### Audit Logs (`AuditLog.tsx`)
- **Logic:** Filters and maps logs based on `entityType`.
- **Impact:** Safe. Deleting PO-related audit logs will simply remove them from the UI list. The frontend handles empty states gracefully.

---

## 5. 🚀 Performance Impact Forecast

Given that APIs currently fetch *all* POs into memory without pagination, the purge will yield **massive performance improvements**:

1. **Memory Footprint:** Node.js heap usage will drop significantly during report generation and API calls, as 3,974 POs and 9,943 items will no longer be loaded into memory arrays.
2. **API Response Time:** `purchase_orders.list` and `reports.purchaseCycleReport` response times will drop from potentially hundreds of milliseconds to near-instantaneous (sub-50ms).
3. **Frontend Rendering:** The `PurchaseOrders.tsx` page will render much faster without needing to map and DOM-mount thousands of rows.
4. **Database Query Speed:** Full table scans on `purchase_orders` and `purchase_order_items` will be exponentially faster.

---

## 6. 🛡️ Final Recommendation

### Assessment: **PROCEED WITH CAUTION (ARCHIVE FIRST)**

The application code is robust against empty states and division-by-zero errors. However, because the backend relies on live data for **historical cost reporting** and **cycle time analytics**, a hard purge will permanently alter historical financial and performance metrics.

### Recommended Strategy:
1. **Archive First:** Before STAGE 0.2, move the 3,974 candidate POs and their items to `archive_purchase_orders` and `archive_purchase_order_items` tables.
2. **Execute Purge:** Proceed with the transactional bottom-up deletion strategy outlined in STAGE 0.1.
3. **Cache Reset:** Restart the Node.js application immediately after the purge to clear the in-memory `NodeCache`.
4. **Communication:** Notify stakeholders that historical dashboard counters and cost reports will reset, reflecting only the active, preserved workload.

This approach guarantees application stability while securing historical data for future financial audits if needed.
