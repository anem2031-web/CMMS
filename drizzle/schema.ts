import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

// ============================================================
// 1. USERS TABLE (extended with CMMS roles)
// ============================================================
export const userRoles = ["operator", "technician", "maintenance_manager", "purchase_manager", "delegate", "accountant", "senior_management", "warehouse", "owner"] as const;
export type UserRole = typeof userRoles[number];

export const supportedLanguages = ["ar", "en", "ur"] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", ...userRoles]).default("user").notNull(),
  department: varchar("department", { length: 100 }),
  preferredLanguage: mysqlEnum("preferredLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================
// 2. SITES / LOCATIONS
// ============================================================
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  address: text("address"),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 3. MAINTENANCE TICKETS
// ============================================================
export const ticketStatuses = [
  "new", "approved", "assigned", "in_progress",
  "needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting",
  "purchase_pending_management", "purchase_approved", "partial_purchase",
  "purchased", "received_warehouse", "repaired", "verified", "closed"
] as const;
export type TicketStatus = typeof ticketStatuses[number];

export const ticketPriorities = ["low", "medium", "high", "critical"] as const;
export const ticketCategories = ["electrical", "plumbing", "hvac", "structural", "mechanical", "general", "safety", "cleaning"] as const;

export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 20 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", [...ticketStatuses]).default("new").notNull(),
  priority: mysqlEnum("priority", [...ticketPriorities]).default("medium").notNull(),
  category: mysqlEnum("category", [...ticketCategories]).default("general").notNull(),
  siteId: int("siteId"),
  locationDetail: varchar("locationDetail", { length: 300 }),
  reportedById: int("reportedById").notNull(),
  assignedToId: int("assignedToId"),
  approvedById: int("approvedById"),
  beforePhotoUrl: text("beforePhotoUrl"),
  afterPhotoUrl: text("afterPhotoUrl"),
  repairNotes: text("repairNotes"),
  materialsUsed: text("materialsUsed"),
  estimatedCost: decimal("estimatedCost", { precision: 12, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 12, scale: 2 }),
  originalLanguage: mysqlEnum("originalLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================
// 4. PURCHASE ORDERS
// ============================================================
export const poStatuses = [
  "draft", "pending_estimate", "pending_accounting", "pending_management",
  "approved", "partial_purchase", "purchased", "received", "closed", "rejected"
] as const;

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  poNumber: varchar("poNumber", { length: 20 }).notNull().unique(),
  ticketId: int("ticketId"),
  requestedById: int("requestedById").notNull(),
  status: mysqlEnum("status", [...poStatuses]).default("draft").notNull(),
  totalEstimatedCost: decimal("totalEstimatedCost", { precision: 12, scale: 2 }),
  totalActualCost: decimal("totalActualCost", { precision: 12, scale: 2 }),
  totalEstimatedText: varchar("totalEstimatedText", { length: 500 }),
  accountingApprovedById: int("accountingApprovedById"),
  accountingApprovedAt: timestamp("accountingApprovedAt"),
  accountingNotes: text("accountingNotes"),
  managementApprovedById: int("managementApprovedById"),
  managementApprovedAt: timestamp("managementApprovedAt"),
  managementNotes: text("managementNotes"),
  rejectedById: int("rejectedById"),
  rejectedAt: timestamp("rejectedAt"),
  rejectionReason: text("rejectionReason"),
  notes: text("notes"),
  originalLanguage: mysqlEnum("originalLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================
// 5. PURCHASE ORDER ITEMS (per-item tracking)
// ============================================================
export const poItemStatuses = ["pending", "estimated", "approved", "funded", "purchased", "delivered_to_warehouse", "delivered_to_requester"] as const;

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  itemName: varchar("itemName", { length: 300 }).notNull(),
  description: text("description"),
  quantity: int("quantity").default(1).notNull(),
  unit: varchar("unit", { length: 50 }),
  photoUrl: text("photoUrl"),
  notes: text("notes"),
  delegateId: int("delegateId"),
  estimatedUnitCost: decimal("estimatedUnitCost", { precision: 12, scale: 2 }),
  estimatedTotalCost: decimal("estimatedTotalCost", { precision: 12, scale: 2 }),
  actualUnitCost: decimal("actualUnitCost", { precision: 12, scale: 2 }),
  actualTotalCost: decimal("actualTotalCost", { precision: 12, scale: 2 }),
  supplierName: varchar("supplierName", { length: 300 }),
  invoicePhotoUrl: text("invoicePhotoUrl"),
  purchasedPhotoUrl: text("purchasedPhotoUrl"),
  status: mysqlEnum("status", [...poItemStatuses]).default("pending").notNull(),
  purchasedAt: timestamp("purchasedAt"),
  purchasedById: int("purchasedById"),
  // Warehouse receiving (delivery to company)
  supplierItemName: varchar("supplierItemName", { length: 300 }),
  warehousePhotoUrl: text("warehousePhotoUrl"),
  receivedAt: timestamp("receivedAt"),
  receivedById: int("receivedById"),
  // Final delivery to requester/technician
  deliveredAt: timestamp("deliveredAt"),
  deliveredById: int("deliveredById"),
  deliveredToId: int("deliveredToId"),
  originalLanguage: mysqlEnum("originalLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================
// 6. INVENTORY
// ============================================================
export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  itemName: varchar("itemName", { length: 300 }).notNull(),
  description: text("description"),
  quantity: int("quantity").default(0).notNull(),
  unit: varchar("unit", { length: 50 }),
  minQuantity: int("minQuantity").default(0),
  location: varchar("location", { length: 200 }),
  siteId: int("siteId"),
  lastRestockedAt: timestamp("lastRestockedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================
// 7. INVENTORY TRANSACTIONS
// ============================================================
export const inventoryTransactions = mysqlTable("inventory_transactions", {
  id: int("id").autoincrement().primaryKey(),
  inventoryId: int("inventoryId").notNull(),
  type: mysqlEnum("type", ["in", "out"]).notNull(),
  quantity: int("quantity").notNull(),
  reason: text("reason"),
  ticketId: int("ticketId"),
  purchaseOrderItemId: int("purchaseOrderItemId"),
  performedById: int("performedById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 8. NOTIFICATIONS
// ============================================================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "warning", "error", "success"]).default("info").notNull(),
  relatedTicketId: int("relatedTicketId"),
  relatedPOId: int("relatedPOId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 9. AUDIT LOG
// ============================================================
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId"),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 10. TICKET STATUS HISTORY
// ============================================================
export const ticketStatusHistory = mysqlTable("ticket_status_history", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  fromStatus: varchar("fromStatus", { length: 50 }),
  toStatus: varchar("toStatus", { length: 50 }).notNull(),
  changedById: int("changedById").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 11. ATTACHMENTS (generic file storage)
// ============================================================
export const attachments = mysqlTable("attachments", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId").notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  uploadedById: int("uploadedById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 12. DATABASE BACKUPS
// ============================================================
export const backups = mysqlTable("backups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileSize: int("fileSize"),
  tablesCount: int("tablesCount"),
  recordsCount: int("recordsCount"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 13. ENTITY TRANSLATIONS (Central Multilingual Engine)
// ============================================================
export const translationStatuses = ["pending", "processing", "completed", "failed", "approved"] as const;
export type TranslationStatus = typeof translationStatuses[number];

export const entityTranslations = mysqlTable("entity_translations", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // TICKET, PO, PO_ITEM, INVENTORY, etc
  entityId: int("entityId").notNull(),
  fieldName: varchar("fieldName", { length: 100 }).notNull(), // title, description, notes, etc
  languageCode: mysqlEnum("languageCode", ["ar", "en", "ur"]).notNull(),
  translatedText: text("translatedText"),
  translationStatus: mysqlEnum("translationStatus", [...translationStatuses]).default("pending").notNull(),
  versionNumber: int("versionNumber").default(1).notNull(),
  translationJobId: int("translationJobId"),
  lastAttemptAt: timestamp("lastAttemptAt"),
  errorMessage: text("errorMessage"),
  approvedById: int("approvedById"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================
// 13. TRANSLATION JOBS (Async Queue)
// ============================================================
export const translationJobStatuses = ["pending", "processing", "completed", "failed"] as const;

export const translationJobs = mysqlTable("translation_jobs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId").notNull(),
  fieldName: varchar("fieldName", { length: 100 }).notNull(),
  sourceLanguage: mysqlEnum("sourceLanguage", ["ar", "en", "ur"]).notNull(),
  targetLanguage: mysqlEnum("targetLanguage", ["ar", "en", "ur"]).notNull(),
  sourceText: text("sourceText").notNull(),
  translatedText: text("translatedText"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  maxRetries: int("maxRetries").default(3).notNull(),
  errorMessage: text("errorMessage"),
  previousTextHash: varchar("previousTextHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

// ============================================================
// 14. TRANSLATION VERSIONS (History)
// ============================================================
export const translationVersions = mysqlTable("translation_versions", {
  id: int("id").autoincrement().primaryKey(),
  entityTranslationId: int("entityTranslationId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  translatedText: text("translatedText"),
  translationStatus: varchar("translationStatus", { length: 20 }).notNull(),
  changedById: int("changedById"),
  changeReason: varchar("changeReason", { length: 50 }), // auto_translate, manual_edit, re_translate
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// 15. ASSETS (إدارة الأصول)
// ============================================================
export const assetStatuses = ["active", "inactive", "under_maintenance", "disposed"] as const;
export type AssetStatus = typeof assetStatuses[number];

export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  assetNumber: varchar("assetNumber", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serialNumber", { length: 100 }),
  siteId: int("siteId"),
  locationDetail: varchar("locationDetail", { length: 200 }),
  status: mysqlEnum("status", ["active", "inactive", "under_maintenance", "disposed"]).default("active").notNull(),
  purchaseDate: timestamp("purchaseDate"),
  purchaseCost: decimal("purchaseCost", { precision: 12, scale: 2 }),
  warrantyExpiry: timestamp("warrantyExpiry"),
  warrantyNotes: text("warrantyNotes"),
  lastMaintenanceDate: timestamp("lastMaintenanceDate"),
  nextMaintenanceDate: timestamp("nextMaintenanceDate"),
  photoUrl: text("photoUrl"),
  qrCode: varchar("qrCode", { length: 200 }),
  notes: text("notes"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// ============================================================
// 16. PREVENTIVE MAINTENANCE PLANS (خطط الصيانة الوقائية)
// ============================================================
export const pmFrequencies = ["daily", "weekly", "monthly", "quarterly", "biannual", "annual"] as const;
export type PMFrequency = typeof pmFrequencies[number];

export const preventivePlans = mysqlTable("preventive_plans", {
  id: int("id").autoincrement().primaryKey(),
  planNumber: varchar("planNumber", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  assetId: int("assetId"),
  siteId: int("siteId"),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "quarterly", "biannual", "annual"]).notNull(),
  frequencyValue: int("frequencyValue").default(1).notNull(), // e.g. every 2 months
  estimatedDurationMinutes: int("estimatedDurationMinutes"),
  assignedToId: int("assignedToId"), // default technician
  checklist: json("checklist"), // array of {id, text, required}
  isActive: boolean("isActive").default(true).notNull(),
  lastGeneratedAt: timestamp("lastGeneratedAt"),
  nextDueDate: timestamp("nextDueDate"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PreventivePlan = typeof preventivePlans.$inferSelect;
export type InsertPreventivePlan = typeof preventivePlans.$inferInsert;

// ============================================================
// 17. PREVENTIVE MAINTENANCE WORK ORDERS (أوامر العمل الوقائية)
// ============================================================
export const pmWorkOrderStatuses = ["scheduled", "in_progress", "completed", "overdue", "cancelled"] as const;

export const pmWorkOrders = mysqlTable("pm_work_orders", {
  id: int("id").autoincrement().primaryKey(),
  workOrderNumber: varchar("workOrderNumber", { length: 50 }).notNull().unique(),
  planId: int("planId").notNull(),
  assetId: int("assetId"),
  siteId: int("siteId"),
  title: varchar("title", { length: 200 }).notNull(),
  scheduledDate: timestamp("scheduledDate").notNull(),
  completedDate: timestamp("completedDate"),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "overdue", "cancelled"]).default("scheduled").notNull(),
  assignedToId: int("assignedToId"),
  checklistResults: json("checklistResults"), // array of {id, text, done, notes}
  technicianNotes: text("technicianNotes"),
  completionPhotoUrl: text("completionPhotoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PMWorkOrder = typeof pmWorkOrders.$inferSelect;
export type InsertPMWorkOrder = typeof pmWorkOrders.$inferInsert;
