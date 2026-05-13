# Stage 0.4 — System Performance Impact Analysis

## Executive Summary
This report presents a comprehensive root-cause analysis of the systemic performance bottlenecks in the CMMS application following the Global Operational Data Reset. The investigation covered frontend rendering architecture, backend API design, database query performance, and network latency. 

The core finding is that the perceived "heaviness" of the application is **not caused by database performance or server compute limitations**, but rather by **frontend architectural decisions**—specifically, an oversized monolithic JavaScript bundle, aggressive over-fetching, lack of pagination, and unoptimized React rendering patterns.

---

## 1. Frontend Rendering Bottlenecks

### 1.1 Monolithic Bundle Size
The Vite build process reveals a massive monolithic bundle (`index-*.js`) weighing **3.6 MB (815 KB gzipped)**. This single file contains almost the entire application, including heavy third-party libraries.
*   **Impact:** Browsers must download, parse, and compile 3.6 MB of JavaScript before the application becomes interactive. This causes a significant delay in the Initial Load Time (Time to Interactive), especially on slower networks or mobile devices.
*   **Root Cause:** The application lacks Route-Level Code Splitting. `App.tsx` imports all 35+ pages and components eagerly at the top level rather than using `React.lazy()` and `Suspense`.
*   **Heavy Dependencies:** Libraries like `recharts` (used in 6 different report pages) and `cytoscape`/`mermaid` (bundled via `markdown` or similar plugins) are included in the main chunk even for users who never visit the reports or diagrams pages.

### 1.2 Over-fetching and N+1 Query Patterns
The frontend heavily relies on tRPC queries (`useQuery`) without adequate data scoping.
*   **TicketDetail.tsx Bottleneck:** The `TicketDetail.tsx` page executes **24 separate tRPC queries** on load. It fetches not only the ticket details but also the entire lists of users, technicians, sections, sites, and purchase orders (`trpc.users.list.useQuery()`, `trpc.purchaseOrders.list.useQuery()`, etc.) just to populate dropdowns or map IDs to names.
*   **Impact:** This creates a massive network waterfall. The browser is blocked waiting for 24 concurrent requests to resolve before it can fully render the page.

### 1.3 Aggressive Background Polling
Several components implement aggressive background polling using `refetchInterval`.
*   `DashboardLayout.tsx` polls `notifications.unreadCount` and `notifications.list` every **5 seconds**.
*   `KpiTimeline.tsx`, `MaintenanceCycleReport.tsx`, and `PurchaseCycleReport.tsx` poll every **60 seconds**.
*   **Impact:** This constant background network activity consumes browser resources, drains battery life, and keeps the React component tree in a constant state of re-evaluation, contributing to the "heavy" feel.

---

## 2. Backend & API Bottlenecks

### 2.1 Missing Pagination (Unbounded Queries)
The most critical backend architectural flaw is the widespread absence of pagination (`LIMIT`/`OFFSET`) in core data-fetching procedures.
*   Functions like `getAllUsers()`, `getTickets()`, `getAssets()`, and `getPurchaseOrders()` return the **entire dataset** in a single array.
*   **Impact:** While currently fast because the operational data was just reset (e.g., 0 tickets, 41 assets), this architecture is a ticking time bomb. As the system scales to thousands of tickets, the API payload size will grow linearly, causing severe memory bloat on the Node.js server and freezing the frontend browser tab when rendering massive tables.

### 2.2 Ineffective Caching Strategy
While a `NodeCache` instance (`cacheManager`) and cache keys are defined in `server/_core/cache.ts`, they are barely utilized in practice.
*   Only 4 specific procedures (`users()`, `usersByRole()`, `technicians`, and `sites()`) actually use `cacheManager.getOrCompute()`.
*   High-traffic, read-heavy endpoints like Dashboard Stats, Asset Lists, and Reports bypass the cache entirely and hit the database on every request.

---

## 3. Database Performance

### 3.1 Query Execution Times
Live performance testing post-cleanup indicates that **TiDB is performing exceptionally well**.
*   `getTickets` (0 rows): ~22ms
*   `getAssets` (41 rows): ~20ms
*   `getDashboardStats` (complex subqueries): ~27ms
*   `getTechnicianPerformance` (JOINs and aggregations): ~23ms

### 3.2 The `getAllUsers` Latency Anomaly
The only outlier is `getAllUsers()`, which occasionally spikes to **377ms** on cold runs before settling to an average of **93ms** for 215 rows.
*   **Root Cause:** The `EXPLAIN` plan shows a `TableFullScan`. While 215 rows is trivial, the lack of an index on commonly filtered fields (like `role` or `isActive`) means the database engine must scan the entire table. The 377ms spike is primarily due to TiDB Serverless cold-start/network routing latency, as warm pings drop to 16ms.

---

## 4. Top Performance Bottlenecks Ranked by Severity

| Rank | Bottleneck | Layer | Severity | Estimated Impact if Fixed |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Monolithic Frontend Bundle (3.6MB)** | Frontend | CRITICAL | 60-80% faster Initial Page Load |
| **2** | **Missing Pagination on Core APIs** | Backend | CRITICAL | Prevents system crash at scale (10k+ rows) |
| **3** | **Over-fetching (24 queries on TicketDetail)** | Frontend/API | HIGH | 50% faster page transitions & rendering |
| **4** | **Aggressive 5s Polling (Notifications)** | Frontend | MEDIUM | Reduced CPU/Network overhead |
| **5** | **Ineffective Backend Caching** | Backend | MEDIUM | Lower DB load during peak usage |

---

## 5. Optimization Roadmap

### Phase 1: Immediate Stabilization (High Impact, Low Effort)
1.  **Implement Route-Level Code Splitting:** Refactor `App.tsx` to use `React.lazy()` and `<Suspense>` for all major routes (especially Reports, which load heavy charting libraries).
2.  **Adjust Polling Intervals:** Increase the notification polling interval from 5 seconds to 30 or 60 seconds, or implement a WebSocket/SSE connection for real-time updates.

### Phase 2: Architectural Scaling (High Impact, Medium Effort)
1.  **Implement API Pagination:** Update `db.ts` and `routers.ts` to support `limit` and `cursor/offset` for `tickets.list`, `assets.list`, and `purchaseOrders.list`.
2.  **Frontend Virtualization:** Implement `react-virtualized` or `@tanstack/react-virtual` for data tables to prevent DOM bloat when rendering hundreds of rows.

### Phase 3: Data Fetching Optimization (Medium Impact, High Effort)
1.  **Consolidate Queries:** Refactor `TicketDetail.tsx` to use a single aggregated tRPC endpoint that returns the ticket and its necessary metadata (e.g., assignee name, asset name) instead of fetching entire master data lists to do client-side mapping.
2.  **Expand Cache Coverage:** Apply `cacheManager.getOrCompute` to expensive, read-heavy dashboard and report queries.

---

## 6. GO / NO-GO Recommendation

**Recommendation: CONDITIONAL GO for Production Scaling.**

The system is currently stable and clean. However, it is **NOT READY for high-volume production scaling** until the **Missing Pagination** (Severity 2) and **Monolithic Bundle** (Severity 1) issues are resolved. 

If the system is deployed as-is, it will perform adequately for the first few weeks, but will inevitably suffer from severe degradation (browser freezing, long load times) as the operational data volume grows. It is highly recommended to execute Phase 1 and Phase 2 of the optimization roadmap before onboarding a large client.
