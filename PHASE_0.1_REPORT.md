# Phase 0.1: Performance Baseline Capture Report

## 📋 Overview
This report documents the performance baseline for the CMMS platform after seeding the database with a large-scale test dataset. The goal was to identify existing bottlenecks in DB queries and API endpoints before initiating any optimization.

## 📊 Dataset Scale
- **Tickets:** 10,000 records
- **Purchase Orders:** 2,000 records
- **PO Items:** 5,000 records
- **History/Logs:** 15,000 records

## 🐢 Database Performance Findings
The most significant bottleneck was identified in the **Unpaginated Ticket Retrieval** query.

| Query Scenario | Latency (ms) | Bottleneck Identified |
| :--- | :--- | :--- |
| **Get All Tickets (No Pagination)** | **1,036.87** | High latency due to `HashJoin` and full table scans on large joins. |
| **Dashboard Stats (Aggregations)** | 69.32 | Relatively efficient due to index usage on `status`. |
| **Procurement Report (Joins)** | 72.90 | Moderate latency; scales linearly with PO items. |
| **Notifications Fetch** | 39.97 | Fast lookup via `userId` index. |

> **Critical Note:** Fetching 10k tickets with multiple joins without pagination takes >1 second, which will degrade user experience as the database grows.

## 🚀 API Benchmarking (Local)
Benchmarked using `autocannon` on the running tRPC server.

| Endpoint | Req/Sec | Avg Latency | Throughput |
| :--- | :--- | :--- | :--- |
| **Tickets List** | 1,725.5 | 5.19 ms | 2.20 MB/s |
| **Dashboard Stats** | 3,494.28 | 2.27 ms | 4.37 MB/s |

*Note: Local API benchmarks show high throughput, but actual DB-bound requests in production will likely reflect the DB latencies measured above.*

## 🧠 System Metrics
- **Memory Footprint:** ~772 MB during peak load.
- **CPU Usage:** Significant spikes during complex join executions.

## 🛠 Recommendations for Next Phase
1. **Implement Pagination:** Mandatory for all list views (Tickets, Assets, POs).
2. **Query Optimization:** Refine the Ticket retrieval logic to avoid `HashJoin` on unnecessary columns.
3. **Caching Strategy:** Consider caching Dashboard stats as they are read-heavy but change less frequently than individual tickets.
4. **Index Review:** Ensure composite indexes are available for common filter combinations.

---
*Report generated on 2026-05-12*
