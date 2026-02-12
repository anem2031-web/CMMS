# Project TODO - CMMS نظام إدارة الصيانة المتكامل

## Phase 1: Database & Schema
- [x] Design complete database schema (users, tickets, purchase orders, items, inventory, audit logs, notifications)
- [x] Push database migrations
- [x] Create db helper functions

## Phase 2: Backend API & Security
- [x] Multi-role authentication system (9 roles)
- [x] Role-based access control middleware
- [x] Maintenance tickets CRUD procedures
- [x] Purchase orders CRUD with multi-item support
- [x] Approval workflow (accounting + senior management)
- [x] Partial purchase tracking per item
- [x] Warehouse receiving with per-item cost/supplier
- [x] Inventory management (stock in/out)
- [x] File upload to S3 (photos, invoices, documents)
- [x] Notification system (in-app + owner alerts)
- [x] AI/LLM integration for analytics and suggestions
- [x] Reports generation procedures
- [x] Security: rate limiting, input validation, audit logging
- [x] Security: row-level permissions, SQL injection prevention

## Phase 3: Core UI Design & Layout
- [x] Global theme and design system (elegant professional)
- [x] RTL Arabic support
- [x] Dashboard layout with sidebar navigation
- [x] Role-based navigation and routing
- [x] Login/auth flow UI

## Phase 4: Tickets & Purchase Orders UI
- [x] Create ticket form with photo capture
- [x] Ticket list with filters and search
- [x] Ticket detail view with status timeline
- [x] Ticket assignment to technicians
- [x] Post-repair photo upload and closure
- [x] Create purchase order with multiple items
- [x] Delegate selection per item
- [x] Estimated cost entry by delegate
- [x] Accounting approval UI
- [x] Senior management approval UI
- [x] Partial purchase confirmation per item
- [x] Invoice/photo upload per purchased item

## Phase 5: Warehouse, Owner Dashboard, Reports & Notifications
- [x] Warehouse receiving UI (per-item cost + supplier)
- [ ] Material dispatch to technicians
- [x] Inventory tracking view
- [x] Owner dashboard with interactive cards
- [x] Monthly/weekly/custom reports with charts
- [ ] Export reports to PDF/Excel
- [x] Actual vs estimated cost comparison
- [ ] Technician performance reports
- [x] In-app notification center
- [x] Auto-notifications for critical events
- [x] AI insights panel

## Phase 6: Testing & Delivery
- [x] Vitest unit tests for critical procedures (20/20 passed)
- [x] Final UI review and polish
- [x] Checkpoint and delivery

## Phase 7: Seed Data
- [x] إنشاء بيانات تجريبية شاملة (مواقع، مستخدمين، بلاغات، طلبات شراء، مخزون، إشعارات، سجل تدقيق)
- [x] إصلاح خطأ card-hover في CSS

## Phase 8: Technician Performance Report
- [x] إضافة API تقرير أداء الفنيين (عدد البلاغات، متوسط وقت الحل، معدل الأداء)
- [x] بناء واجهة تقرير أداء الفنيين مع رسوم بيانية تفاعلية
- [x] اختبارات vitest لتقرير أداء الفنيين (23/23 passed)

## Phase 9: Time Filters for Technician Report
- [x] إضافة معاملات فلترة زمنية لـ API تقرير أداء الفنيين (أسبوع/شهر/ربع سنة/سنة/مخصص)
- [x] تحديث واجهة تقرير الفنيين بشريط فلاتر زمنية تفاعلي
- [x] اختبارات vitest للفلاتر الزمنية (28/28 passed)
