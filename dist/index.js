var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/const.ts
var COOKIE_NAME, ONE_YEAR_MS, AXIOS_TIMEOUT_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    COOKIE_NAME = "app_session_id";
    ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
    AXIOS_TIMEOUT_MS = 3e4;
    UNAUTHED_ERR_MSG = "Please login (10001)";
    NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  assetMetrics: () => assetMetrics,
  assetSpareParts: () => assetSpareParts,
  assetStatuses: () => assetStatuses,
  assets: () => assets,
  attachments: () => attachments,
  auditLogs: () => auditLogs,
  backups: () => backups,
  entityTranslations: () => entityTranslations,
  inventory: () => inventory,
  inventoryTransactions: () => inventoryTransactions,
  notifications: () => notifications,
  pmChecklistItems: () => pmChecklistItems,
  pmExecutionResults: () => pmExecutionResults,
  pmExecutionSessionStatuses: () => pmExecutionSessionStatuses,
  pmExecutionSessions: () => pmExecutionSessions,
  pmFrequencies: () => pmFrequencies,
  pmItemResultStatuses: () => pmItemResultStatuses,
  pmJobs: () => pmJobs,
  pmWorkOrderStatuses: () => pmWorkOrderStatuses,
  pmWorkOrders: () => pmWorkOrders,
  poItemStatuses: () => poItemStatuses,
  poStatuses: () => poStatuses,
  preventivePlans: () => preventivePlans,
  purchaseOrderItems: () => purchaseOrderItems,
  purchaseOrders: () => purchaseOrders,
  pushSubscriptions: () => pushSubscriptions,
  sections: () => sections,
  sites: () => sites,
  supportedLanguages: () => supportedLanguages,
  technicianStatuses: () => technicianStatuses,
  technicians: () => technicians,
  ticketCategories: () => ticketCategories,
  ticketPriorities: () => ticketPriorities,
  ticketStatusHistory: () => ticketStatusHistory,
  ticketStatuses: () => ticketStatuses,
  tickets: () => tickets,
  translationJobStatuses: () => translationJobStatuses,
  translationJobs: () => translationJobs,
  translationStatuses: () => translationStatuses,
  translationVersions: () => translationVersions,
  twoFactorAuditLogs: () => twoFactorAuditLogs,
  twoFactorSecrets: () => twoFactorSecrets,
  userRoles: () => userRoles,
  users: () => users
});
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";
var userRoles, supportedLanguages, users, sites, sections, technicianStatuses, technicians, ticketStatuses, ticketPriorities, ticketCategories, tickets, poStatuses, purchaseOrders, poItemStatuses, purchaseOrderItems, inventory, inventoryTransactions, notifications, auditLogs, ticketStatusHistory, attachments, backups, translationStatuses, entityTranslations, translationJobStatuses, translationJobs, translationVersions, assetStatuses, assets, pmFrequencies, preventivePlans, pmWorkOrderStatuses, pmWorkOrders, assetSpareParts, pmJobs, assetMetrics, twoFactorSecrets, twoFactorAuditLogs, pushSubscriptions, pmChecklistItems, pmItemResultStatuses, pmExecutionResults, pmExecutionSessionStatuses, pmExecutionSessions;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    userRoles = ["operator", "technician", "maintenance_manager", "supervisor", "purchase_manager", "delegate", "accountant", "senior_management", "warehouse", "gate_security", "owner"];
    supportedLanguages = ["ar", "en", "ur"];
    users = mysqlTable("users", {
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
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    sites = mysqlTable("sites", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 200 }).notNull(),
      nameEn: varchar("nameEn", { length: 200 }),
      nameUr: varchar("nameUr", { length: 200 }),
      address: text("address"),
      description: text("description"),
      isActive: boolean("isActive").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    sections = mysqlTable("sections", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 200 }).notNull(),
      nameEn: varchar("nameEn", { length: 200 }),
      nameUr: varchar("nameUr", { length: 200 }),
      description: text("description"),
      siteId: int("siteId").notNull(),
      isActive: boolean("isActive").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    technicianStatuses = ["active", "inactive"];
    technicians = mysqlTable("technicians", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 200 }).notNull(),
      nameEn: varchar("nameEn", { length: 200 }),
      nameUr: varchar("nameUr", { length: 200 }),
      specialty: varchar("specialty", { length: 200 }),
      specialtyEn: varchar("specialtyEn", { length: 200 }),
      specialtyUr: varchar("specialtyUr", { length: 200 }),
      status: mysqlEnum("status", [...technicianStatuses]).default("active").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    ticketStatuses = [
      "new",
      // New Workflow statuses
      "pending_triage",
      "under_inspection",
      "work_approved",
      // Path A (Internal Direct)
      "ready_for_closure",
      // Path B (Internal with Procurement)
      "approved",
      "assigned",
      "in_progress",
      "needs_purchase",
      "purchase_pending_estimate",
      "purchase_pending_accounting",
      "purchase_pending_management",
      "purchase_approved",
      "partial_purchase",
      "purchased",
      "received_warehouse",
      // Path C (External)
      "out_for_repair",
      // Final
      "repaired",
      "verified",
      "closed"
    ];
    ticketPriorities = ["low", "medium", "high", "critical"];
    ticketCategories = ["electrical", "plumbing", "hvac", "structural", "mechanical", "general", "safety", "cleaning"];
    tickets = mysqlTable("tickets", {
      id: int("id").autoincrement().primaryKey(),
      ticketNumber: varchar("ticketNumber", { length: 20 }).notNull().unique(),
      title: varchar("title", { length: 300 }).notNull(),
      description: text("description"),
      status: mysqlEnum("status", [...ticketStatuses]).default("new").notNull(),
      priority: mysqlEnum("priority", [...ticketPriorities]).default("medium").notNull(),
      category: mysqlEnum("category", [...ticketCategories]).default("general").notNull(),
      siteId: int("siteId"),
      sectionId: int("sectionId"),
      assetId: int("assetId"),
      locationDetail: varchar("locationDetail", { length: 300 }),
      reportedById: int("reportedById").notNull(),
      assignedToId: int("assignedToId"),
      assignedTechnicianId: int("assignedTechnicianId"),
      // External technician (no system account)
      assignedAt: timestamp("assignedAt"),
      // When technician was assigned
      approvedById: int("approvedById"),
      // Workflow fields
      maintenancePath: mysqlEnum("maintenancePath", ["A", "B", "C"]),
      // A=Internal Direct, B=Internal+Procurement, C=External
      ticketType: mysqlEnum("ticketType", ["internal", "external", "procurement"]),
      supervisorId: int("supervisorId"),
      // Eng. Khaled
      inspectionNotes: text("inspectionNotes"),
      justification: text("justification"),
      // Required for Path C
      triageNotes: text("triageNotes"),
      // Gate/Security fields (Path C)
      gateExitApprovedById: int("gateExitApprovedById"),
      gateExitApprovedAt: timestamp("gateExitApprovedAt"),
      gateEntryApprovedById: int("gateEntryApprovedById"),
      gateEntryApprovedAt: timestamp("gateEntryApprovedAt"),
      externalRepairCompletedAt: timestamp("externalRepairCompletedAt"),
      externalRepairCompletedById: int("externalRepairCompletedById"),
      beforePhotoUrl: text("beforePhotoUrl"),
      afterPhotoUrl: text("afterPhotoUrl"),
      repairNotes: text("repairNotes"),
      materialsUsed: text("materialsUsed"),
      estimatedCost: decimal("estimatedCost", { precision: 12, scale: 2 }),
      actualCost: decimal("actualCost", { precision: 12, scale: 2 }),
      originalLanguage: mysqlEnum("originalLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
      // Auto-translation fields
      title_ar: text("title_ar"),
      title_en: text("title_en"),
      title_ur: text("title_ur"),
      description_ar: text("description_ar"),
      description_en: text("description_en"),
      description_ur: text("description_ur"),
      repairNotes_ar: text("repairNotes_ar"),
      repairNotes_en: text("repairNotes_en"),
      repairNotes_ur: text("repairNotes_ur"),
      closedAt: timestamp("closedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    poStatuses = [
      "draft",
      "pending_estimate",
      "pending_accounting",
      "pending_management",
      "approved",
      "partial_purchase",
      "purchased",
      "received",
      "closed",
      "rejected"
    ];
    purchaseOrders = mysqlTable("purchase_orders", {
      id: int("id").autoincrement().primaryKey(),
      poNumber: varchar("poNumber", { length: 20 }).notNull().unique(),
      ticketId: int("ticketId"),
      siteId: int("siteId"),
      sectionId: int("sectionId"),
      requestedById: int("requestedById").notNull(),
      status: mysqlEnum("status", [...poStatuses]).default("draft").notNull(),
      totalEstimatedCost: decimal("totalEstimatedCost", { precision: 12, scale: 2 }),
      totalActualCost: decimal("totalActualCost", { precision: 12, scale: 2 }),
      totalEstimatedText: varchar("totalEstimatedText", { length: 500 }),
      accountingApprovedById: int("accountingApprovedById"),
      accountingApprovedAt: timestamp("accountingApprovedAt"),
      accountingNotes: text("accountingNotes"),
      custodyAmount: decimal("custodyAmount", { precision: 12, scale: 2 }),
      managementApprovedById: int("managementApprovedById"),
      managementApprovedAt: timestamp("managementApprovedAt"),
      managementNotes: text("managementNotes"),
      rejectedById: int("rejectedById"),
      rejectedAt: timestamp("rejectedAt"),
      rejectionReason: text("rejectionReason"),
      notes: text("notes"),
      originalLanguage: mysqlEnum("originalLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    poItemStatuses = ["pending", "estimated", "approved", "funded", "purchased", "delivered_to_warehouse", "delivered_to_requester"];
    purchaseOrderItems = mysqlTable("purchase_order_items", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    inventory = mysqlTable("inventory", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    inventoryTransactions = mysqlTable("inventory_transactions", {
      id: int("id").autoincrement().primaryKey(),
      inventoryId: int("inventoryId").notNull(),
      type: mysqlEnum("type", ["in", "out"]).notNull(),
      quantity: int("quantity").notNull(),
      reason: text("reason"),
      ticketId: int("ticketId"),
      purchaseOrderItemId: int("purchaseOrderItemId"),
      performedById: int("performedById").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    notifications = mysqlTable("notifications", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      title: varchar("title", { length: 300 }).notNull(),
      message: text("message").notNull(),
      type: mysqlEnum("type", ["info", "warning", "error", "success", "critical"]).default("info").notNull(),
      relatedTicketId: int("relatedTicketId"),
      relatedPOId: int("relatedPOId"),
      isRead: boolean("isRead").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    auditLogs = mysqlTable("audit_logs", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId"),
      action: varchar("action", { length: 100 }).notNull(),
      entityType: varchar("entityType", { length: 50 }).notNull(),
      entityId: int("entityId"),
      oldValues: json("oldValues"),
      newValues: json("newValues"),
      ipAddress: varchar("ipAddress", { length: 45 }),
      userAgent: text("userAgent"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    ticketStatusHistory = mysqlTable("ticket_status_history", {
      id: int("id").autoincrement().primaryKey(),
      ticketId: int("ticketId").notNull(),
      fromStatus: varchar("fromStatus", { length: 50 }),
      toStatus: varchar("toStatus", { length: 50 }).notNull(),
      changedById: int("changedById").notNull(),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    attachments = mysqlTable("attachments", {
      id: int("id").autoincrement().primaryKey(),
      entityType: varchar("entityType", { length: 50 }).notNull(),
      entityId: int("entityId").notNull(),
      fileName: varchar("fileName", { length: 500 }).notNull(),
      fileUrl: text("fileUrl").notNull(),
      fileKey: varchar("fileKey", { length: 500 }).notNull(),
      mimeType: varchar("mimeType", { length: 100 }),
      fileSize: int("fileSize"),
      uploadedById: int("uploadedById").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    backups = mysqlTable("backups", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 200 }).notNull(),
      description: text("description"),
      fileUrl: text("fileUrl").notNull(),
      fileKey: varchar("fileKey", { length: 500 }).notNull(),
      fileSize: int("fileSize"),
      tablesCount: int("tablesCount"),
      recordsCount: int("recordsCount"),
      createdById: int("createdById").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    translationStatuses = ["pending", "processing", "completed", "failed", "approved"];
    entityTranslations = mysqlTable("entity_translations", {
      id: int("id").autoincrement().primaryKey(),
      entityType: varchar("entityType", { length: 50 }).notNull(),
      // TICKET, PO, PO_ITEM, INVENTORY, etc
      entityId: int("entityId").notNull(),
      fieldName: varchar("fieldName", { length: 100 }).notNull(),
      // title, description, notes, etc
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    translationJobStatuses = ["pending", "processing", "completed", "failed"];
    translationJobs = mysqlTable("translation_jobs", {
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
      completedAt: timestamp("completedAt")
    });
    translationVersions = mysqlTable("translation_versions", {
      id: int("id").autoincrement().primaryKey(),
      entityTranslationId: int("entityTranslationId").notNull(),
      versionNumber: int("versionNumber").notNull(),
      translatedText: text("translatedText"),
      translationStatus: varchar("translationStatus", { length: 20 }).notNull(),
      changedById: int("changedById"),
      changeReason: varchar("changeReason", { length: 50 }),
      // auto_translate, manual_edit, re_translate
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    assetStatuses = ["active", "inactive", "under_maintenance", "disposed"];
    assets = mysqlTable("assets", {
      id: int("id").autoincrement().primaryKey(),
      assetNumber: varchar("assetNumber", { length: 50 }).notNull().unique(),
      name: varchar("name", { length: 200 }).notNull(),
      description: text("description"),
      category: varchar("category", { length: 100 }),
      brand: varchar("brand", { length: 100 }),
      model: varchar("model", { length: 100 }),
      serialNumber: varchar("serialNumber", { length: 100 }),
      siteId: int("siteId"),
      sectionId: int("sectionId"),
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
      rfidTag: varchar("rfidTag", { length: 100 }).unique(),
      notes: text("notes"),
      // Auto-translation fields
      description_ar: text("description_ar"),
      description_en: text("description_en"),
      description_ur: text("description_ur"),
      notes_ar: text("notes_ar"),
      notes_en: text("notes_en"),
      notes_ur: text("notes_ur"),
      originalLanguage: mysqlEnum("originalLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
      createdById: int("createdById"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    pmFrequencies = ["daily", "weekly", "monthly", "quarterly", "biannual", "annual"];
    preventivePlans = mysqlTable("preventive_plans", {
      id: int("id").autoincrement().primaryKey(),
      planNumber: varchar("planNumber", { length: 50 }).notNull().unique(),
      title: varchar("title", { length: 200 }).notNull(),
      description: text("description"),
      assetId: int("assetId"),
      siteId: int("siteId"),
      frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "quarterly", "biannual", "annual"]).notNull(),
      frequencyValue: int("frequencyValue").default(1).notNull(),
      // e.g. every 2 months
      estimatedDurationMinutes: int("estimatedDurationMinutes"),
      assignedToId: int("assignedToId"),
      // default technician
      checklist: json("checklist"),
      // array of {id, text, required}
      isActive: boolean("isActive").default(true).notNull(),
      lastGeneratedAt: timestamp("lastGeneratedAt"),
      nextDueDate: timestamp("nextDueDate"),
      createdById: int("createdById"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    pmWorkOrderStatuses = ["scheduled", "in_progress", "completed", "overdue", "cancelled"];
    pmWorkOrders = mysqlTable("pm_work_orders", {
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
      checklistResults: json("checklistResults"),
      // array of {id, text, done, notes}
      technicianNotes: text("technicianNotes"),
      completionPhotoUrl: text("completionPhotoUrl"),
      // Auto-translation fields
      technicianNotes_ar: text("technicianNotes_ar"),
      technicianNotes_en: text("technicianNotes_en"),
      technicianNotes_ur: text("technicianNotes_ur"),
      originalLanguage: mysqlEnum("originalLanguage", ["ar", "en", "ur"]).default("ar").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    assetSpareParts = mysqlTable("asset_spare_parts", {
      id: int("id").autoincrement().primaryKey(),
      assetId: int("assetId").notNull(),
      inventoryItemId: int("inventoryItemId").notNull(),
      minStockLevel: int("minStockLevel").default(5).notNull(),
      // الحد الأدنى للتنبيه
      preferredQuantity: int("preferredQuantity").default(10).notNull(),
      // الكمية المفضلة للطلب
      notes: text("notes"),
      // ملاحظات خاصة بهذا الجزء للأصل
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    pmJobs = mysqlTable("pm_jobs", {
      id: int("id").autoincrement().primaryKey(),
      planId: int("planId").notNull(),
      assetId: int("assetId").notNull(),
      ticketId: int("ticketId"),
      // البلاغ المُنشأ تلقائياً
      dueDate: timestamp("dueDate").notNull(),
      executedDate: timestamp("executedDate"),
      status: mysqlEnum("status", ["pending", "executed", "skipped", "overdue"]).default("pending").notNull(),
      autoCreatedTicket: boolean("autoCreatedTicket").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    assetMetrics = mysqlTable("asset_metrics", {
      id: int("id").autoincrement().primaryKey(),
      assetId: int("assetId").notNull().unique(),
      totalTickets: int("totalTickets").default(0).notNull(),
      closedTickets: int("closedTickets").default(0).notNull(),
      totalDowntime: int("totalDowntime").default(0).notNull(),
      // بالدقائق
      mttr: decimal("mttr", { precision: 10, scale: 2 }).default("0").notNull(),
      // Mean Time To Repair (بالساعات)
      mtbf: decimal("mtbf", { precision: 10, scale: 2 }).default("0").notNull(),
      // Mean Time Between Failures (بالساعات)
      availability: decimal("availability", { precision: 5, scale: 2 }).default("100").notNull(),
      // النسبة المئوية
      lastFailureDate: timestamp("lastFailureDate"),
      lastRepairDate: timestamp("lastRepairDate"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    twoFactorSecrets = mysqlTable("two_factor_secrets", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().unique(),
      secret: varchar("secret", { length: 255 }).notNull(),
      // Base32 encoded secret
      backupCodes: text("backupCodes").notNull(),
      // JSON array of hashed backup codes
      isEnabled: boolean("isEnabled").default(false).notNull(),
      enabledAt: timestamp("enabledAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    twoFactorAuditLogs = mysqlTable("two_factor_audit_logs", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      action: varchar("action", { length: 50 }).notNull(),
      // "setup", "verify_success", "verify_failed", "disable", "backup_code_used"
      ipAddress: varchar("ipAddress", { length: 45 }),
      userAgent: text("userAgent"),
      success: boolean("success").notNull(),
      details: text("details"),
      // JSON with additional info
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    pushSubscriptions = mysqlTable("push_subscriptions", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      endpoint: text("endpoint").notNull(),
      p256dh: text("p256dh").notNull(),
      auth: text("auth").notNull(),
      userAgent: text("userAgent"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    pmChecklistItems = mysqlTable("pm_checklist_items", {
      id: int("id").autoincrement().primaryKey(),
      planId: int("planId").notNull(),
      // FK → preventive_plans.id
      orderIndex: int("orderIndex").default(0).notNull(),
      // ترتيب البند
      text: text("text").notNull(),
      // نص البند
      text_ar: text("text_ar"),
      text_en: text("text_en"),
      isRequired: boolean("isRequired").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    pmItemResultStatuses = ["ok", "fixed", "issue"];
    pmExecutionResults = mysqlTable("pm_execution_results", {
      id: int("id").autoincrement().primaryKey(),
      workOrderId: int("workOrderId").notNull(),
      // FK → pm_work_orders.id
      checklistItemId: int("checklistItemId").notNull(),
      // FK → pm_checklist_items.id
      status: mysqlEnum("status", ["ok", "fixed", "issue"]).notNull(),
      // ✅ سليم | 🛠️ إصلاح فوري | ⚠️ يوجد خلل
      fixNotes: text("fixNotes"),
      // ملاحظة الإصلاح الفوري
      photoUrl: text("photoUrl"),
      // صورة توثيق
      linkedTicketId: int("linkedTicketId"),
      // FK → tickets.id (إذا تم فتح بلاغ)
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    pmExecutionSessionStatuses = ["in_progress", "completed", "paused"];
    pmExecutionSessions = mysqlTable("pm_execution_sessions", {
      id: int("id").autoincrement().primaryKey(),
      workOrderId: int("workOrderId").notNull().unique(),
      // FK → pm_work_orders.id
      technicianId: int("technicianId").notNull(),
      // FK → users.id
      startedAt: timestamp("startedAt").defaultNow().notNull(),
      completedAt: timestamp("completedAt"),
      durationSeconds: int("durationSeconds"),
      // مدة التنفيذ بالثواني
      totalItems: int("totalItems").default(0).notNull(),
      okCount: int("okCount").default(0).notNull(),
      fixedCount: int("fixedCount").default(0).notNull(),
      issueCount: int("issueCount").default(0).notNull(),
      generalNotes: text("generalNotes"),
      // ملاحظات عامة
      status: mysqlEnum("status", ["in_progress", "completed", "paused"]).default("in_progress").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
    };
  }
});

// server/webPush.ts
var webPush_exports = {};
__export(webPush_exports, {
  sendPushToAll: () => sendPushToAll,
  sendPushToRoles: () => sendPushToRoles,
  sendPushToUser: () => sendPushToUser
});
import webpush from "web-push";
function ensureInit() {
  if (initialized) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[WebPush] VAPID keys not configured, push notifications disabled");
    return;
  }
  webpush.setVapidDetails(
    "mailto:admin@cmms.local",
    publicKey,
    privateKey
  );
  initialized = true;
}
async function sendPushToUser(userId, payload) {
  ensureInit();
  if (!initialized) return { sent: 0, failed: 0 };
  const subscriptions = await getPushSubscriptionsByUser(userId);
  return sendToSubscriptions(subscriptions, payload);
}
async function sendPushToAll(payload) {
  ensureInit();
  if (!initialized) return { sent: 0, failed: 0 };
  const subscriptions = await getAllPushSubscriptions();
  return sendToSubscriptions(subscriptions, payload);
}
async function sendPushToRoles(allSubscriptions, payload) {
  ensureInit();
  if (!initialized) return { sent: 0, failed: 0 };
  return sendToSubscriptions(allSubscriptions, payload);
}
async function sendToSubscriptions(subscriptions, payload) {
  let sent = 0;
  let failed = 0;
  const payloadStr = JSON.stringify(payload);
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
          { TTL: 3600 }
        );
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          await deletePushSubscription(sub.endpoint).catch(() => {
          });
        }
      }
    })
  );
  return { sent, failed };
}
var initialized;
var init_webPush = __esm({
  "server/webPush.ts"() {
    "use strict";
    init_db();
    initialized = false;
  }
});

// server/db.ts
import { eq, desc, asc, and, sql, count, sum, inArray, notInArray, like, or, gte, lte, lt, isNull, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "owner";
      updateSet.role = "owner";
    }
    if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByUsername(username) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createLocalUser(data) {
  const db = await getDb();
  if (!db) return null;
  const openId = `local_${data.username}_${Date.now()}`;
  const result = await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    role: data.role,
    email: data.email || null,
    phone: data.phone || null,
    department: data.department || null,
    loginMethod: "local",
    lastSignedIn: /* @__PURE__ */ new Date()
  });
  return result[0].insertId;
}
async function updateUserPassword(userId, passwordHash) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}
async function getUsersByRole(role) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, role));
}
async function getManagerUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(
    inArray(users.role, ["maintenance_manager", "owner", "admin"])
  );
}
async function updateUserRole(userId, role) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
async function getAllSites() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sites).orderBy(desc(sites.createdAt));
}
async function createSite(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(sites).values(data);
  return result[0].insertId;
}
async function getSections(siteId) {
  const db = await getDb();
  if (!db) return [];
  if (siteId) return db.select().from(sections).where(eq(sections.siteId, siteId)).orderBy(asc(sections.name));
  return db.select().from(sections).orderBy(asc(sections.siteId), asc(sections.name));
}
async function createSection(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(sections).values(data);
  return result[0].insertId;
}
async function updateSection(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(sections).set(data).where(eq(sections.id, id));
}
async function deleteSection(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sections).where(eq(sections.id, id));
}
async function getAllTechnicians(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) return db.select().from(technicians).where(eq(technicians.status, "active")).orderBy(asc(technicians.name));
  return db.select().from(technicians).orderBy(asc(technicians.name));
}
async function createTechnician(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(technicians).values({ ...data, status: "active" });
  return result[0].insertId;
}
async function updateTechnician(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(technicians).set(data).where(eq(technicians.id, id));
}
async function deleteTechnician(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(technicians).where(eq(technicians.id, id));
}
async function getTechnicianOpenTicketCounts() {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select({ technicianId: tickets.assignedTechnicianId, cnt: count() }).from(tickets).where(and(isNotNull(tickets.assignedTechnicianId), isNull(tickets.closedAt))).groupBy(tickets.assignedTechnicianId);
  const result = {};
  for (const row of rows) {
    if (row.technicianId != null) result[row.technicianId] = row.cnt;
  }
  return result;
}
async function getNextTicketNumber() {
  const db = await getDb();
  if (!db) return "MT-2026-00001";
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const result = await db.select({ cnt: count() }).from(tickets);
  const num = (result[0]?.cnt || 0) + 1;
  return `MT-${year}-${String(num).padStart(5, "0")}`;
}
async function createTicket(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(tickets).values(data);
  return result[0].insertId;
}
async function getTickets(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(tickets.status, filters.status));
  if (filters?.priority) conditions.push(eq(tickets.priority, filters.priority));
  if (filters?.siteId) conditions.push(eq(tickets.siteId, filters.siteId));
  if (filters?.sectionId) conditions.push(eq(tickets.sectionId, filters.sectionId));
  if (filters?.assetId) conditions.push(eq(tickets.assetId, filters.assetId));
  if (filters?.assignedToId) conditions.push(eq(tickets.assignedToId, filters.assignedToId));
  if (filters?.assignedTechnicianId) conditions.push(eq(tickets.assignedTechnicianId, filters.assignedTechnicianId));
  if (filters?.reportedById) conditions.push(eq(tickets.reportedById, filters.reportedById));
  if (filters?.search) conditions.push(or(like(tickets.title, `%${filters.search}%`), like(tickets.ticketNumber, `%${filters.search}%`)));
  if (filters?.category) conditions.push(eq(tickets.category, filters.category));
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const rows = await db.select({ ticket: tickets, technicianName: technicians.name }).from(tickets).leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id)).where(where).orderBy(desc(tickets.createdAt));
  return rows.map((r) => ({ ...r.ticket, assignedTechnicianName: r.technicianName ?? null }));
}
async function getTicketById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return result[0] || null;
}
async function updateTicket(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(tickets).set(data).where(eq(tickets.id, id));
}
async function addTicketStatusHistory(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(ticketStatusHistory).values(data);
}
async function getTicketHistory(ticketId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, ticketId)).orderBy(desc(ticketStatusHistory.createdAt));
}
async function getNextPONumber() {
  const db = await getDb();
  if (!db) return "PR-2026-0001";
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const result = await db.select({ cnt: count() }).from(purchaseOrders);
  const num = (result[0]?.cnt || 0) + 1;
  return `PR-${year}-${String(num).padStart(4, "0")}`;
}
async function createPurchaseOrder(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(purchaseOrders).values(data);
  return result[0].insertId;
}
async function getPurchaseOrders(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(purchaseOrders.status, filters.status));
  if (filters?.requestedById) conditions.push(eq(purchaseOrders.requestedById, filters.requestedById));
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  return db.select().from(purchaseOrders).where(where).orderBy(desc(purchaseOrders.createdAt));
}
async function getPurchaseOrderById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return result[0] || null;
}
async function updatePurchaseOrder(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id));
}
async function createPOItems(items) {
  const db = await getDb();
  if (!db) return;
  if (items.length > 0) await db.insert(purchaseOrderItems).values(items);
}
async function getPOItems(purchaseOrderId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId)).orderBy(purchaseOrderItems.id);
}
async function getPOItemsByDelegate(delegateId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.delegateId, delegateId)).orderBy(desc(purchaseOrderItems.createdAt));
}
async function updatePOItem(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(purchaseOrderItems).set(data).where(eq(purchaseOrderItems.id, id));
}
async function getPOItemById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id)).limit(1);
  return result[0] || null;
}
async function getPOItemsByStatus(status) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.status, status)).orderBy(desc(purchaseOrderItems.createdAt));
}
async function getInventoryItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventory).orderBy(desc(inventory.updatedAt));
}
async function createInventoryItem(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(inventory).values(data);
  return result[0].insertId;
}
async function updateInventoryItem(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(inventory).set(data).where(eq(inventory.id, id));
}
async function addInventoryTransaction(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(inventoryTransactions).values(data);
  const item = await db.select().from(inventory).where(eq(inventory.id, data.inventoryId)).limit(1);
  if (item[0]) {
    const newQty = data.type === "in" ? item[0].quantity + data.quantity : item[0].quantity - data.quantity;
    await db.update(inventory).set({ quantity: Math.max(0, newQty) }).where(eq(inventory.id, data.inventoryId));
  }
}
async function getWebPush() {
  if (!_webPush) _webPush = await Promise.resolve().then(() => (init_webPush(), webPush_exports));
  return _webPush;
}
async function createNotification(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
  getWebPush().then((wp) => {
    const url = data.relatedTicketId ? `/tickets/${data.relatedTicketId}` : data.relatedPOId ? `/purchase-orders/${data.relatedPOId}` : "/notifications";
    wp.sendPushToUser(data.userId, {
      title: data.title,
      body: data.message,
      type: data.type || "info",
      tag: `notif-${data.userId}-${Date.now()}`,
      url
    }).catch(() => {
    });
  }).catch(() => {
  });
}
async function getUserNotifications(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}
async function markNotificationRead(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}
async function markAllNotificationsRead(userId) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}
async function getUnreadNotificationCount(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ cnt: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.cnt || 0;
}
async function createAuditLog(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}
async function getTechnicianPerformance(filters) {
  const db = await getDb();
  if (!db) return [];
  const dateFrom = filters?.dateFrom;
  const dateTo = filters?.dateTo;
  const siteId = filters?.siteId;
  const sectionId = filters?.sectionId;
  const technicianName = filters?.technicianName?.trim().toLowerCase();
  const withDateFilter = (baseConditions, dateField) => {
    const conds = [...baseConditions];
    if (dateFrom) conds.push(gte(dateField, dateFrom));
    if (dateTo) conds.push(lte(dateField, dateTo));
    return conds;
  };
  const siteSecCond = () => {
    const c = [];
    if (siteId) c.push(eq(tickets.siteId, siteId));
    if (sectionId) c.push(eq(tickets.sectionId, sectionId));
    return c;
  };
  let techs = await db.select().from(users).where(eq(users.role, "technician"));
  if (technicianName) {
    techs = techs.filter((t2) => (t2.name || "").toLowerCase().includes(technicianName));
  }
  const results = [];
  for (const tech of techs) {
    const baseCond = [eq(tickets.assignedToId, tech.id), ...siteSecCond()];
    const dateFilteredCond = withDateFilter(baseCond, tickets.createdAt);
    const [totalAssigned] = await db.select({ cnt: count() }).from(tickets).where(and(...dateFilteredCond));
    const [completed] = await db.select({ cnt: count() }).from(tickets).where(
      and(...dateFilteredCond, or(eq(tickets.status, "repaired"), eq(tickets.status, "verified"), eq(tickets.status, "closed")))
    );
    const [inProgress] = await db.select({ cnt: count() }).from(tickets).where(
      and(...dateFilteredCond, eq(tickets.status, "in_progress"))
    );
    const closedCond = withDateFilter([eq(tickets.assignedToId, tech.id), eq(tickets.status, "closed"), ...siteSecCond()], tickets.closedAt);
    const closedTickets = await db.select({
      id: tickets.id,
      createdAt: tickets.createdAt,
      closedAt: tickets.closedAt,
      priority: tickets.priority,
      category: tickets.category
    }).from(tickets).where(and(...closedCond));
    let totalHours = 0;
    let resolvedCount = 0;
    const resolutionTimes = [];
    for (const t2 of closedTickets) {
      if (t2.closedAt && t2.createdAt) {
        const hours = (new Date(t2.closedAt).getTime() - new Date(t2.createdAt).getTime()) / (1e3 * 60 * 60);
        totalHours += hours;
        resolvedCount++;
        resolutionTimes.push(hours);
      }
    }
    const avgResolutionHours = resolvedCount > 0 ? totalHours / resolvedCount : 0;
    const minResolutionHours = resolutionTimes.length > 0 ? Math.min(...resolutionTimes) : 0;
    const maxResolutionHours = resolutionTimes.length > 0 ? Math.max(...resolutionTimes) : 0;
    const priorityBreakdown = {};
    const allTechTickets = await db.select({ priority: tickets.priority, category: tickets.category }).from(tickets).where(and(...dateFilteredCond));
    allTechTickets.forEach((t2) => {
      priorityBreakdown[t2.priority] = (priorityBreakdown[t2.priority] || 0) + 1;
    });
    const catBreak = {};
    allTechTickets.forEach((t2) => {
      catBreak[t2.category] = (catBreak[t2.category] || 0) + 1;
    });
    const monthlyTrend = [];
    const trendMonths = 6;
    for (let i = trendMonths - 1; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const [assigned] = await db.select({ cnt: count() }).from(tickets).where(
        and(eq(tickets.assignedToId, tech.id), gte(tickets.createdAt, monthStart), lte(tickets.createdAt, monthEnd), ...siteSecCond())
      );
      const [comp] = await db.select({ cnt: count() }).from(tickets).where(
        and(eq(tickets.assignedToId, tech.id), eq(tickets.status, "closed"), gte(tickets.closedAt, monthStart), lte(tickets.closedAt, monthEnd), ...siteSecCond())
      );
      monthlyTrend.push({ month: monthStr, assigned: assigned?.cnt || 0, completed: comp?.cnt || 0 });
    }
    const totalAssignedCount = totalAssigned?.cnt || 0;
    const completedCount = completed?.cnt || 0;
    const completionRate = totalAssignedCount > 0 ? Math.round(completedCount / totalAssignedCount * 100) : 0;
    let score = 0;
    if (totalAssignedCount > 0) {
      const rateScore = completionRate * 0.4;
      const speedScore = avgResolutionHours > 0 ? Math.max(0, (1 - avgResolutionHours / (30 * 24)) * 100) * 0.3 : 0;
      const volumeScore = Math.min(100, totalAssignedCount * 5) * 0.3;
      score = Math.round(rateScore + speedScore + volumeScore);
    }
    results.push({
      technician: { id: tech.id, name: tech.name, email: tech.email, phone: tech.phone, department: tech.department },
      totalAssigned: totalAssignedCount,
      completed: completedCount,
      inProgress: inProgress?.cnt || 0,
      pending: totalAssignedCount - completedCount - (inProgress?.cnt || 0),
      completionRate,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      minResolutionHours: Math.round(minResolutionHours * 10) / 10,
      maxResolutionHours: Math.round(maxResolutionHours * 10) / 10,
      priorityBreakdown,
      categoryBreakdown: catBreak,
      monthlyTrend,
      performanceScore: score
    });
  }
  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}
async function getExternalTechnicianPerformance(filters) {
  const db = await getDb();
  if (!db) return [];
  const dateFrom = filters?.dateFrom;
  const dateTo = filters?.dateTo;
  const withDateFilter = (baseConditions, dateField) => {
    const conds = [...baseConditions];
    if (dateFrom) conds.push(gte(dateField, dateFrom));
    if (dateTo) conds.push(lte(dateField, dateTo));
    return conds;
  };
  const techs = await db.select().from(technicians);
  const results = [];
  for (const tech of techs) {
    const baseCond = [eq(tickets.assignedTechnicianId, tech.id)];
    const dateFilteredCond = withDateFilter(baseCond, tickets.createdAt);
    const [totalAssigned] = await db.select({ cnt: count() }).from(tickets).where(and(...dateFilteredCond));
    const [completed] = await db.select({ cnt: count() }).from(tickets).where(
      and(...dateFilteredCond, or(eq(tickets.status, "repaired"), eq(tickets.status, "verified"), eq(tickets.status, "closed")))
    );
    const [inProgress] = await db.select({ cnt: count() }).from(tickets).where(
      and(...dateFilteredCond, eq(tickets.status, "in_progress"))
    );
    const closedCond = withDateFilter([eq(tickets.assignedTechnicianId, tech.id), eq(tickets.status, "closed")], tickets.closedAt);
    const closedTickets = await db.select({
      id: tickets.id,
      assignedAt: tickets.assignedAt,
      closedAt: tickets.closedAt,
      priority: tickets.priority,
      category: tickets.category
    }).from(tickets).where(and(...closedCond));
    let totalHours = 0;
    let resolvedCount = 0;
    const resolutionTimes = [];
    for (const t2 of closedTickets) {
      if (t2.closedAt && t2.assignedAt) {
        const hours = (new Date(t2.closedAt).getTime() - new Date(t2.assignedAt).getTime()) / (1e3 * 60 * 60);
        totalHours += hours;
        resolvedCount++;
        resolutionTimes.push(hours);
      }
    }
    const avgResolutionHours = resolvedCount > 0 ? totalHours / resolvedCount : 0;
    const minResolutionHours = resolutionTimes.length > 0 ? Math.min(...resolutionTimes) : 0;
    const maxResolutionHours = resolutionTimes.length > 0 ? Math.max(...resolutionTimes) : 0;
    const allTechTickets = await db.select({ priority: tickets.priority, category: tickets.category }).from(tickets).where(and(...dateFilteredCond));
    const priorityBreakdown = {};
    allTechTickets.forEach((t2) => {
      priorityBreakdown[t2.priority] = (priorityBreakdown[t2.priority] || 0) + 1;
    });
    const catBreak = {};
    allTechTickets.forEach((t2) => {
      catBreak[t2.category] = (catBreak[t2.category] || 0) + 1;
    });
    const totalAssignedCount = totalAssigned?.cnt || 0;
    const completedCount = completed?.cnt || 0;
    const completionRate = totalAssignedCount > 0 ? Math.round(completedCount / totalAssignedCount * 100) : 0;
    let score = 0;
    if (totalAssignedCount > 0) {
      const rateScore = completionRate * 0.4;
      const speedScore = avgResolutionHours > 0 ? Math.max(0, (1 - avgResolutionHours / (30 * 24)) * 100) * 0.3 : 0;
      const volumeScore = Math.min(100, totalAssignedCount * 5) * 0.3;
      score = Math.round(rateScore + speedScore + volumeScore);
    }
    results.push({
      technician: { id: tech.id, name: tech.name, email: null, specialty: tech.specialty, status: tech.status, isExternal: true },
      totalAssigned: totalAssignedCount,
      completed: completedCount,
      inProgress: inProgress?.cnt || 0,
      pending: totalAssignedCount - completedCount - (inProgress?.cnt || 0),
      completionRate,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      minResolutionHours: Math.round(minResolutionHours * 10) / 10,
      maxResolutionHours: Math.round(maxResolutionHours * 10) / 10,
      priorityBreakdown,
      categoryBreakdown: catBreak,
      performanceScore: score
    });
  }
  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}
async function createAttachment(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(attachments).values(data);
  return result[0].insertId;
}
async function getAttachments(entityType, entityId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attachments).where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId))).orderBy(desc(attachments.createdAt));
}
async function getAttachmentById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return result[0] || null;
}
async function deleteAttachment(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(attachments).where(eq(attachments.id, id));
}
async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  const [openTickets] = await db.select({ cnt: count() }).from(tickets).where(ne(tickets.status, "closed"));
  const [closedToday] = await db.select({ cnt: count() }).from(tickets).where(and(eq(tickets.status, "closed"), gte(tickets.closedAt, sql`CURDATE()`)));
  const [criticalTickets] = await db.select({ cnt: count() }).from(tickets).where(and(eq(tickets.priority, "critical"), ne(tickets.status, "closed")));
  const [pendingPOs] = await db.select({ cnt: count() }).from(purchaseOrders).where(or(eq(purchaseOrders.status, "pending_accounting"), eq(purchaseOrders.status, "pending_management")));
  const [totalCostResult] = await db.select({ total: sum(purchaseOrderItems.actualTotalCost) }).from(purchaseOrderItems).where(or(eq(purchaseOrderItems.status, "delivered_to_warehouse"), eq(purchaseOrderItems.status, "delivered_to_requester")));
  const [pendingItems] = await db.select({ cnt: count() }).from(purchaseOrderItems).where(ne(purchaseOrderItems.status, "purchased"));
  const [purchasedItems] = await db.select({ cnt: count() }).from(purchaseOrderItems).where(eq(purchaseOrderItems.status, "purchased"));
  const [pendingTriageCount] = await db.select({ cnt: count() }).from(tickets).where(eq(tickets.status, "pending_triage"));
  const [underInspectionCount] = await db.select({ cnt: count() }).from(tickets).where(eq(tickets.status, "under_inspection"));
  const trend7 = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = sql`DATE_SUB(CURDATE(), INTERVAL ${i} DAY)`;
    const dayEnd = sql`DATE_SUB(CURDATE(), INTERVAL ${i - 1} DAY)`;
    const [row] = await db.select({ cnt: count() }).from(tickets).where(
      and(gte(tickets.createdAt, dayStart), lt(tickets.createdAt, dayEnd))
    );
    trend7.push(row?.cnt || 0);
  }
  const [slaBreaches] = await db.select({ cnt: count() }).from(tickets).where(
    and(ne(tickets.status, "closed"), lt(tickets.createdAt, sql`DATE_SUB(NOW(), INTERVAL 48 HOUR)`))
  );
  return {
    openTickets: openTickets?.cnt || 0,
    closedToday: closedToday?.cnt || 0,
    criticalTickets: criticalTickets?.cnt || 0,
    pendingApprovals: pendingPOs?.cnt || 0,
    totalMaintenanceCost: totalCostResult?.total || "0",
    pendingPurchaseItems: pendingItems?.cnt || 0,
    purchasedItems: purchasedItems?.cnt || 0,
    pendingTriage: pendingTriageCount?.cnt || 0,
    underInspection: underInspectionCount?.cnt || 0,
    trend7,
    slaBreaches: slaBreaches?.cnt || 0
  };
}
async function deleteTicket(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, id));
  await db.delete(attachments).where(and(eq(attachments.entityType, "ticket"), eq(attachments.entityId, id)));
  await db.delete(notifications).where(eq(notifications.relatedTicketId, id));
  await db.delete(tickets).where(eq(tickets.id, id));
}
async function deletePurchaseOrder(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
  await db.delete(attachments).where(and(eq(attachments.entityType, "purchase_order"), eq(attachments.entityId, id)));
  await db.delete(notifications).where(eq(notifications.relatedPOId, id));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
}
async function deletePOItem(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
}
async function deleteInventoryItem(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(inventoryTransactions).where(eq(inventoryTransactions.inventoryId, id));
  await db.delete(inventory).where(eq(inventory.id, id));
}
async function deleteSite(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sites).where(eq(sites.id, id));
}
async function updateSite(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(sites).set(data).where(eq(sites.id, id));
}
async function deleteUser(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.userId, id));
  await db.delete(users).where(eq(users.id, id));
}
async function updateUser(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}
async function toggleUserActive(id, isActive) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ isActive }).where(eq(users.id, id));
}
async function getSiteById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function getInventoryItemById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inventory).where(eq(inventory.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function getAuditLogsEnhanced(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters?.dateFrom) conditions.push(gte(auditLogs.createdAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(auditLogs.createdAt, filters.dateTo));
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  return db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(filters?.limit || 500);
}
async function createBackup(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(backups).values(data);
  return result[0].insertId;
}
async function getBackups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backups).orderBy(desc(backups.createdAt));
}
async function getBackupById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  return result[0] || null;
}
async function deleteBackup(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(backups).where(eq(backups.id, id));
}
async function exportAllTablesData() {
  const db = await getDb();
  if (!db) return null;
  const [
    usersData,
    sitesData,
    ticketsData,
    ticketHistoryData,
    posData,
    poItemsData,
    inventoryData,
    invTransData,
    notificationsData,
    auditData,
    attachmentsData
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(sites),
    db.select().from(tickets),
    db.select().from(ticketStatusHistory),
    db.select().from(purchaseOrders),
    db.select().from(purchaseOrderItems),
    db.select().from(inventory),
    db.select().from(inventoryTransactions),
    db.select().from(notifications),
    db.select().from(auditLogs),
    db.select().from(attachments)
  ]);
  const data = {
    users: usersData,
    sites: sitesData,
    tickets: ticketsData,
    ticket_status_history: ticketHistoryData,
    purchase_orders: posData,
    purchase_order_items: poItemsData,
    inventory: inventoryData,
    inventory_transactions: invTransData,
    notifications: notificationsData,
    audit_logs: auditData,
    attachments: attachmentsData
  };
  let totalRecords = 0;
  for (const table of Object.values(data)) {
    totalRecords += table.length;
  }
  return { data, tablesCount: Object.keys(data).length, recordsCount: totalRecords };
}
async function restoreFromBackup(backupData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(inventoryTransactions);
  await db.delete(attachments);
  await db.delete(ticketStatusHistory);
  await db.delete(notifications);
  await db.delete(auditLogs);
  await db.delete(purchaseOrderItems);
  await db.delete(purchaseOrders);
  await db.delete(inventory);
  await db.delete(tickets);
  await db.delete(sites);
  if (backupData.sites?.length) await db.insert(sites).values(backupData.sites);
  if (backupData.tickets?.length) await db.insert(tickets).values(backupData.tickets);
  if (backupData.ticket_status_history?.length) await db.insert(ticketStatusHistory).values(backupData.ticket_status_history);
  if (backupData.purchase_orders?.length) await db.insert(purchaseOrders).values(backupData.purchase_orders);
  if (backupData.purchase_order_items?.length) await db.insert(purchaseOrderItems).values(backupData.purchase_order_items);
  if (backupData.inventory?.length) await db.insert(inventory).values(backupData.inventory);
  if (backupData.inventory_transactions?.length) await db.insert(inventoryTransactions).values(backupData.inventory_transactions);
  if (backupData.notifications?.length) await db.insert(notifications).values(backupData.notifications);
  if (backupData.audit_logs?.length) await db.insert(auditLogs).values(backupData.audit_logs);
  if (backupData.attachments?.length) await db.insert(attachments).values(backupData.attachments);
  return { success: true };
}
async function listAssets(filters) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(assets);
  const conditions = [];
  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.sectionId) conditions.push(eq(assets.sectionId, filters.sectionId));
  if (filters?.status) conditions.push(eq(assets.status, filters.status));
  if (filters?.search) conditions.push(or(
    like(assets.name, `%${filters.search}%`),
    like(assets.assetNumber, `%${filters.search}%`),
    like(assets.serialNumber, `%${filters.search}%`)
  ));
  if (conditions.length > 0) return await query.where(and(...conditions)).orderBy(desc(assets.createdAt));
  return await query.orderBy(desc(assets.createdAt));
}
async function getAssetById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return rows[0] ?? null;
}
async function createAsset(data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(assets).values(data);
  const id = result[0]?.insertId ?? null;
  if (!id) return { id };
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return rows[0] ?? { id };
}
async function updateAsset(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(assets).set(data).where(eq(assets.id, id));
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return rows[0] ?? { success: true };
}
async function deleteAsset(id) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(assets).where(eq(assets.id, id));
  return { success: true };
}
async function generateAssetNumber() {
  const db = await getDb();
  if (!db) return `AST-${Date.now()}`;
  const rows = await db.select({ cnt: count() }).from(assets);
  const n = (rows[0]?.cnt ?? 0) + 1;
  return `AST-${String(n).padStart(5, "0")}`;
}
async function listPreventivePlans(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.assetId) conditions.push(eq(preventivePlans.assetId, filters.assetId));
  if (filters?.siteId) conditions.push(eq(preventivePlans.siteId, filters.siteId));
  if (filters?.isActive !== void 0) conditions.push(eq(preventivePlans.isActive, filters.isActive));
  let query = db.select().from(preventivePlans);
  if (conditions.length > 0) return await query.where(and(...conditions)).orderBy(desc(preventivePlans.createdAt));
  return await query.orderBy(desc(preventivePlans.createdAt));
}
async function getPreventivePlanById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(preventivePlans).where(eq(preventivePlans.id, id)).limit(1);
  return rows[0] ?? null;
}
async function createPreventivePlan(data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(preventivePlans).values(data);
  const id = result[0]?.insertId ?? null;
  return { id };
}
async function updatePreventivePlan(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(preventivePlans).set(data).where(eq(preventivePlans.id, id));
  return { success: true };
}
async function deletePreventivePlan(id) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(preventivePlans).where(eq(preventivePlans.id, id));
  return { success: true };
}
async function generatePlanNumber() {
  const db = await getDb();
  if (!db) return `PM-${Date.now()}`;
  const rows = await db.select({ cnt: count() }).from(preventivePlans);
  const n = (rows[0]?.cnt ?? 0) + 1;
  return `PM-${String(n).padStart(5, "0")}`;
}
async function listPMWorkOrders(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.planId) conditions.push(eq(pmWorkOrders.planId, filters.planId));
  if (filters?.assetId) conditions.push(eq(pmWorkOrders.assetId, filters.assetId));
  if (filters?.status) conditions.push(eq(pmWorkOrders.status, filters.status));
  if (filters?.assignedToId) conditions.push(eq(pmWorkOrders.assignedToId, filters.assignedToId));
  let query = db.select().from(pmWorkOrders);
  const rows = conditions.length > 0 ? await query.where(and(...conditions)).orderBy(desc(pmWorkOrders.scheduledDate)) : await query.orderBy(desc(pmWorkOrders.scheduledDate));
  return rows.map((r) => ({ ...r, checklistResults: Array.isArray(r.checklistResults) ? r.checklistResults : [] }));
}
async function getPMWorkOrderById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pmWorkOrders).where(eq(pmWorkOrders.id, id)).limit(1);
  const r = rows[0] ?? null;
  if (!r) return null;
  return { ...r, checklistResults: Array.isArray(r.checklistResults) ? r.checklistResults : [] };
}
async function createPMWorkOrder(data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(pmWorkOrders).values(data);
  const id = result[0]?.insertId ?? null;
  return { id };
}
async function updatePMWorkOrder(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(pmWorkOrders).set(data).where(eq(pmWorkOrders.id, id));
  return { success: true };
}
async function generateWorkOrderNumber() {
  const db = await getDb();
  if (!db) return `WO-${Date.now()}`;
  const rows = await db.select({ cnt: count() }).from(pmWorkOrders);
  const n = (rows[0]?.cnt ?? 0) + 1;
  return `WO-${String(n).padStart(5, "0")}`;
}
function calcNextDueDate(from, frequency, frequencyValue = 1) {
  const d = new Date(from);
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + frequencyValue);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * frequencyValue);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + frequencyValue);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3 * frequencyValue);
      break;
    case "biannual":
      d.setMonth(d.getMonth() + 6 * frequencyValue);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + frequencyValue);
      break;
  }
  return d;
}
async function getAssetByRfidTag(rfidTag) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(assets).where(eq(assets.rfidTag, rfidTag)).limit(1);
  return rows[0] ?? null;
}
async function updateAssetRfidTag(assetId, rfidTag) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (rfidTag && rfidTag.trim()) {
    const existing = await db.select().from(assets).where(eq(assets.rfidTag, rfidTag)).limit(1);
    if (existing.length > 0 && existing[0].id !== assetId) {
      throw new Error("RFID tag already assigned to another asset");
    }
  }
  await db.update(assets).set({ rfidTag: rfidTag || null }).where(eq(assets.id, assetId));
  return { success: true };
}
async function getAssetMaintenanceHistory(assetId) {
  const db = await getDb();
  if (!db) return { tickets: [], pmPlans: [], workOrders: [] };
  const assetTickets = await db.select().from(tickets).where(eq(tickets.assetId, assetId)).orderBy(desc(tickets.createdAt));
  const assetPlans = await db.select().from(preventivePlans).where(eq(preventivePlans.assetId, assetId)).orderBy(desc(preventivePlans.createdAt));
  const assetWorkOrders = await db.select().from(pmWorkOrders).where(eq(pmWorkOrders.assetId, assetId)).orderBy(desc(pmWorkOrders.scheduledDate));
  return {
    tickets: assetTickets,
    pmPlans: assetPlans,
    workOrders: assetWorkOrders
  };
}
async function getAssetMaintenanceStats(assetId) {
  const db = await getDb();
  if (!db) return null;
  const [ticketRows, planRows, woRows] = await Promise.all([
    db.select({ cnt: count() }).from(tickets).where(eq(tickets.assetId, assetId)),
    db.select({ cnt: count() }).from(preventivePlans).where(eq(preventivePlans.assetId, assetId)),
    db.select({ cnt: count() }).from(pmWorkOrders).where(eq(pmWorkOrders.assetId, assetId))
  ]);
  const openTickets = await db.select({ cnt: count() }).from(tickets).where(and(eq(tickets.assetId, assetId), notInArray(tickets.status, ["closed", "rejected"])));
  const completedWOs = await db.select({ cnt: count() }).from(pmWorkOrders).where(and(eq(pmWorkOrders.assetId, assetId), eq(pmWorkOrders.status, "completed")));
  return {
    totalTickets: ticketRows[0]?.cnt ?? 0,
    openTickets: openTickets[0]?.cnt ?? 0,
    totalPMPlans: planRows[0]?.cnt ?? 0,
    totalWorkOrders: woRows[0]?.cnt ?? 0,
    completedWorkOrders: completedWOs[0]?.cnt ?? 0
  };
}
async function addAssetSparePart(data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(assetSpareParts).values(data);
  const id = result[0]?.insertId ?? null;
  return { id };
}
async function getAssetSpareParts(assetId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: assetSpareParts.id,
    assetId: assetSpareParts.assetId,
    inventoryItemId: assetSpareParts.inventoryItemId,
    minStockLevel: assetSpareParts.minStockLevel,
    preferredQuantity: assetSpareParts.preferredQuantity,
    notes: assetSpareParts.notes,
    item: {
      id: inventory.id,
      itemName: inventory.itemName,
      quantity: inventory.quantity,
      minQuantity: inventory.minQuantity
    }
  }).from(assetSpareParts).innerJoin(inventory, eq(assetSpareParts.inventoryItemId, inventory.id)).where(eq(assetSpareParts.assetId, assetId));
}
async function removeAssetSparePart(id) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(assetSpareParts).where(eq(assetSpareParts.id, id));
  return { success: true };
}
async function getOrCreateAssetMetrics(assetId) {
  const db = await getDb();
  if (!db) return null;
  let metrics = await db.select().from(assetMetrics).where(eq(assetMetrics.assetId, assetId)).limit(1);
  if (metrics.length === 0) {
    await db.insert(assetMetrics).values({ assetId });
    metrics = await db.select().from(assetMetrics).where(eq(assetMetrics.assetId, assetId)).limit(1);
  }
  return metrics[0] ?? null;
}
async function calculateAssetMetrics(assetId) {
  const db = await getDb();
  if (!db) return null;
  const assetTickets = await db.select().from(tickets).where(eq(tickets.assetId, assetId));
  const totalTickets = assetTickets.length;
  const closedTickets = assetTickets.filter((t2) => t2.status === "closed").length;
  let totalRepairTime = 0;
  let repairCount = 0;
  for (const ticket of assetTickets) {
    if (ticket.closedAt && ticket.createdAt) {
      const repairTime = (new Date(ticket.closedAt).getTime() - new Date(ticket.createdAt).getTime()) / (1e3 * 60 * 60);
      totalRepairTime += repairTime;
      repairCount++;
    }
  }
  const mttr = repairCount > 0 ? totalRepairTime / repairCount : 0;
  let mtbf = 0;
  if (closedTickets > 1) {
    const sortedTickets = assetTickets.filter((t2) => t2.status === "closed").sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());
    let totalTimeBetweenFailures = 0;
    for (let i = 1; i < sortedTickets.length; i++) {
      const prevClosedAt = sortedTickets[i - 1].closedAt;
      const closedTime = prevClosedAt ? new Date(prevClosedAt).getTime() : new Date(sortedTickets[i - 1].createdAt).getTime();
      const timeBetween = (new Date(sortedTickets[i].createdAt).getTime() - closedTime) / (1e3 * 60 * 60);
      totalTimeBetweenFailures += timeBetween;
    }
    mtbf = totalTimeBetweenFailures / (sortedTickets.length - 1);
  }
  const totalDowntime = assetTickets.reduce((sum2, t2) => {
    if (t2.closedAt && t2.createdAt) {
      return sum2 + (new Date(t2.closedAt).getTime() - new Date(t2.createdAt).getTime());
    }
    return sum2;
  }, 0);
  const availability = 100 - totalDowntime / (90 * 24 * 60 * 60 * 1e3) * 100;
  const lastFailure = assetTickets.filter((t2) => t2.status === "closed").sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())[0];
  const metrics = await getOrCreateAssetMetrics(assetId);
  if (metrics) {
    await db.update(assetMetrics).set({
      totalTickets,
      closedTickets,
      totalDowntime: Math.floor(totalDowntime / (1e3 * 60)),
      mttr: String(Math.round(mttr * 100) / 100),
      mtbf: String(Math.round(mtbf * 100) / 100),
      availability: String(Math.max(0, Math.min(100, Math.round(availability * 100) / 100))),
      lastFailureDate: lastFailure?.closedAt,
      lastRepairDate: lastFailure?.closedAt
    }).where(eq(assetMetrics.assetId, assetId));
  }
  return metrics;
}
async function getAssetMetricsById(assetId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(assetMetrics).where(eq(assetMetrics.assetId, assetId)).limit(1);
  return rows[0] ?? null;
}
async function getAllAssetMetrics() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assetMetrics).orderBy(desc(assetMetrics.mttr));
}
async function getLowStockItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: inventory.id,
    itemName: inventory.itemName,
    quantity: inventory.quantity,
    minQuantity: inventory.minQuantity,
    unit: inventory.unit,
    location: inventory.location,
    siteId: inventory.siteId
  }).from(inventory).where(lte(inventory.quantity, inventory.minQuantity));
}
async function getAssetSparePartsWithLowStock(assetId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    assetId: assetSpareParts.assetId,
    minStockLevel: assetSpareParts.minStockLevel,
    preferredQuantity: assetSpareParts.preferredQuantity,
    item: {
      id: inventory.id,
      itemName: inventory.itemName,
      quantity: inventory.quantity,
      minQuantity: inventory.minQuantity
    }
  }).from(assetSpareParts).innerJoin(inventory, eq(assetSpareParts.inventoryItemId, inventory.id)).where(and(
    eq(assetSpareParts.assetId, assetId),
    lte(inventory.quantity, assetSpareParts.minStockLevel)
  ));
}
async function getInventoryAlerts() {
  const db = await getDb();
  if (!db) return [];
  const lowStockItems = await getLowStockItems();
  return lowStockItems.map((item) => ({
    id: item.id,
    type: "low_stock",
    itemName: item.itemName,
    currentQuantity: item.quantity,
    minimumQuantity: item.minQuantity,
    unit: item.unit,
    location: item.location,
    siteId: item.siteId,
    severity: item.quantity === 0 ? "critical" : item.quantity <= item.minQuantity / 2 ? "high" : "medium",
    message: item.quantity === 0 ? `${item.itemName} is out of stock` : `${item.itemName} is below minimum level (${item.quantity}/${item.minQuantity} ${item.unit})`
  }));
}
async function getTwoFactorSecret(userId) {
  try {
    const database = await getDb();
    if (!database) return null;
    const result = await database.select().from(twoFactorSecrets).where(eq(twoFactorSecrets.userId, userId)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Error getting 2FA secret:", error);
    throw error;
  }
}
async function savePushSubscription(data) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint)).limit(1);
  if (existing.length > 0) {
    await db.update(pushSubscriptions).set({ userId: data.userId, p256dh: data.p256dh, auth: data.auth }).where(eq(pushSubscriptions.endpoint, data.endpoint));
    return existing[0].id;
  }
  const result = await db.insert(pushSubscriptions).values(data);
  return result[0].insertId;
}
async function deletePushSubscription(endpoint) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
async function getPushSubscriptionsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}
async function getAllPushSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions);
}
async function getAllPOItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).orderBy(desc(purchaseOrderItems.createdAt));
}
var _db, _webPush;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
    _webPush = null;
  }
});

// shared/_core/errors.ts
var HttpError, ForbiddenError;
var init_errors = __esm({
  "shared/_core/errors.ts"() {
    "use strict";
    HttpError = class extends Error {
      constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
      }
      statusCode;
    };
    ForbiddenError = (msg) => new HttpError(403, msg);
  }
});

// server/_core/sdk.ts
var sdk_exports = {};
__export(sdk_exports, {
  sdk: () => sdk
});
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString, EXCHANGE_TOKEN_PATH, GET_USER_INFO_PATH, GET_USER_INFO_WITH_JWT_PATH, OAuthService, createOAuthHttpClient, SDKServer, sdk;
var init_sdk = __esm({
  "server/_core/sdk.ts"() {
    "use strict";
    init_const();
    init_errors();
    init_db();
    init_env();
    isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
    EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
    GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
    GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
    OAuthService = class {
      constructor(client) {
        this.client = client;
        console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
        if (!ENV.oAuthServerUrl) {
          console.error(
            "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
          );
        }
      }
      client;
      decodeState(state) {
        const redirectUri = atob(state);
        return redirectUri;
      }
      async getTokenByCode(code, state) {
        const payload = {
          clientId: ENV.appId,
          grantType: "authorization_code",
          code,
          redirectUri: this.decodeState(state)
        };
        const { data } = await this.client.post(
          EXCHANGE_TOKEN_PATH,
          payload
        );
        return data;
      }
      async getUserInfoByToken(token) {
        const { data } = await this.client.post(
          GET_USER_INFO_PATH,
          {
            accessToken: token.accessToken
          }
        );
        return data;
      }
    };
    createOAuthHttpClient = () => axios.create({
      baseURL: ENV.oAuthServerUrl,
      timeout: AXIOS_TIMEOUT_MS
    });
    SDKServer = class {
      client;
      oauthService;
      constructor(client = createOAuthHttpClient()) {
        this.client = client;
        this.oauthService = new OAuthService(this.client);
      }
      deriveLoginMethod(platforms, fallback) {
        if (fallback && fallback.length > 0) return fallback;
        if (!Array.isArray(platforms) || platforms.length === 0) return null;
        const set = new Set(
          platforms.filter((p) => typeof p === "string")
        );
        if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
        if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
        if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
        if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
          return "microsoft";
        if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
        const first = Array.from(set)[0];
        return first ? first.toLowerCase() : null;
      }
      /**
       * Exchange OAuth authorization code for access token
       * @example
       * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
       */
      async exchangeCodeForToken(code, state) {
        return this.oauthService.getTokenByCode(code, state);
      }
      /**
       * Get user information using access token
       * @example
       * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
       */
      async getUserInfo(accessToken) {
        const data = await this.oauthService.getUserInfoByToken({
          accessToken
        });
        const loginMethod = this.deriveLoginMethod(
          data?.platforms,
          data?.platform ?? data.platform ?? null
        );
        return {
          ...data,
          platform: loginMethod,
          loginMethod
        };
      }
      parseCookies(cookieHeader) {
        if (!cookieHeader) {
          return /* @__PURE__ */ new Map();
        }
        const parsed = parseCookieHeader(cookieHeader);
        return new Map(Object.entries(parsed));
      }
      getSessionSecret() {
        const secret = ENV.cookieSecret;
        return new TextEncoder().encode(secret);
      }
      /**
       * Create a session token for a Manus user openId
       * @example
       * const sessionToken = await sdk.createSessionToken(userInfo.openId);
       */
      async createSessionToken(openId, options = {}) {
        return this.signSession(
          {
            openId,
            appId: ENV.appId,
            name: options.name || ""
          },
          options
        );
      }
      async signSession(payload, options = {}) {
        const issuedAt = Date.now();
        const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
        const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
        const secretKey = this.getSessionSecret();
        return new SignJWT({
          openId: payload.openId,
          appId: payload.appId,
          name: payload.name
        }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
      }
      async verifySession(cookieValue) {
        if (!cookieValue) {
          console.warn("[Auth] Missing session cookie");
          return null;
        }
        try {
          const secretKey = this.getSessionSecret();
          const { payload } = await jwtVerify(cookieValue, secretKey, {
            algorithms: ["HS256"]
          });
          const { openId, appId, name } = payload;
          if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
            console.warn("[Auth] Session payload missing required fields");
            return null;
          }
          return {
            openId,
            appId,
            name
          };
        } catch (error) {
          console.warn("[Auth] Session verification failed", String(error));
          return null;
        }
      }
      async getUserInfoWithJwt(jwtToken) {
        const payload = {
          jwtToken,
          projectId: ENV.appId
        };
        const { data } = await this.client.post(
          GET_USER_INFO_WITH_JWT_PATH,
          payload
        );
        const loginMethod = this.deriveLoginMethod(
          data?.platforms,
          data?.platform ?? data.platform ?? null
        );
        return {
          ...data,
          platform: loginMethod,
          loginMethod
        };
      }
      async authenticateRequest(req) {
        const cookies = this.parseCookies(req.headers.cookie);
        const sessionCookie = cookies.get(COOKIE_NAME);
        const session = await this.verifySession(sessionCookie);
        if (!session) {
          throw ForbiddenError("Invalid session cookie");
        }
        const sessionUserId = session.openId;
        const signedInAt = /* @__PURE__ */ new Date();
        let user = await getUserByOpenId(sessionUserId);
        if (!user) {
          try {
            const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
            await upsertUser({
              openId: userInfo.openId,
              name: userInfo.name || null,
              email: userInfo.email ?? null,
              loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
              lastSignedIn: signedInAt
            });
            user = await getUserByOpenId(userInfo.openId);
          } catch (error) {
            console.error("[Auth] Failed to sync user from OAuth:", error);
            throw ForbiddenError("Failed to sync user info");
          }
        }
        if (!user) {
          throw ForbiddenError("User not found");
        }
        await upsertUser({
          openId: user.openId,
          lastSignedIn: signedInAt
        });
        return user;
      }
    };
    sdk = new SDKServer();
  }
});

// server/_core/twoFactorEnforcement.ts
var twoFactorEnforcement_exports = {};
__export(twoFactorEnforcement_exports, {
  GRACE_PERIOD_MS: () => GRACE_PERIOD_MS,
  MANDATORY_2FA_ROLES: () => MANDATORY_2FA_ROLES,
  enforceTwoFactor: () => enforceTwoFactor,
  getTwoFactorEnforcementMessage: () => getTwoFactorEnforcementMessage,
  getTwoFactorEnforcementStatus: () => getTwoFactorEnforcementStatus,
  isWithinGracePeriod: () => isWithinGracePeriod,
  needsTwoFactorSetup: () => needsTwoFactorSetup,
  requiresTwoFactor: () => requiresTwoFactor
});
import { TRPCError as TRPCError4 } from "@trpc/server";
function requiresTwoFactor(role) {
  return MANDATORY_2FA_ROLES.includes(role);
}
function isWithinGracePeriod(user) {
  if (!requiresTwoFactor(user.role)) {
    return false;
  }
  const createdAt = new Date(user.createdAt).getTime();
  const now = Date.now();
  const timeSinceCreation = now - createdAt;
  return timeSinceCreation < GRACE_PERIOD_MS;
}
function needsTwoFactorSetup(user, twoFactorEnabled) {
  if (!requiresTwoFactor(user.role)) {
    return false;
  }
  if (twoFactorEnabled) {
    return false;
  }
  return true;
}
function getTwoFactorEnforcementStatus(user, twoFactorEnabled) {
  const required = requiresTwoFactor(user.role);
  const withinGracePeriod = isWithinGracePeriod(user);
  const createdAt = new Date(user.createdAt).getTime();
  const now = Date.now();
  const timeSinceCreation = now - createdAt;
  const timeUntilEnforcement = Math.max(0, GRACE_PERIOD_MS - timeSinceCreation);
  const daysUntilEnforcement = Math.ceil(timeUntilEnforcement / (24 * 60 * 60 * 1e3));
  return {
    required,
    enabled: twoFactorEnabled,
    withinGracePeriod,
    daysUntilEnforcement,
    isEnforced: required && !withinGracePeriod && !twoFactorEnabled
  };
}
function enforceTwoFactor(user, twoFactorEnabled) {
  const status = getTwoFactorEnforcementStatus(user, twoFactorEnabled);
  if (status.isEnforced) {
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: `Two-Factor Authentication is mandatory for ${user.role} accounts. Please enable 2FA to continue.`
    });
  }
}
function getTwoFactorEnforcementMessage(status) {
  if (!status.required) {
    return null;
  }
  if (status.enabled) {
    return null;
  }
  if (status.withinGracePeriod) {
    return `\u23F0 Grace Period: You have ${status.daysUntilEnforcement} days to enable Two-Factor Authentication before it becomes mandatory.`;
  }
  return "\u{1F512} Two-Factor Authentication is now mandatory for your role. Please enable it immediately.";
}
var MANDATORY_2FA_ROLES, GRACE_PERIOD_MS;
var init_twoFactorEnforcement = __esm({
  "server/_core/twoFactorEnforcement.ts"() {
    "use strict";
    MANDATORY_2FA_ROLES = ["admin", "maintenance_manager", "supervisor", "senior_management", "purchase_manager"];
    GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1e3;
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
init_const();
init_db();

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
var PUBLIC_SUFFIXES = [
  "railway.app",
  "up.railway.app",
  "vercel.app",
  "netlify.app",
  "onrender.com",
  "fly.dev",
  "herokuapp.com"
];
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function isLocalhost(hostname) {
  return LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
}
function isPublicSuffix(hostname) {
  return PUBLIC_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}
function getSessionCookieOptions(req) {
  const hostname = req.hostname;
  const isLocal = isLocalhost(hostname);
  const isSecure = isSecureRequest(req);
  const sameSite = isLocal ? "none" : "strict";
  let domain = void 0;
  if (!isLocal && !isPublicSuffix(hostname) && hostname && !hostname.startsWith(".")) {
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      domain = `.${parts.slice(-2).join(".")}`;
    }
  }
  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure: isSecure,
    ...domain ? { domain } : {}
  };
}

// server/_core/oauth.ts
init_sdk();
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/routers.ts
init_const();

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
init_const();
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_db();
import { TRPCError as TRPCError5 } from "@trpc/server";
import { z as z3 } from "zod";
import { eq as eq3, and as and3, asc as asc2, gte as gte2 } from "drizzle-orm";

// server/storage.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var S3_ENDPOINT = process.env.S3_ENDPOINT || "https://s3.eu-central-1.idrivee2.com";
var S3_REGION = process.env.S3_REGION || "eu-central-1";
var S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "";
var S3_SECRET_KEY = process.env.S3_SECRET_KEY || "";
var S3_BUCKET = process.env.S3_BUCKET || "cmms-uploads";
var s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY
  },
  forcePathStyle: true
});
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read"
    })
  );
  const url = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  return { key, url };
}
async function storageGetStream(relKey) {
  const key = normalizeKey(relKey);
  const response = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  const stream = response.Body;
  const contentType = response.ContentType || "application/octet-stream";
  return { stream, contentType };
}
async function storageRename(oldRelKey, newRelKey) {
  const oldKey = normalizeKey(oldRelKey);
  const newKey = normalizeKey(newRelKey);
  await s3.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${oldKey}`,
      Key: newKey,
      ACL: "public-read"
    })
  );
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: oldKey
    })
  );
  const url = `${S3_ENDPOINT}/${S3_BUCKET}/${newKey}`;
  return { key: newKey, url };
}

// server/_core/llm.ts
init_env();
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/routers.ts
import { nanoid } from "nanoid";

// server/routers/translation.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/translationEngine.ts
init_schema();
import { eq as eq2, and as and2, desc as desc2, sql as sql2, inArray as inArray2 } from "drizzle-orm";
init_db();
import crypto from "crypto";
var ENTITY_FIELD_MAP = {
  TICKET: ["title", "description", "repairNotes", "materialsUsed"],
  PO: ["justification", "notes", "accountingNotes", "managementNotes", "rejectionReason"],
  PO_ITEM: ["itemName", "specifications", "notes"],
  INVENTORY: ["itemName", "description", "category"],
  SITE: ["name", "address", "description"],
  NOTIFICATION: ["title", "message"]
};
var TranslationCache = class {
  cache = /* @__PURE__ */ new Map();
  TTL = 30 * 60 * 1e3;
  // 30 minutes
  key(entityType, entityId, fieldName, lang) {
    return `${entityType}:${entityId}:${fieldName}:${lang}`;
  }
  get(entityType, entityId, fieldName, lang) {
    const k = this.key(entityType, entityId, fieldName, lang);
    const entry = this.cache.get(k);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(k);
      return null;
    }
    return entry.value;
  }
  set(entityType, entityId, fieldName, lang, value) {
    const k = this.key(entityType, entityId, fieldName, lang);
    this.cache.set(k, { value, expiresAt: Date.now() + this.TTL });
  }
  invalidate(entityType, entityId, fieldName) {
    const prefix = fieldName ? `${entityType}:${entityId}:${fieldName}:` : `${entityType}:${entityId}:`;
    const keys = Array.from(this.cache.keys());
    for (const k of keys) {
      if (k.startsWith(prefix)) this.cache.delete(k);
    }
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
};
var translationCache = new TranslationCache();
function textHash(text2) {
  return crypto.createHash("sha256").update(text2).digest("hex").slice(0, 16);
}
var LANGUAGE_NAMES = {
  ar: "Arabic",
  en: "English",
  ur: "Urdu"
};
async function translateWithLLM(sourceText, sourceLang, targetLang, context) {
  const systemPrompt = `You are a professional translator for a maintenance management system (CMMS). 
Translate the following text from ${LANGUAGE_NAMES[sourceLang]} to ${LANGUAGE_NAMES[targetLang]}.
Rules:
- Maintain technical terminology accuracy
- Preserve any numbers, codes, or references (like MT-2026-00001)
- Keep proper nouns unchanged
- Use formal/professional tone
- Return ONLY the translated text, no explanations
${context ? `Context: ${context}` : ""}`;
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: sourceText }
      ]
    });
    const translated = result.choices?.[0]?.message?.content;
    if (typeof translated === "string") return translated.trim();
    if (Array.isArray(translated)) {
      const textPart = translated.find((p) => p.type === "text");
      if (textPart && "text" in textPart) return textPart.text.trim();
    }
    throw new Error("No translation content in LLM response");
  } catch (error) {
    console.error(`[TranslationEngine] LLM translation failed: ${error.message}`);
    throw error;
  }
}
async function queueTranslation(request) {
  const db = await getDb();
  if (!db) return [];
  const targetLangs = request.targetLanguages || supportedLanguages.filter((l) => l !== request.sourceLanguage);
  const jobIds = [];
  for (const field of request.fields) {
    if (!field.text || field.text.trim() === "") continue;
    const hash = textHash(field.text);
    for (const targetLang of targetLangs) {
      const existing = await db.select().from(entityTranslations).where(
        and2(
          eq2(entityTranslations.entityType, request.entityType),
          eq2(entityTranslations.entityId, request.entityId),
          eq2(entityTranslations.fieldName, field.fieldName),
          eq2(entityTranslations.languageCode, targetLang)
        )
      ).limit(1);
      if (existing[0]?.translationStatus === "approved") {
        continue;
      }
      const existingJob = await db.select().from(translationJobs).where(
        and2(
          eq2(translationJobs.entityType, request.entityType),
          eq2(translationJobs.entityId, request.entityId),
          eq2(translationJobs.fieldName, field.fieldName),
          eq2(translationJobs.targetLanguage, targetLang),
          eq2(translationJobs.previousTextHash, hash),
          eq2(translationJobs.status, "completed")
        )
      ).limit(1);
      if (existingJob[0]) {
        continue;
      }
      const [jobResult] = await db.insert(translationJobs).values({
        entityType: request.entityType,
        entityId: request.entityId,
        fieldName: field.fieldName,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: targetLang,
        sourceText: field.text,
        status: "pending",
        previousTextHash: hash
      });
      const jobId = jobResult.insertId;
      jobIds.push(jobId);
      if (existing[0]) {
        await db.update(entityTranslations).set({
          translationStatus: "pending",
          translationJobId: jobId,
          errorMessage: null
        }).where(eq2(entityTranslations.id, existing[0].id));
      } else {
        await db.insert(entityTranslations).values({
          entityType: request.entityType,
          entityId: request.entityId,
          fieldName: field.fieldName,
          languageCode: targetLang,
          translationStatus: "pending",
          translationJobId: jobId,
          versionNumber: 1
        });
      }
    }
  }
  if (jobIds.length > 0) {
    processTranslationJobs(jobIds).catch(
      (err) => console.error("[TranslationEngine] Background job processing error:", err)
    );
  }
  return jobIds;
}
async function processTranslationJobs(jobIds) {
  const db = await getDb();
  if (!db) return;
  for (const jobId of jobIds) {
    try {
      const [job] = await db.select().from(translationJobs).where(eq2(translationJobs.id, jobId)).limit(1);
      if (!job || job.status !== "pending") continue;
      await db.update(translationJobs).set({ status: "processing" }).where(eq2(translationJobs.id, jobId));
      const translated = await translateWithLLM(
        job.sourceText,
        job.sourceLanguage,
        job.targetLanguage,
        `Entity: ${job.entityType}, Field: ${job.fieldName}`
      );
      await db.update(translationJobs).set({
        status: "completed",
        translatedText: translated,
        completedAt: /* @__PURE__ */ new Date()
      }).where(eq2(translationJobs.id, jobId));
      const [etRecord] = await db.select().from(entityTranslations).where(
        and2(
          eq2(entityTranslations.entityType, job.entityType),
          eq2(entityTranslations.entityId, job.entityId),
          eq2(entityTranslations.fieldName, job.fieldName),
          eq2(entityTranslations.languageCode, job.targetLanguage)
        )
      ).limit(1);
      if (etRecord) {
        const newVersion = etRecord.versionNumber + 1;
        await db.insert(translationVersions).values({
          entityTranslationId: etRecord.id,
          versionNumber: newVersion,
          translatedText: translated,
          translationStatus: "completed",
          changeReason: "auto_translate"
        });
        await db.update(entityTranslations).set({
          translatedText: translated,
          translationStatus: "completed",
          versionNumber: newVersion,
          lastAttemptAt: /* @__PURE__ */ new Date(),
          errorMessage: null,
          translationJobId: jobId
        }).where(eq2(entityTranslations.id, etRecord.id));
        translationCache.set(
          job.entityType,
          job.entityId,
          job.fieldName,
          job.targetLanguage,
          translated
        );
      }
    } catch (error) {
      const [job] = await db.select().from(translationJobs).where(eq2(translationJobs.id, jobId)).limit(1);
      if (!job) continue;
      const newRetryCount = job.retryCount + 1;
      const isFinalFailure = newRetryCount >= job.maxRetries;
      await db.update(translationJobs).set({
        status: isFinalFailure ? "failed" : "pending",
        retryCount: newRetryCount,
        errorMessage: error.message?.slice(0, 500)
      }).where(eq2(translationJobs.id, jobId));
      await db.update(entityTranslations).set({
        translationStatus: isFinalFailure ? "failed" : "pending",
        lastAttemptAt: /* @__PURE__ */ new Date(),
        errorMessage: error.message?.slice(0, 500)
      }).where(
        and2(
          eq2(entityTranslations.entityType, job.entityType),
          eq2(entityTranslations.entityId, job.entityId),
          eq2(entityTranslations.fieldName, job.fieldName),
          eq2(entityTranslations.languageCode, job.targetLanguage)
        )
      );
      if (!isFinalFailure) {
        setTimeout(() => {
          processTranslationJobs([jobId]).catch(console.error);
        }, 5e3 * newRetryCount);
      }
    }
  }
}
async function getEntityTranslations(entityType, entityId, languageCode, fieldNames) {
  const db = await getDb();
  const result = {};
  if (!db) return result;
  const fields = fieldNames || ENTITY_FIELD_MAP[entityType] || [];
  for (const fieldName of fields) {
    const cached = translationCache.get(entityType, entityId, fieldName, languageCode);
    if (cached) {
      result[fieldName] = { text: cached, status: "completed", isOriginal: false };
      continue;
    }
    const [record] = await db.select().from(entityTranslations).where(
      and2(
        eq2(entityTranslations.entityType, entityType),
        eq2(entityTranslations.entityId, entityId),
        eq2(entityTranslations.fieldName, fieldName),
        eq2(entityTranslations.languageCode, languageCode)
      )
    ).limit(1);
    if (record?.translatedText && (record.translationStatus === "completed" || record.translationStatus === "approved")) {
      translationCache.set(entityType, entityId, fieldName, languageCode, record.translatedText);
      result[fieldName] = {
        text: record.translatedText,
        status: record.translationStatus,
        isOriginal: false
      };
    } else {
      result[fieldName] = {
        text: null,
        status: record?.translationStatus || "not_found",
        isOriginal: true
      };
    }
  }
  return result;
}
async function getBatchTranslations(entityType, entityIds, languageCode, fieldNames) {
  const db = await getDb();
  const result = {};
  if (!db || entityIds.length === 0) return result;
  for (const id of entityIds) {
    result[id] = {};
  }
  const records = await db.select().from(entityTranslations).where(
    and2(
      eq2(entityTranslations.entityType, entityType),
      inArray2(entityTranslations.entityId, entityIds),
      eq2(entityTranslations.languageCode, languageCode)
    )
  );
  const fields = fieldNames || ENTITY_FIELD_MAP[entityType] || [];
  const recordMap = /* @__PURE__ */ new Map();
  for (const r of records) {
    recordMap.set(`${r.entityId}:${r.fieldName}`, r);
  }
  for (const id of entityIds) {
    for (const fieldName of fields) {
      const cached = translationCache.get(entityType, id, fieldName, languageCode);
      if (cached) {
        result[id][fieldName] = { text: cached, status: "completed", isOriginal: false };
        continue;
      }
      const record = recordMap.get(`${id}:${fieldName}`);
      if (record?.translatedText && (record.translationStatus === "completed" || record.translationStatus === "approved")) {
        translationCache.set(entityType, id, fieldName, languageCode, record.translatedText);
        result[id][fieldName] = { text: record.translatedText, status: record.translationStatus, isOriginal: false };
      } else {
        result[id][fieldName] = { text: null, status: record?.translationStatus || "not_found", isOriginal: true };
      }
    }
  }
  return result;
}
async function manualOverrideTranslation(entityType, entityId, fieldName, languageCode, translatedText, userId) {
  const db = await getDb();
  if (!db) return;
  const [existing] = await db.select().from(entityTranslations).where(
    and2(
      eq2(entityTranslations.entityType, entityType),
      eq2(entityTranslations.entityId, entityId),
      eq2(entityTranslations.fieldName, fieldName),
      eq2(entityTranslations.languageCode, languageCode)
    )
  ).limit(1);
  if (existing) {
    const newVersion = existing.versionNumber + 1;
    await db.insert(translationVersions).values({
      entityTranslationId: existing.id,
      versionNumber: newVersion,
      translatedText,
      translationStatus: "approved",
      changedById: userId,
      changeReason: "manual_edit"
    });
    await db.update(entityTranslations).set({
      translatedText,
      translationStatus: "approved",
      versionNumber: newVersion,
      approvedById: userId,
      approvedAt: /* @__PURE__ */ new Date(),
      errorMessage: null
    }).where(eq2(entityTranslations.id, existing.id));
  } else {
    const [insertResult] = await db.insert(entityTranslations).values({
      entityType,
      entityId,
      fieldName,
      languageCode,
      translatedText,
      translationStatus: "approved",
      versionNumber: 1,
      approvedById: userId,
      approvedAt: /* @__PURE__ */ new Date()
    });
    await db.insert(translationVersions).values({
      entityTranslationId: insertResult.insertId,
      versionNumber: 1,
      translatedText,
      translationStatus: "approved",
      changedById: userId,
      changeReason: "manual_edit"
    });
  }
  translationCache.set(entityType, entityId, fieldName, languageCode, translatedText);
  await db.insert(auditLogs).values({
    userId,
    action: "manual_translation_override",
    entityType: "TRANSLATION",
    entityId,
    newValues: JSON.stringify({ entityType, fieldName, languageCode, translatedText })
  });
}
async function getTranslationVersions(entityType, entityId, fieldName, languageCode) {
  const db = await getDb();
  if (!db) return [];
  const [etRecord] = await db.select().from(entityTranslations).where(
    and2(
      eq2(entityTranslations.entityType, entityType),
      eq2(entityTranslations.entityId, entityId),
      eq2(entityTranslations.fieldName, fieldName),
      eq2(entityTranslations.languageCode, languageCode)
    )
  ).limit(1);
  if (!etRecord) return [];
  return db.select().from(translationVersions).where(eq2(translationVersions.entityTranslationId, etRecord.id)).orderBy(desc2(translationVersions.versionNumber));
}
async function retryFailedJobs(entityType) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = [eq2(translationJobs.status, "failed")];
  if (entityType) conditions.push(eq2(translationJobs.entityType, entityType));
  const failedJobs = await db.select().from(translationJobs).where(and2(...conditions));
  const jobIds = [];
  for (const job of failedJobs) {
    await db.update(translationJobs).set({
      status: "pending",
      retryCount: 0,
      errorMessage: null
    }).where(eq2(translationJobs.id, job.id));
    await db.update(entityTranslations).set({
      translationStatus: "pending",
      errorMessage: null
    }).where(
      and2(
        eq2(entityTranslations.entityType, job.entityType),
        eq2(entityTranslations.entityId, job.entityId),
        eq2(entityTranslations.fieldName, job.fieldName),
        eq2(entityTranslations.languageCode, job.targetLanguage)
      )
    );
    jobIds.push(job.id);
  }
  if (jobIds.length > 0) {
    processTranslationJobs(jobIds).catch(console.error);
  }
  return jobIds.length;
}
async function getTranslationStats() {
  const db = await getDb();
  if (!db) return null;
  const [total] = await db.select({ cnt: sql2`count(*)` }).from(entityTranslations);
  const [pending] = await db.select({ cnt: sql2`count(*)` }).from(entityTranslations).where(eq2(entityTranslations.translationStatus, "pending"));
  const [processing] = await db.select({ cnt: sql2`count(*)` }).from(entityTranslations).where(eq2(entityTranslations.translationStatus, "processing"));
  const [completed] = await db.select({ cnt: sql2`count(*)` }).from(entityTranslations).where(eq2(entityTranslations.translationStatus, "completed"));
  const [failed] = await db.select({ cnt: sql2`count(*)` }).from(entityTranslations).where(eq2(entityTranslations.translationStatus, "failed"));
  const [approved] = await db.select({ cnt: sql2`count(*)` }).from(entityTranslations).where(eq2(entityTranslations.translationStatus, "approved"));
  const [jobsPending] = await db.select({ cnt: sql2`count(*)` }).from(translationJobs).where(eq2(translationJobs.status, "pending"));
  const [jobsProcessing] = await db.select({ cnt: sql2`count(*)` }).from(translationJobs).where(eq2(translationJobs.status, "processing"));
  const [jobsFailed] = await db.select({ cnt: sql2`count(*)` }).from(translationJobs).where(eq2(translationJobs.status, "failed"));
  const byEntity = await db.select({
    entityType: entityTranslations.entityType,
    cnt: sql2`count(*)`
  }).from(entityTranslations).groupBy(entityTranslations.entityType);
  const byLanguage = await db.select({
    languageCode: entityTranslations.languageCode,
    cnt: sql2`count(*)`
  }).from(entityTranslations).groupBy(entityTranslations.languageCode);
  return {
    translations: {
      total: total?.cnt || 0,
      pending: pending?.cnt || 0,
      processing: processing?.cnt || 0,
      completed: completed?.cnt || 0,
      failed: failed?.cnt || 0,
      approved: approved?.cnt || 0
    },
    jobs: {
      pending: jobsPending?.cnt || 0,
      processing: jobsProcessing?.cnt || 0,
      failed: jobsFailed?.cnt || 0
    },
    byEntity: byEntity.map((e) => ({ entityType: e.entityType, count: e.cnt })),
    byLanguage: byLanguage.map((l) => ({ languageCode: l.languageCode, count: l.cnt })),
    cacheSize: translationCache.size
  };
}
async function getTranslationJobsList(filters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq2(translationJobs.status, filters.status));
  if (filters?.entityType) conditions.push(eq2(translationJobs.entityType, filters.entityType));
  const where = conditions.length > 0 ? and2(...conditions) : void 0;
  return db.select().from(translationJobs).where(where).orderBy(desc2(translationJobs.createdAt)).limit(filters?.limit || 100);
}
async function updateUserLanguage(userId, language) {
  const db = await getDb();
  if (!db) return;
  const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
  await db.update(users2).set({ preferredLanguage: language }).where(eq2(users2.id, userId));
}

// server/routers/translation.ts
var languageEnum = z2.enum(["ar", "en", "ur"]);
var translationRouter = router({
  /**
   * Queue translation for an entity
   */
  queueTranslation: protectedProcedure.input(z2.object({
    entityType: z2.string(),
    entityId: z2.number(),
    fields: z2.array(z2.object({
      fieldName: z2.string(),
      text: z2.string()
    })),
    sourceLanguage: languageEnum,
    targetLanguages: z2.array(languageEnum).optional()
  })).mutation(async ({ input, ctx }) => {
    const jobIds = await queueTranslation({
      ...input,
      userId: ctx.user.id
    });
    return { success: true, jobIds, count: jobIds.length };
  }),
  /**
   * Get translations for a single entity
   */
  getEntityTranslations: protectedProcedure.input(z2.object({
    entityType: z2.string(),
    entityId: z2.number(),
    languageCode: languageEnum,
    fieldNames: z2.array(z2.string()).optional()
  })).query(async ({ input }) => {
    return getEntityTranslations(
      input.entityType,
      input.entityId,
      input.languageCode,
      input.fieldNames
    );
  }),
  /**
   * Get translations for multiple entities (batch)
   */
  getBatchTranslations: protectedProcedure.input(z2.object({
    entityType: z2.string(),
    entityIds: z2.array(z2.number()),
    languageCode: languageEnum,
    fieldNames: z2.array(z2.string()).optional()
  })).query(async ({ input }) => {
    return getBatchTranslations(
      input.entityType,
      input.entityIds,
      input.languageCode,
      input.fieldNames
    );
  }),
  /**
   * Manual override - edit translation manually (marks as approved)
   */
  manualOverride: protectedProcedure.input(z2.object({
    entityType: z2.string(),
    entityId: z2.number(),
    fieldName: z2.string(),
    languageCode: languageEnum,
    translatedText: z2.string().min(1)
  })).mutation(async ({ input, ctx }) => {
    const allowedRoles = ["owner", "admin", "maintenance_manager"];
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062A\u0631\u062C\u0645\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B"
      });
    }
    await manualOverrideTranslation(
      input.entityType,
      input.entityId,
      input.fieldName,
      input.languageCode,
      input.translatedText,
      ctx.user.id
    );
    return { success: true };
  }),
  /**
   * Get translation version history
   */
  getVersionHistory: protectedProcedure.input(z2.object({
    entityType: z2.string(),
    entityId: z2.number(),
    fieldName: z2.string(),
    languageCode: languageEnum
  })).query(async ({ input }) => {
    return getTranslationVersions(
      input.entityType,
      input.entityId,
      input.fieldName,
      input.languageCode
    );
  }),
  /**
   * Retry failed translation jobs
   */
  retryFailed: protectedProcedure.input(z2.object({
    entityType: z2.string().optional()
  }).optional()).mutation(async ({ input, ctx }) => {
    if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
      throw new TRPCError3({ code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0627\u0644\u0643 \u064A\u0645\u0643\u0646\u0647 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629" });
    }
    const count2 = await retryFailedJobs(input?.entityType);
    return { success: true, retriedCount: count2 };
  }),
  /**
   * Get translation statistics for monitoring
   */
  getStats: protectedProcedure.query(async () => {
    return getTranslationStats();
  }),
  /**
   * Get translation jobs list (for admin monitoring)
   */
  getJobs: protectedProcedure.input(z2.object({
    status: z2.string().optional(),
    entityType: z2.string().optional(),
    limit: z2.number().optional()
  }).optional()).query(async ({ input }) => {
    return getTranslationJobsList(input || void 0);
  }),
  /**
   * Update user preferred language
   */
  setLanguage: protectedProcedure.input(z2.object({
    language: languageEnum
  })).mutation(async ({ input, ctx }) => {
    await updateUserLanguage(ctx.user.id, input.language);
    return { success: true };
  }),
  /**
   * Get available entity types and their translatable fields
   */
  getEntityFieldMap: protectedProcedure.query(async () => {
    return ENTITY_FIELD_MAP;
  })
});

// server/services/translation.ts
async function detectLanguage(text2) {
  if (!text2 || text2.trim().length === 0) return "ar";
  const arabicPattern = /[\u0600-\u06FF]/;
  const urduPattern = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const arabicSpecific = /[\u0622\u0623\u0625\u0671]/;
  const urduSpecific = /[\u06A9\u06AF\u06BA\u06BE\u06C1\u06CC\u06D2]/;
  if (urduSpecific.test(text2)) return "ur";
  if (arabicSpecific.test(text2)) return "ar";
  if (arabicPattern.test(text2)) return "ar";
  if (urduPattern.test(text2)) return "ur";
  return "en";
}
async function translateFields(fields, originalLanguage) {
  const results = {};
  const nonEmptyFields = Object.entries(fields).filter(([, v]) => v && v.trim().length > 0);
  if (nonEmptyFields.length === 0) return results;
  const detectedLang = originalLanguage || await detectLanguage(nonEmptyFields[0][1]);
  try {
    const fieldsJson = JSON.stringify(Object.fromEntries(nonEmptyFields));
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional translator for maintenance and facility management systems.
Translate all fields in the given JSON object to Arabic (ar), English (en), and Urdu (ur).
Return a JSON object where each key maps to an object with "ar", "en", "ur" translations.
Keep technical terms, numbers, asset codes, and proper nouns as-is.`
        },
        {
          role: "user",
          content: `Translate these fields (original language: ${detectedLang}):
${fieldsJson}`
        }
      ]
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No translation content returned");
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    for (const [key] of nonEmptyFields) {
      if (parsed[key]) {
        results[key] = {
          ar: parsed[key].ar || fields[key],
          en: parsed[key].en || fields[key],
          ur: parsed[key].ur || fields[key],
          originalLanguage: detectedLang
        };
      } else {
        results[key] = {
          ar: fields[key],
          en: fields[key],
          ur: fields[key],
          originalLanguage: detectedLang
        };
      }
    }
  } catch (error) {
    console.error("[Translation] Error translating fields:", error);
    for (const [key, value] of nonEmptyFields) {
      results[key] = {
        ar: value,
        en: value,
        ur: value,
        originalLanguage: detectedLang
      };
    }
  }
  return results;
}

// server/routers.ts
import bcrypt from "bcryptjs";

// server/_core/cache.ts
import NodeCache from "node-cache";
var cache = new NodeCache({ stdTTL: 300, checkperiod: 10 });
var CacheManager = class {
  stats = {
    hits: 0,
    misses: 0
  };
  get(key) {
    const value = cache.get(key);
    if (value !== void 0) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return value;
  }
  set(key, value, ttl) {
    return cache.set(key, value, ttl ?? 300);
  }
  async getOrCompute(key, fn, ttl) {
    const cached = this.get(key);
    if (cached !== void 0) {
      return cached;
    }
    const value = await fn();
    this.set(key, value, ttl ?? 300);
    return value;
  }
  delete(key) {
    return cache.del(key);
  }
  deletePattern(pattern) {
    const keys = cache.keys();
    const keysToDelete = keys.filter((key) => pattern.test(key));
    if (keysToDelete.length === 0) return 0;
    keysToDelete.forEach((key) => cache.del(key));
    return keysToDelete.length;
  }
  clear() {
    cache.flushAll();
    this.stats = { hits: 0, misses: 0 };
  }
  getStats() {
    const keys = cache.keys();
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total * 100 : 0;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      keys: keys.length,
      memory: process.memoryUsage().heapUsed
    };
  }
  resetStats() {
    this.stats = { hits: 0, misses: 0 };
  }
};
var cacheManager = new CacheManager();
var cacheKeys = {
  // Sites — بيانات عامة مشتركة (آمن)
  sites: () => "sites:all",
  site: (id) => `site:${id}`,
  sitesByName: () => "sites:byName",
  // Users — معزول بـ role لمنع رؤية مستخدم عادي لقائمة كل المستخدمين
  users: (role) => role ? `users:all:role:${role}` : "users:all:admin",
  user: (id) => `user:${id}`,
  usersByRole: (role) => `users:role:${role}`,
  // Roles — بيانات عامة مشتركة (آمن)
  roles: () => "roles:all",
  role: (id) => `role:${id}`,
  // Assets — معزول بـ siteId
  assets: (siteId) => siteId ? `assets:site:${siteId}` : "assets:all",
  asset: (id) => `asset:${id}`,
  // Tickets stats — معزول بـ userId لمنع تسريب إحصائيات مستخدم لآخر
  ticketStats: (userId) => `tickets:stats:user:${userId}`,
  // Reports — معزول بـ userId أو role
  technicianReport: (userId, month) => month ? `report:technician:${userId}:${month}` : `report:technician:${userId}:all`,
  siteReport: (siteId) => siteId ? `report:site:${siteId}` : "report:site:all",
  // Purchase Orders — معزول بـ role
  purchaseOrders: (role) => role ? `purchase-orders:role:${role}` : "purchase-orders:all",
  purchaseOrder: (id) => `purchase-order:${id}`,
  // Maintenance Plans
  maintenancePlans: () => "maintenance-plans:all",
  maintenancePlan: (id) => `maintenance-plan:${id}`,
  // Invalidation patterns
  invalidateAll: () => /.*/,
  invalidateSite: (siteId) => new RegExp(`site:${siteId}|sites:`),
  invalidateUser: (userId) => new RegExp(`user:${userId}|users:`),
  invalidateTickets: () => /tickets:/,
  invalidateReports: () => /report:/,
  invalidatePurchaseOrders: () => /purchase-order/
};
var invalidateCache = {
  site: (siteId) => {
    cacheManager.deletePattern(cacheKeys.invalidateSite(siteId));
  },
  sites: () => {
    cacheManager.deletePattern(/sites:/);
  },
  user: (userId) => {
    cacheManager.deletePattern(cacheKeys.invalidateUser(userId));
  },
  users: () => {
    cacheManager.deletePattern(/users:/);
  },
  tickets: () => {
    cacheManager.deletePattern(cacheKeys.invalidateTickets());
  },
  reports: () => {
    cacheManager.deletePattern(cacheKeys.invalidateReports());
  },
  purchaseOrders: () => {
    cacheManager.deletePattern(cacheKeys.invalidatePurchaseOrders());
  },
  all: () => {
    cacheManager.clear();
  }
};

// server/routers.ts
var roleMiddleware = (allowedRoles) => {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role) && ctx.user.role !== "admin" && ctx.user.role !== "owner") {
      throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621" });
    }
    return next({ ctx });
  });
};
var managerProcedure = roleMiddleware(["maintenance_manager", "purchase_manager", "owner", "admin"]);
var supervisorProcedure = roleMiddleware(["supervisor", "maintenance_manager", "owner", "admin"]);
var gateSecurityProcedure = roleMiddleware(["gate_security", "owner", "admin"]);
var accountantProcedure = roleMiddleware(["accountant", "owner", "admin"]);
var managementProcedure = roleMiddleware(["senior_management", "owner", "admin"]);
var warehouseProcedure = roleMiddleware(["warehouse", "owner", "admin"]);
var delegateProcedure = roleMiddleware(["delegate", "owner", "admin"]);
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    login: publicProcedure.input(z3.object({
      username: z3.string().min(1),
      password: z3.string().min(8, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644")
    })).mutation(async ({ input, ctx }) => {
      const user = await getUserByUsername(input.username);
      if (!user || !user.passwordHash) {
        throw new TRPCError5({ code: "UNAUTHORIZED", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      if (!user.isActive) {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0639\u0637\u0644" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError5({ code: "UNAUTHORIZED", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      const { sdk: sdk2 } = await Promise.resolve().then(() => (init_sdk(), sdk_exports));
      const sessionToken = await sdk2.createSessionToken(user.openId, { name: user.name || user.username || "", expiresInMs: 1e3 * 60 * 60 * 24 * 365 });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 1e3 * 60 * 60 * 24 * 365 });
      await upsertUser({ openId: user.openId, lastSignedIn: /* @__PURE__ */ new Date() });
      const twoFactorSecret = await getTwoFactorSecret(user.id);
      const { getTwoFactorEnforcementStatus: getTwoFactorEnforcementStatus2 } = await Promise.resolve().then(() => (init_twoFactorEnforcement(), twoFactorEnforcement_exports));
      const twoFactorEnforcementStatus = getTwoFactorEnforcementStatus2(user, twoFactorSecret?.isEnabled || false);
      return {
        success: true,
        user: { id: user.id, name: user.name, role: user.role, username: user.username },
        twoFactorEnforcementStatus
      };
    }),
    changePassword: protectedProcedure.input(z3.object({
      currentPassword: z3.string().optional(),
      newPassword: z3.string().min(8, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644").regex(/(?=.*[A-Z])(?=.*\d)/, "\u064A\u062C\u0628 \u0623\u0646 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062D\u0631\u0641 \u0643\u0628\u064A\u0631 \u0648\u0631\u0642\u0645 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644")
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.passwordHash && input.currentPassword) {
        const valid = await bcrypt.compare(input.currentPassword, ctx.user.passwordHash);
        if (!valid) throw new TRPCError5({ code: "UNAUTHORIZED", message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      const hash = await bcrypt.hash(input.newPassword, 10);
      await updateUserPassword(ctx.user.id, hash);
      return { success: true };
    })
  }),
  // ============================================================
  // USERS
  // ============================================================
  users: router({
    list: protectedProcedure.query(async () => {
      return cacheManager.getOrCompute(
        cacheKeys.users(),
        () => getAllUsers(),
        600
        // 10 minutes
      );
    }),
    byRole: protectedProcedure.input(z3.object({ role: z3.string() })).query(async ({ input }) => {
      return cacheManager.getOrCompute(
        cacheKeys.usersByRole(input.role),
        () => getUsersByRole(input.role),
        600
        // 10 minutes
      );
    }),
    updateRole: protectedProcedure.input(z3.object({ userId: z3.number(), role: z3.string() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0627\u0644\u0643 \u064A\u0645\u0643\u0646\u0647 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0623\u062F\u0648\u0627\u0631" });
      }
      const oldUser = await getUserById(input.userId);
      await updateUserRole(input.userId, input.role);
      await createAuditLog({ userId: ctx.user.id, action: "update_role", entityType: "user", entityId: input.userId, oldValues: { role: oldUser?.role }, newValues: { role: input.role } });
      invalidateCache.users();
      return { success: true };
    }),
    update: protectedProcedure.input(z3.object({
      id: z3.number(),
      name: z3.string().optional(),
      email: z3.string().optional(),
      role: z3.string().optional(),
      phone: z3.string().optional(),
      department: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0627\u0644\u0643 \u064A\u0645\u0643\u0646\u0647 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646" });
      }
      const oldUser = await getUserById(input.id);
      if (!oldUser) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const { id, ...updateData } = input;
      await updateUser(id, updateData);
      await createAuditLog({ userId: ctx.user.id, action: "update_user", entityType: "user", entityId: id, oldValues: { name: oldUser.name, email: oldUser.email, role: oldUser.role }, newValues: updateData });
      invalidateCache.users();
      return { success: true };
    }),
    create: protectedProcedure.input(z3.object({
      username: z3.string().min(2),
      password: z3.string().min(8, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644").regex(/(?=.*[A-Z])(?=.*\d)/, "\u064A\u062C\u0628 \u0623\u0646 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062D\u0631\u0641 \u0643\u0628\u064A\u0631 \u0648\u0631\u0642\u0645 \u0648\u0627\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644"),
      name: z3.string().min(1),
      role: z3.string(),
      email: z3.string().optional(),
      phone: z3.string().optional(),
      department: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0627\u0644\u0643 \u064A\u0645\u0643\u0646\u0647 \u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646" });
      }
      const existing = await getUserByUsername(input.username);
      if (existing) throw new TRPCError5({ code: "CONFLICT", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0648\u062C\u0648\u062F \u0645\u0633\u0628\u0642\u0627\u064B" });
      const hash = await bcrypt.hash(input.password, 10);
      const id = await createLocalUser({ ...input, passwordHash: hash });
      await createAuditLog({ userId: ctx.user.id, action: "create_user", entityType: "user", entityId: id, newValues: { username: input.username, name: input.name, role: input.role } });
      invalidateCache.users();
      return { success: true, id };
    }),
    resetPassword: protectedProcedure.input(z3.object({
      userId: z3.number(),
      newPassword: z3.string().min(8, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644").regex(/(?=.*[A-Z])(?=.*\d)/, "\u064A\u062C\u0628 \u0623\u0646 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062D\u0631\u0641 \u0643\u0628\u064A\u0631 \u0648\u0631\u0642\u0645 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644")
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629" });
      }
      const hash = await bcrypt.hash(input.newPassword, 10);
      await updateUserPassword(input.userId, hash);
      await createAuditLog({ userId: ctx.user.id, action: "reset_password", entityType: "user", entityId: input.userId });
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({
      id: z3.number(),
      confirmPassword: z3.string().min(1, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0644\u062A\u0623\u0643\u064A\u062F")
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0627\u0644\u0643 \u064A\u0645\u0643\u0646\u0647 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646" });
      }
      if (!ctx.user.passwordHash) {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0647\u0648\u064A\u062A\u0643 (\u062D\u0633\u0627\u0628 OAuth)" });
      }
      const validPassword = await bcrypt.compare(input.confirmPassword, ctx.user.passwordHash);
      if (!validPassword) {
        throw new TRPCError5({ code: "UNAUTHORIZED", message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      const user = await getUserById(input.id);
      if (!user) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (user.role === "owner") throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u0627\u0644\u0643" });
      await deleteUser(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_user", entityType: "user", entityId: input.id, oldValues: { name: user.name, email: user.email, role: user.role } });
      invalidateCache.users();
      return { success: true };
    }),
    toggleActive: protectedProcedure.input(z3.object({
      id: z3.number(),
      isActive: z3.boolean()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0627\u0644\u0643 \u064A\u0645\u0643\u0646\u0647 \u062A\u0639\u0637\u064A\u0644/\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646" });
      }
      const user = await getUserById(input.id);
      if (!user) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (user.role === "owner") throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u0645\u0627\u0644\u0643" });
      await toggleUserActive(input.id, input.isActive);
      await createAuditLog({ userId: ctx.user.id, action: input.isActive ? "activate_user" : "deactivate_user", entityType: "user", entityId: input.id });
      invalidateCache.users();
      return { success: true };
    })
  }),
  // ============================================================
  // SITES
  // ============================================================
  sites: router({
    list: protectedProcedure.query(async () => {
      return cacheManager.getOrCompute(
        cacheKeys.sites(),
        () => getAllSites(),
        600
        // 10 minutes
      );
    }),
    create: protectedProcedure.input(z3.object({ name: z3.string().min(1), address: z3.string().optional(), description: z3.string().optional() })).mutation(async ({ input, ctx }) => {
      let nameEn;
      let nameUr;
      try {
        const translations = await translateFields({ name: input.name });
        nameEn = translations.name?.en;
        nameUr = translations.name?.ur;
      } catch (e) {
      }
      const id = await createSite({ ...input, nameEn, nameUr });
      await createAuditLog({ userId: ctx.user.id, action: "create_site", entityType: "site", entityId: id, newValues: input });
      invalidateCache.sites();
      return { id };
    }),
    update: protectedProcedure.input(z3.object({
      id: z3.number(),
      name: z3.string().min(1).optional(),
      address: z3.string().optional(),
      description: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const oldSite = await getSiteById(input.id);
      if (!oldSite) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0648\u0642\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const { id, ...updateData } = input;
      let siteExtraFields = {};
      if (updateData.name) {
        try {
          const translations = await translateFields({ name: updateData.name });
          siteExtraFields.nameEn = translations.name?.en;
          siteExtraFields.nameUr = translations.name?.ur;
        } catch (e) {
        }
      }
      await updateSite(id, { ...updateData, ...siteExtraFields });
      await createAuditLog({ userId: ctx.user.id, action: "update_site", entityType: "site", entityId: id, oldValues: { name: oldSite.name, address: oldSite.address, description: oldSite.description }, newValues: updateData });
      invalidateCache.sites();
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const site = await getSiteById(input.id);
      if (!site) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0648\u0642\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      await deleteSite(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_site", entityType: "site", entityId: input.id, oldValues: { name: site.name, address: site.address } });
      invalidateCache.sites();
      return { success: true };
    })
  }),
  // ============================================================
  // SECTIONS
  // ============================================================
  sections: router({
    list: protectedProcedure.input(z3.object({ siteId: z3.number().optional() }).optional()).query(async ({ input }) => {
      return getSections(input?.siteId);
    }),
    create: protectedProcedure.input(z3.object({
      name: z3.string().min(1),
      siteId: z3.number(),
      description: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      let sectionNameEn;
      let sectionNameUr;
      try {
        const translations = await translateFields({ name: input.name });
        sectionNameEn = translations.name?.en;
        sectionNameUr = translations.name?.ur;
      } catch (e) {
      }
      const id = await createSection({ ...input, nameEn: sectionNameEn, nameUr: sectionNameUr, isActive: true });
      await createAuditLog({ userId: ctx.user.id, action: "create_section", entityType: "section", entityId: id, newValues: input });
      return { id };
    }),
    update: protectedProcedure.input(z3.object({
      id: z3.number(),
      name: z3.string().min(1).optional(),
      description: z3.string().optional(),
      isActive: z3.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      let sectionExtraFields = {};
      if (updateData.name) {
        try {
          const translations = await translateFields({ name: updateData.name });
          sectionExtraFields.nameEn = translations.name?.en;
          sectionExtraFields.nameUr = translations.name?.ur;
        } catch (e) {
        }
      }
      await updateSection(id, { ...updateData, ...sectionExtraFields });
      await createAuditLog({ userId: ctx.user.id, action: "update_section", entityType: "section", entityId: id, newValues: updateData });
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      await deleteSection(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_section", entityType: "section", entityId: input.id });
      return { success: true };
    })
  }),
  // ============================================================
  // TECHNICIANS
  // ============================================================
  technicians: router({
    list: protectedProcedure.input(z3.object({ activeOnly: z3.boolean().optional() }).optional()).query(async ({ input }) => {
      return getAllTechnicians(input?.activeOnly ?? false);
    }),
    create: protectedProcedure.input(z3.object({
      name: z3.string().min(1),
      specialty: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      let techNameEn;
      let techNameUr;
      let techSpecialtyEn;
      let techSpecialtyUr;
      try {
        const fieldsToTranslate = { name: input.name };
        if (input.specialty) fieldsToTranslate.specialty = input.specialty;
        const translations = await translateFields(fieldsToTranslate);
        techNameEn = translations.name?.en;
        techNameUr = translations.name?.ur;
        techSpecialtyEn = translations.specialty?.en;
        techSpecialtyUr = translations.specialty?.ur;
      } catch (e) {
      }
      const id = await createTechnician({ ...input, nameEn: techNameEn, nameUr: techNameUr, specialtyEn: techSpecialtyEn, specialtyUr: techSpecialtyUr });
      await createAuditLog({ userId: ctx.user.id, action: "create_technician", entityType: "technician", entityId: id, newValues: input });
      return { id };
    }),
    update: protectedProcedure.input(z3.object({
      id: z3.number(),
      name: z3.string().min(1).optional(),
      specialty: z3.string().optional(),
      status: z3.enum(["active", "inactive"]).optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      let techExtraFields = {};
      if (updateData.name || updateData.specialty) {
        try {
          const fieldsToTranslate = {};
          if (updateData.name) fieldsToTranslate.name = updateData.name;
          if (updateData.specialty) fieldsToTranslate.specialty = updateData.specialty;
          const translations = await translateFields(fieldsToTranslate);
          if (updateData.name) {
            techExtraFields.nameEn = translations.name?.en;
            techExtraFields.nameUr = translations.name?.ur;
          }
          if (updateData.specialty) {
            techExtraFields.specialtyEn = translations.specialty?.en;
            techExtraFields.specialtyUr = translations.specialty?.ur;
          }
        } catch (e) {
        }
      }
      await updateTechnician(id, { ...updateData, ...techExtraFields });
      await createAuditLog({ userId: ctx.user.id, action: "update_technician", entityType: "technician", entityId: id, newValues: updateData });
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      await deleteTechnician(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_technician", entityType: "technician", entityId: input.id });
      return { success: true };
    }),
    getOpenTicketCounts: protectedProcedure.query(async () => {
      return getTechnicianOpenTicketCounts();
    })
  }),
  // ============================================================
  // TICKETS
  // ============================================================
  tickets: router({
    list: protectedProcedure.input(z3.object({
      status: z3.string().optional(),
      priority: z3.string().optional(),
      siteId: z3.number().optional(),
      sectionId: z3.number().optional(),
      assetId: z3.number().optional(),
      search: z3.string().optional(),
      category: z3.string().optional(),
      assignedTechnicianId: z3.number().optional()
    }).optional()).query(async ({ input, ctx }) => {
      const role = ctx.user.role;
      let filters = input || {};
      if (role === "operator") filters.reportedById = ctx.user.id;
      else if (role === "technician") filters.assignedToId = ctx.user.id;
      return getTickets(filters);
    }),
    getById: protectedProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return ticket;
    }),
    create: protectedProcedure.input(z3.object({
      title: z3.string().min(1),
      description: z3.string().optional(),
      priority: z3.string().default("medium"),
      category: z3.string().default("general"),
      siteId: z3.number().optional(),
      sectionId: z3.number().optional(),
      assetId: z3.number().optional(),
      locationDetail: z3.string().optional(),
      beforePhotoUrl: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticketNumber = await getNextTicketNumber();
      const fieldsToTranslate = {};
      if (input.title) fieldsToTranslate.title = input.title;
      if (input.description) fieldsToTranslate.description = input.description;
      let translationData = {};
      let detectedLang = "ar";
      if (Object.keys(fieldsToTranslate).length > 0) {
        try {
          detectedLang = await detectLanguage(input.title);
          const translations = await translateFields(fieldsToTranslate, detectedLang);
          if (translations.title) {
            translationData.title_ar = translations.title.ar;
            translationData.title_en = translations.title.en;
            translationData.title_ur = translations.title.ur;
          }
          if (translations.description) {
            translationData.description_ar = translations.description.ar;
            translationData.description_en = translations.description.en;
            translationData.description_ur = translations.description.ur;
          }
        } catch (e) {
          console.error("[Ticket] Translation failed:", e);
        }
      }
      const id = await createTicket({ ...input, ...translationData, originalLanguage: detectedLang, ticketNumber, reportedById: ctx.user.id, status: "pending_triage" });
      await addTicketStatusHistory({ ticketId: id, fromStatus: void 0, toStatus: "pending_triage", changedById: ctx.user.id });
      await createAuditLog({ userId: ctx.user.id, action: "create_ticket", entityType: "ticket", entityId: id });
      const supervisors = await getUsersByRole("supervisor");
      for (const sup of supervisors) {
        await createNotification({ userId: sup.id, title: "\u0628\u0644\u0627\u063A \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0641\u0631\u0632", message: `\u0627\u0644\u0628\u0644\u0627\u063A ${ticketNumber} - ${input.title} \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0641\u0631\u0632 \u0648\u0627\u0644\u062A\u0635\u0646\u064A\u0641`, type: "info", relatedTicketId: id });
      }
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({ userId: mgr.id, title: "\u0628\u0644\u0627\u063A \u062C\u062F\u064A\u062F", message: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0628\u0644\u0627\u063A \u062C\u062F\u064A\u062F: ${ticketNumber} - ${input.title}`, type: "info", relatedTicketId: id });
      }
      return { id, ticketNumber };
    }),
    approve: managerProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      await updateTicket(input.id, { status: "approved", approvedById: ctx.user.id });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "approved", changedById: ctx.user.id });
      const supervisorsApprove = await getUsersByRole("supervisor");
      for (const sup of supervisorsApprove) {
        await createNotification({ userId: sup.id, title: "\u2705 \u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0628\u0644\u0627\u063A", message: `\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u062F\u064A\u0631`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    assign: managerProcedure.input(z3.object({
      id: z3.number(),
      technicianId: z3.number().optional(),
      // System user technician
      externalTechnicianId: z3.number().optional()
      // External technician (no account)
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (!input.technicianId && !input.externalTechnicianId) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0641\u0646\u064A \u0644\u0644\u0625\u0633\u0646\u0627\u062F" });
      }
      const updateData = {
        status: "assigned",
        assignedAt: /* @__PURE__ */ new Date()
      };
      if (input.technicianId) updateData.assignedToId = input.technicianId;
      if (input.externalTechnicianId) updateData.assignedTechnicianId = input.externalTechnicianId;
      await updateTicket(input.id, updateData);
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "assigned", changedById: ctx.user.id });
      if (input.technicianId) {
        await createNotification({ userId: input.technicianId, title: "\u0628\u0644\u0627\u063A \u0645\u064F\u0633\u0646\u062F \u0625\u0644\u064A\u0643", message: `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0625\u0644\u064A\u0643`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    startRepair: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      const validStatuses = ["assigned", "in_progress", "repaired", "purchase_approved", "purchased", "partial_purchase"];
      if (!validStatuses.includes(ticket.status)) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: `\u0644\u0627 \u064A\u0645\u0643\u0646 \u0628\u062F\u0621 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0641\u064A \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629: ${ticket.status}` });
      }
      await updateTicket(input.id, { status: "in_progress" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "in_progress", changedById: ctx.user.id });
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({ userId: mgr.id, title: "\u{1F527} \u0628\u062F\u0623 \u062A\u0646\u0641\u064A\u0630 \u0628\u0644\u0627\u063A", message: `\u0628\u062F\u0623 \u0627\u0644\u0641\u0646\u064A \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber}`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    completeRepair: protectedProcedure.input(z3.object({
      id: z3.number(),
      afterPhotoUrl: z3.string().min(1, "\u0635\u0648\u0631\u0629 \u0628\u0639\u062F \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u0645\u0637\u0644\u0648\u0628\u0629"),
      repairNotes: z3.string().optional(),
      materialsUsed: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "in_progress") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0627\u0644\u0628\u0644\u0627\u063A \u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0623\u0648\u0644\u0627\u064B" });
      }
      let repairTranslation = {};
      if (input.repairNotes) {
        try {
          const lang = await detectLanguage(input.repairNotes);
          const translations = await translateFields({ repairNotes: input.repairNotes }, lang);
          if (translations.repairNotes) {
            repairTranslation.repairNotes_ar = translations.repairNotes.ar;
            repairTranslation.repairNotes_en = translations.repairNotes.en;
            repairTranslation.repairNotes_ur = translations.repairNotes.ur;
          }
        } catch (e) {
          console.error("[Ticket] RepairNotes translation failed:", e);
        }
      }
      await updateTicket(input.id, { status: "repaired", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes, materialsUsed: input.materialsUsed, ...repairTranslation });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "repaired", changedById: ctx.user.id });
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({ userId: mgr.id, title: "\u062A\u0645 \u0625\u0635\u0644\u0627\u062D \u0628\u0644\u0627\u063A", message: `\u062A\u0645 \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    close: managerProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      await updateTicket(input.id, { status: "closed", closedAt: /* @__PURE__ */ new Date() });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "closed", changedById: ctx.user.id });
      await createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
      if (ticket.reportedById) {
        await createNotification({ userId: ticket.reportedById, title: "\u{1F512} \u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0628\u0644\u0627\u063A\u0643", message: `\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0628\u0646\u062C\u0627\u062D`, type: "success", relatedTicketId: input.id });
      }
      if (ticket.assignedToId && ticket.assignedToId !== ticket.reportedById) {
        await createNotification({ userId: ticket.assignedToId, title: "\u{1F512} \u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0628\u0644\u0627\u063A", message: `\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0627\u0644\u0630\u064A \u0643\u0646\u062A \u0645\u0633\u0624\u0648\u0644\u0627\u064B \u0639\u0646\u0647`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // ❌ REMOVED: updateStatus (was allowing any status without validation)
    // ✅ REPLACED WITH: Specific procedures for each valid transition
    // Transition: new → pending_triage (Operator creates ticket)
    createTicket: protectedProcedure.input(z3.object({
      title: z3.string(),
      description: z3.string().optional(),
      priority: z3.enum(["low", "medium", "high", "critical"]),
      category: z3.enum(["electrical", "plumbing", "hvac", "structural", "mechanical", "general", "safety", "cleaning"]),
      siteId: z3.number().optional(),
      assetId: z3.number().optional(),
      locationDetail: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticketNumber = `TK-${Date.now()}`;
      const ticket = await createTicket({
        ticketNumber,
        title: input.title,
        description: input.description,
        priority: input.priority,
        category: input.category,
        siteId: input.siteId,
        assetId: input.assetId,
        locationDetail: input.locationDetail,
        reportedById: ctx.user.id,
        status: "pending_triage"
      });
      if (!ticket) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
      await addTicketStatusHistory({ ticketId: typeof ticket === "number" ? ticket : ticket.id, fromStatus: "new", toStatus: "pending_triage", changedById: ctx.user.id });
      return ticket;
    }),
    // Transition: pending_triage → under_inspection (Manager assigns for inspection)
    assignForInspection: managerProcedure.input(z3.object({
      id: z3.number(),
      assignedToId: z3.number(),
      triageNotes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "pending_triage") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0623\u0648\u0644\u064A" });
      await updateTicket(input.id, { status: "under_inspection", assignedToId: input.assignedToId, triageNotes: input.triageNotes });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "pending_triage", toStatus: "under_inspection", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: under_inspection → work_approved (Manager approves + chooses path)
    // Already exists as approveWork - no change needed
    // ========== PATH A TRANSITIONS ==========
    // Transition: work_approved → ready_for_closure (Technician completes)
    // Already exists as markReadyForClosure - no change needed
    // Transition: ready_for_closure → closed (Supervisor closes)
    // Already exists as closeBySupervisor - no change needed
    // ========== PATH B TRANSITIONS ==========
    // Transition: work_approved → assigned (Manager assigns technician)
    assignTechnician: managerProcedure.input(z3.object({
      id: z3.number(),
      assignedToId: z3.number()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "work_approved") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0639\u062A\u0645\u062F\u0627\u064B" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "assigned", assignedToId: input.assignedToId });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "work_approved", toStatus: "assigned", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: assigned → in_progress (Technician starts work)
    startWork: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "assigned") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0633\u0646\u062F\u0627\u064B" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "in_progress" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "assigned", toStatus: "in_progress", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: in_progress → needs_purchase (Technician identifies need)
    requestPurchase: protectedProcedure.input(z3.object({
      id: z3.number(),
      materialsNeeded: z3.string()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "in_progress") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "needs_purchase", materialsUsed: input.materialsNeeded });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "in_progress", toStatus: "needs_purchase", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: needs_purchase → purchase_pending_estimate (Purchase manager gets estimate)
    submitEstimate: managerProcedure.input(z3.object({
      id: z3.number(),
      estimatedCost: z3.number(),
      estimateNotes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "needs_purchase") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0634\u0631\u0627\u0621" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "purchase_pending_estimate" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "needs_purchase", toStatus: "purchase_pending_estimate", changedById: ctx.user.id, notes: `\u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0642\u062F\u0631\u0629: ${input.estimatedCost}` });
      return { success: true };
    }),
    // Transition: purchase_pending_estimate → purchase_pending_accounting (Accountant reviews)
    submitToAccounting: accountantProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_pending_estimate") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0642\u062F\u064A\u0631" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "purchase_pending_accounting" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_pending_estimate", toStatus: "purchase_pending_accounting", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: purchase_pending_accounting → purchase_pending_management (Senior management approval)
    submitToManagement: managementProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_pending_accounting") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "purchase_pending_management" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_pending_accounting", toStatus: "purchase_pending_management", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: purchase_pending_management → purchase_approved (Management approves)
    approvePurchase: managementProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_pending_management") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "purchase_approved" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_pending_management", toStatus: "purchase_approved", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: purchase_approved → partial_purchase or purchased (Purchase manager executes)
    executePurchase: managerProcedure.input(z3.object({
      id: z3.number(),
      isPartial: z3.boolean().default(false)
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_approved") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0639\u062A\u0645\u062F\u0627\u064B \u0644\u0644\u0634\u0631\u0627\u0621" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      const newStatus = input.isPartial ? "partial_purchase" : "purchased";
      await updateTicket(input.id, { status: newStatus });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_approved", toStatus: newStatus, changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: partial_purchase → purchased (Final purchase)
    completePurchase: managerProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "partial_purchase") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0634\u0631\u0627\u0621 \u062C\u0632\u0626\u064A" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "purchased" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "partial_purchase", toStatus: "purchased", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: purchased → received_warehouse (Warehouse receives)
    receiveInWarehouse: warehouseProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "purchased") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0634\u062A\u0631\u0627\u064B" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "received_warehouse" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchased", toStatus: "received_warehouse", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: received_warehouse → ready_for_closure (Technician completes with parts)
    completeWithParts: protectedProcedure.input(z3.object({
      id: z3.number(),
      afterPhotoUrl: z3.string().optional(),
      repairNotes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "received_warehouse") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0633\u062A\u0644\u0645\u0627\u064B \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639" });
      if (ticket.maintenancePath !== "B") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 B \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "received_warehouse", toStatus: "ready_for_closure", changedById: ctx.user.id });
      return { success: true };
    }),
    // ========== PATH C TRANSITIONS ==========
    // Transitions already exist: approveGateExit, markExternalRepairDone, approveGateEntry
    // ========== FINAL TRANSITIONS (All Paths) ==========
    // Transition: ready_for_closure → repaired (Verification)
    markRepaired: managerProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "ready_for_closure") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u062C\u0627\u0647\u0632\u0627\u064B \u0644\u0644\u0625\u063A\u0644\u0627\u0642" });
      await updateTicket(input.id, { status: "repaired" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "ready_for_closure", toStatus: "repaired", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: repaired → verified (Final verification)
    markVerified: supervisorProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "repaired") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0635\u0644\u062D\u0627\u064B" });
      await updateTicket(input.id, { status: "verified" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "repaired", toStatus: "verified", changedById: ctx.user.id });
      return { success: true };
    }),
    // Transition: verified → closed (Final closure)
    finalClose: supervisorProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "verified") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u064F\u062A\u062D\u0642\u0642 \u0645\u0646\u0647" });
      await updateTicket(input.id, { status: "closed", closedAt: /* @__PURE__ */ new Date() });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: "verified", toStatus: "closed", changedById: ctx.user.id });
      await createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
      return { success: true };
    }),
    update: protectedProcedure.input(z3.object({
      id: z3.number(),
      title: z3.string().optional(),
      description: z3.string().optional(),
      priority: z3.string().optional(),
      category: z3.string().optional(),
      siteId: z3.number().optional(),
      locationDetail: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const canEdit = ["owner", "admin", "maintenance_manager"].includes(ctx.user.role) || ticket.reportedById === ctx.user.id;
      if (!canEdit) throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0628\u0644\u0627\u063A" });
      if (ticket.status === "closed") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0628\u0644\u0627\u063A \u0645\u063A\u0644\u0642" });
      const { id, ...updateData } = input;
      const oldValues = {};
      const newValues = {};
      if (input.title && input.title !== ticket.title) {
        oldValues.title = ticket.title;
        newValues.title = input.title;
      }
      if (input.description && input.description !== ticket.description) {
        oldValues.description = ticket.description;
        newValues.description = input.description;
      }
      if (input.priority && input.priority !== ticket.priority) {
        oldValues.priority = ticket.priority;
        newValues.priority = input.priority;
      }
      if (input.category && input.category !== ticket.category) {
        oldValues.category = ticket.category;
        newValues.category = input.category;
      }
      if (input.siteId && input.siteId !== ticket.siteId) {
        oldValues.siteId = ticket.siteId;
        newValues.siteId = input.siteId;
      }
      let translationUpdate = {};
      const fieldsToTranslate = {};
      if (input.title && input.title !== ticket.title) fieldsToTranslate.title = input.title;
      if (input.description && input.description !== ticket.description) fieldsToTranslate.description = input.description;
      if (Object.keys(fieldsToTranslate).length > 0) {
        try {
          const textForDetection = Object.values(fieldsToTranslate)[0];
          const detectedLang = await detectLanguage(textForDetection);
          const translations = await translateFields(fieldsToTranslate, detectedLang);
          if (translations.title) {
            translationUpdate.title_ar = translations.title.ar;
            translationUpdate.title_en = translations.title.en;
            translationUpdate.title_ur = translations.title.ur;
          }
          if (translations.description) {
            translationUpdate.description_ar = translations.description.ar;
            translationUpdate.description_en = translations.description.en;
            translationUpdate.description_ur = translations.description.ur;
          }
        } catch (e) {
          console.error("[Ticket] Update translation failed:", e);
        }
      }
      await updateTicket(id, { ...updateData, ...translationUpdate });
      await createAuditLog({ userId: ctx.user.id, action: "update_ticket", entityType: "ticket", entityId: id, oldValues, newValues });
      if (Object.keys(newValues).length > 0) {
        const managers = await getManagerUsers();
        const changedFields = Object.keys(newValues).join(", ");
        for (const mgr of managers) {
          if (mgr.id !== ctx.user.id) {
            await createNotification({ userId: mgr.id, title: `\u062A\u0639\u062F\u064A\u0644 \u0628\u0644\u0627\u063A #${ticket.ticketNumber}`, message: `\u0642\u0627\u0645 ${ctx.user.name} \u0628\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0628\u0644\u0627\u063A "${ticket.title}" - \u0627\u0644\u062D\u0642\u0648\u0644: ${changedFields}`, type: "ticket_updated", relatedTicketId: id });
          }
        }
      }
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (!["owner", "admin", "maintenance_manager"].includes(ctx.user.role)) {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062D\u0630\u0641 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A" });
      }
      await deleteTicket(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_ticket", entityType: "ticket", entityId: input.id, oldValues: { ticketNumber: ticket.ticketNumber, title: ticket.title, status: ticket.status } });
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        if (mgr.id !== ctx.user.id) {
          await createNotification({ userId: mgr.id, title: `\u062D\u0630\u0641 \u0628\u0644\u0627\u063A #${ticket.ticketNumber}`, message: `\u0642\u0627\u0645 ${ctx.user.name} \u0628\u062D\u0630\u0641 \u0627\u0644\u0628\u0644\u0627\u063A "${ticket.title}"`, type: "ticket_deleted", relatedTicketId: input.id });
        }
      }
      return { success: true };
    }),
    history: protectedProcedure.input(z3.object({ ticketId: z3.number() })).query(async ({ input }) => {
      return getTicketHistory(input.ticketId);
    }),
    // =============================================
    // NEW WORKFLOW PROCEDURES
    // =============================================
    // 1. Submit for Triage (after creation, ticket goes to supervisor)
    submitForTriage: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      await updateTicket(input.id, { status: "pending_triage" });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "pending_triage", changedById: ctx.user.id });
      const supervisors = await getUsersByRole("supervisor");
      for (const sup of supervisors) {
        await createNotification({ userId: sup.id, title: "\u0628\u0644\u0627\u063A \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0641\u0631\u0632", message: `\u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0641\u0631\u0632 \u0648\u0627\u0644\u062A\u0635\u0646\u064A\u0641`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 2. Triage by Supervisor (Eng. Khaled)
    triage: supervisorProcedure.input(z3.object({
      id: z3.number(),
      ticketType: z3.enum(["internal", "external", "procurement"]),
      priority: z3.string().optional(),
      triageNotes: z3.string().optional(),
      assignedToId: z3.number().optional()
      // Assign inspection team
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "pending_triage") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u0644\u064A\u0633 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u0631\u0632" });
      const updateData = {
        status: "under_inspection",
        ticketType: input.ticketType,
        supervisorId: ctx.user.id,
        triageNotes: input.triageNotes
      };
      if (input.priority) updateData.priority = input.priority;
      if (input.assignedToId) updateData.assignedToId = input.assignedToId;
      await updateTicket(input.id, updateData);
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "under_inspection", changedById: ctx.user.id, notes: input.triageNotes });
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({ userId: mgr.id, title: "\u0628\u0644\u0627\u063A \u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635", message: `\u062A\u0645 \u0641\u0631\u0632 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0648\u0647\u0648 \u0627\u0644\u0622\u0646 \u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 2b. Triage Ticket (Supervisor moves ticket from pending_triage to under_inspection)
    triageTicket: supervisorProcedure.input(z3.object({
      id: z3.number(),
      assignedToId: z3.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "pending_triage") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u0644\u064A\u0633 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u0631\u0632" });
      const updateData = { status: "under_inspection", supervisorId: ctx.user.id };
      if (input.assignedToId) updateData.assignedToId = input.assignedToId;
      await updateTicket(input.id, updateData);
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "under_inspection", changedById: ctx.user.id, notes: input.assignedToId ? `\u062A\u0645 \u0646\u0642\u0644 \u0627\u0644\u0628\u0644\u0627\u063A \u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u062D\u0635 \u0648\u062A\u0639\u064A\u064A\u0646\u0647 \u0644\u0644\u0641\u0646\u064A` : "\u062A\u0645 \u0646\u0642\u0644 \u0627\u0644\u0628\u0644\u0627\u063A \u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u062D\u0635" });
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({ userId: mgr.id, title: "\u0628\u0644\u0627\u063A \u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635", message: `\u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0627\u0644\u0622\u0646 \u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0634\u0631\u0641`, type: "info", relatedTicketId: input.id });
      }
      if (input.assignedToId) {
        await createNotification({ userId: input.assignedToId, title: "\u062A\u0645 \u062A\u0639\u064A\u064A\u0646\u0643 \u0644\u0641\u062D\u0635 \u0628\u0644\u0627\u063A", message: `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646\u0643 \u0644\u0644\u0641\u062D\u0635 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A \u0644\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber}`, type: "warning", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 2c. Inspect Ticket (Supervisor completes inspection and prepares for approval)
    inspectTicket: supervisorProcedure.input(z3.object({
      id: z3.number(),
      inspectionNotes: z3.string()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "under_inspection") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u0644\u064A\u0633 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u062D\u0635" });
      await updateTicket(input.id, { inspectionNotes: input.inspectionNotes });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "under_inspection", changedById: ctx.user.id, notes: `\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0641\u062D\u0635: ${input.inspectionNotes}` });
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({ userId: mgr.id, title: "\u0628\u0644\u0627\u063A \u062C\u0627\u0647\u0632 \u0644\u0644\u0645\u0648\u0627\u0641\u0642\u0629", message: `\u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0627\u0646\u062A\u0647\u0649 \u0645\u0646 \u0627\u0644\u0641\u062D\u0635 \u0648\u062C\u0627\u0647\u0632 \u0644\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0639\u0645\u0644`, type: "warning", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 3. Work Approval by Maintenance Manager (Abdel Fattah) + Path Selection
    approveWork: managerProcedure.input(z3.object({
      id: z3.number(),
      maintenancePath: z3.enum(["A", "B", "C"]),
      inspectionNotes: z3.string().optional(),
      justification: z3.string().optional()
      // Required for Path C
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "under_inspection") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u0644\u064A\u0633 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u062D\u0635" });
      if (input.maintenancePath === "C" && !input.justification) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0645\u0633\u0627\u0631 C \u064A\u062A\u0637\u0644\u0628 \u0645\u0628\u0631\u0631\u0627\u064B \u0644\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629" });
      }
      const updateData = {
        status: "work_approved",
        maintenancePath: input.maintenancePath,
        approvedById: ctx.user.id,
        inspectionNotes: input.inspectionNotes,
        justification: input.justification
      };
      await updateTicket(input.id, updateData);
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "work_approved", changedById: ctx.user.id, notes: `\u0627\u0644\u0645\u0633\u0627\u0631: ${input.maintenancePath}` });
      if (input.maintenancePath === "C") {
        const supervisors = await getUsersByRole("supervisor");
        for (const sup of supervisors) {
          await createNotification({ userId: sup.id, title: "\u0628\u0644\u0627\u063A \u0645\u0633\u0627\u0631 \u062E\u0627\u0631\u062C\u064A", message: `\u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u064A\u062D\u062A\u0627\u062C \u0645\u0648\u0627\u0641\u0642\u0629 \u0644\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629 (\u0627\u0644\u0645\u0633\u0627\u0631 C)`, type: "warning", relatedTicketId: input.id });
        }
      } else if (input.maintenancePath === "A") {
        if (ticket.assignedToId) {
          await createNotification({ userId: ticket.assignedToId, title: "\u0627\u0639\u062A\u0645\u0627\u062F \u0628\u062F\u0621 \u0627\u0644\u0639\u0645\u0644", message: `\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0644\u0644\u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0645\u0628\u0627\u0634\u0631`, type: "success", relatedTicketId: input.id });
        }
      } else if (input.maintenancePath === "B") {
        if (ticket.assignedToId) {
          await createNotification({ userId: ticket.assignedToId, title: "\u0627\u0639\u062A\u0645\u0627\u062F \u0628\u0644\u0627\u063A - \u0645\u0633\u0627\u0631 \u0627\u0644\u0634\u0631\u0627\u0621", message: `\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} - \u0633\u064A\u062A\u0645 \u0631\u0641\u0639 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u0644\u0627\u0632\u0645\u0629`, type: "warning", relatedTicketId: input.id });
        }
      }
      return { success: true };
    }),
    // 4. Mark Ready for Closure (Path A - after technician completes repair)
    markReadyForClosure: protectedProcedure.input(z3.object({
      id: z3.number(),
      afterPhotoUrl: z3.string().optional(),
      repairNotes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.maintenancePath !== "A") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 A \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "ready_for_closure", changedById: ctx.user.id });
      const supervisors = await getUsersByRole("supervisor");
      for (const sup of supervisors) {
        await createNotification({ userId: sup.id, title: "\u0628\u0644\u0627\u063A \u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u063A\u0644\u0627\u0642", message: `\u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u063A\u0644\u0627\u0642 - \u0627\u0644\u0645\u0633\u0627\u0631 A`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 5. Supervisor closes ticket (Path A)
    closeBySupervisor: supervisorProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "ready_for_closure") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0628\u0644\u0627\u063A \u0644\u064A\u0633 \u062C\u0627\u0647\u0632\u0627\u064B \u0644\u0644\u0625\u063A\u0644\u0627\u0642" });
      await updateTicket(input.id, { status: "closed", closedAt: /* @__PURE__ */ new Date() });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "closed", changedById: ctx.user.id });
      await createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
      const managersSup = await getManagerUsers();
      for (const mgr of managersSup) {
        await createNotification({ userId: mgr.id, title: "\u{1F512} \u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0628\u0644\u0627\u063A", message: `\u0623\u063A\u0644\u0642 \u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
      }
      if (ticket.reportedById) {
        await createNotification({ userId: ticket.reportedById, title: "\u{1F512} \u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0628\u0644\u0627\u063A\u0643", message: `\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0628\u0646\u062C\u0627\u062D`, type: "success", relatedTicketId: input.id });
      }
      if (ticket.assignedToId && ticket.assignedToId !== ticket.reportedById) {
        await createNotification({ userId: ticket.assignedToId, title: "\u{1F512} \u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0628\u0644\u0627\u063A", message: `\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 6. Gate Exit Approval (Path C - asset leaves for external repair)
    approveGateExit: gateSecurityProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.maintenancePath !== "C") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 C \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "out_for_repair", gateExitApprovedById: ctx.user.id, gateExitApprovedAt: /* @__PURE__ */ new Date() });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "out_for_repair", changedById: ctx.user.id, notes: "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u062E\u0631\u0648\u062C \u0627\u0644\u0623\u0635\u0644" });
      await createAuditLog({ userId: ctx.user.id, action: "gate_exit_approved", entityType: "ticket", entityId: input.id });
      return { success: true };
    }),
    // 7. Mark External Repair Completed (Delegate)
    markExternalRepairDone: delegateProcedure.input(z3.object({
      id: z3.number(),
      repairNotes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.status !== "out_for_repair") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u0623\u0635\u0644 \u0644\u064A\u0633 \u062E\u0627\u0631\u062C\u0627\u064B \u0644\u0644\u0625\u0635\u0644\u0627\u062D" });
      await updateTicket(input.id, { externalRepairCompletedAt: /* @__PURE__ */ new Date(), externalRepairCompletedById: ctx.user.id, repairNotes: input.repairNotes });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "out_for_repair", changedById: ctx.user.id, notes: "\u062A\u0645 \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u0627\u0644\u062E\u0627\u0631\u062C\u064A - \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u062F\u062E\u0648\u0644" });
      const gateUsers = await getUsersByRole("gate_security");
      for (const g of gateUsers) {
        await createNotification({ userId: g.id, title: "\u0623\u0635\u0644 \u0639\u0627\u0626\u062F \u0644\u0644\u0645\u0646\u0634\u0623\u0629", message: `\u0627\u0644\u0623\u0635\u0644 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0639\u0627\u0626\u062F \u0628\u0639\u062F \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u0627\u0644\u062E\u0627\u0631\u062C\u064A`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 8. Gate Entry Approval (Path C - asset returns after external repair)
    approveGateEntry: gateSecurityProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await getTicketById(input.id);
      if (!ticket) throw new TRPCError5({ code: "NOT_FOUND" });
      if (ticket.maintenancePath !== "C") throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0644\u0645\u0633\u0627\u0631 C \u0641\u0642\u0637" });
      await updateTicket(input.id, { status: "ready_for_closure", gateEntryApprovedById: ctx.user.id, gateEntryApprovedAt: /* @__PURE__ */ new Date() });
      await addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "ready_for_closure", changedById: ctx.user.id, notes: "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u062F\u062E\u0648\u0644 \u0627\u0644\u0623\u0635\u0644 - \u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u063A\u0644\u0627\u0642" });
      await createAuditLog({ userId: ctx.user.id, action: "gate_entry_approved", entityType: "ticket", entityId: input.id });
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({ userId: mgr.id, title: "\u0623\u0635\u0644 \u0639\u0627\u062F \u0628\u0639\u062F \u0627\u0644\u0625\u0635\u0644\u0627\u062D", message: `\u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} - \u0627\u0644\u0623\u0635\u0644 \u0639\u0627\u062F \u0628\u0639\u062F \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u0627\u0644\u062E\u0627\u0631\u062C\u064A \u0648\u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u063A\u0644\u0627\u0642`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),
    // 9. Get tickets for gate security
    listForGate: gateSecurityProcedure.query(async () => {
      return getTickets({ status: "work_approved" });
    })
  }),
  // ============================================================
  // NFC / RFID SCANNING
  // ============================================================
  nfc: router({
    // Scan an NFC/RFID tag and return asset + location info
    scanTag: protectedProcedure.input(z3.object({
      rfidTag: z3.string().min(1, "\u064A\u062C\u0628 \u062A\u0648\u0641\u064A\u0631 \u0631\u0642\u0645 \u0627\u0644\u0631\u0642\u0627\u0642\u0629")
    })).mutation(async ({ input }) => {
      const asset = await getAssetByRfidTag(input.rfidTag);
      if (!asset) {
        throw new TRPCError5({
          code: "NOT_FOUND",
          message: "\u0627\u0644\u0623\u0635\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0631\u0642\u0627\u0642\u0629 \u0623\u0648\u0644\u0627\u064B."
        });
      }
      const site = asset.siteId ? await getSiteById(asset.siteId) : null;
      let section = null;
      if (asset.sectionId) {
        const sectionsList = await getSections();
        const found = sectionsList.find((s) => s.id === asset.sectionId);
        if (found) section = { id: found.id, name: found.name };
      }
      return {
        success: true,
        asset: {
          id: asset.id,
          assetNumber: asset.assetNumber,
          name: asset.name,
          description: asset.description,
          category: asset.category,
          brand: asset.brand,
          model: asset.model,
          serialNumber: asset.serialNumber,
          siteId: asset.siteId,
          sectionId: asset.sectionId,
          locationDetail: asset.locationDetail,
          photoUrl: asset.photoUrl,
          rfidTag: asset.rfidTag
        },
        site: site ? { id: site.id, name: site.name, address: site.address } : null,
        section
      };
    }),
    // Lookup asset by tag without mutation (for QR code or manual entry)
    lookupTag: protectedProcedure.input(z3.object({
      rfidTag: z3.string().min(1)
    })).query(async ({ input }) => {
      const asset = await getAssetByRfidTag(input.rfidTag);
      if (!asset) return null;
      const site = asset.siteId ? await getSiteById(asset.siteId) : null;
      return {
        asset: {
          id: asset.id,
          assetNumber: asset.assetNumber,
          name: asset.name,
          siteId: asset.siteId,
          locationDetail: asset.locationDetail,
          photoUrl: asset.photoUrl
        },
        site: site ? { id: site.id, name: site.name } : null
      };
    })
  }),
  // ============================================================
  // PURCHASE ORDERS
  // ============================================================
  purchaseOrders: router({
    list: protectedProcedure.input(z3.object({ status: z3.string().optional() }).optional()).query(async ({ input, ctx }) => {
      const role = ctx.user.role;
      let filters = input || {};
      if (role === "delegate") {
        const items = await getPOItemsByDelegate(ctx.user.id);
        const poIds = Array.from(new Set(items.map((i) => i.purchaseOrderId)));
        if (poIds.length === 0) return [];
        const allPOs = await getPurchaseOrders(filters);
        return allPOs.filter((po) => poIds.includes(po.id));
      }
      return getPurchaseOrders(filters);
    }),
    getById: protectedProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
      const po = await getPurchaseOrderById(input.id);
      if (!po) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const items = await getPOItems(input.id);
      return { ...po, items };
    }),
    create: protectedProcedure.input(z3.object({
      ticketId: z3.number().optional(),
      notes: z3.string().optional(),
      items: z3.array(z3.object({
        itemName: z3.string().min(1),
        description: z3.string().optional(),
        quantity: z3.number().min(1),
        unit: z3.string().optional(),
        photoUrl: z3.string().optional(),
        notes: z3.string().optional(),
        delegateId: z3.number().optional()
      }))
    })).mutation(async ({ input, ctx }) => {
      if (input.items.length === 0) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
      }
      if (input.items.length > 15) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: `\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 15 \u0635\u0646\u0641 \u0644\u0643\u0644 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621. \u0644\u062F\u064A\u0643 ${input.items.length} \u0635\u0646\u0641` });
      }
      const poNumber = await getNextPONumber();
      const poId = await createPurchaseOrder({
        poNumber,
        ticketId: input.ticketId,
        requestedById: ctx.user.id,
        status: "pending_estimate",
        notes: input.notes
      });
      const itemsData = input.items.map((item) => ({ ...item, purchaseOrderId: poId, status: "pending" }));
      await createPOItems(itemsData);
      if (input.ticketId) {
        const ticket = await getTicketById(input.ticketId);
        if (ticket) {
          await updateTicket(input.ticketId, { status: "needs_purchase" });
          await addTicketStatusHistory({ ticketId: input.ticketId, fromStatus: ticket.status, toStatus: "needs_purchase", changedById: ctx.user.id });
        }
      }
      const delegateIds = Array.from(new Set(input.items.filter((i) => i.delegateId).map((i) => i.delegateId)));
      for (const dId of delegateIds) {
        await createNotification({ userId: dId, title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F", message: `\u062A\u0645 \u062A\u062E\u0635\u064A\u0635 \u0623\u0635\u0646\u0627\u0641 \u0644\u0643 \u0641\u064A \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 ${poNumber}`, type: "info", relatedPOId: poId });
      }
      await createAuditLog({ userId: ctx.user.id, action: "create_po", entityType: "purchase_order", entityId: poId });
      return { id: poId, poNumber };
    }),
    update: protectedProcedure.input(z3.object({
      id: z3.number(),
      notes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const po = await getPurchaseOrderById(input.id);
      if (!po) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (!["pending_estimate", "pending_accounting"].includes(po.status)) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0645\u0639\u062A\u0645\u062F" });
      }
      const oldValues = { notes: po.notes };
      await updatePurchaseOrder(input.id, { notes: input.notes });
      await createAuditLog({ userId: ctx.user.id, action: "update_po", entityType: "purchase_order", entityId: input.id, oldValues, newValues: { notes: input.notes } });
      const poManagers = await getManagerUsers();
      for (const mgr of poManagers) {
        if (mgr.id !== ctx.user.id) {
          await createNotification({ userId: mgr.id, title: `\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 #${po.poNumber}`, message: `\u0642\u0627\u0645 ${ctx.user.name} \u0628\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621`, type: "po_updated", relatedPOId: input.id });
        }
      }
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const po = await getPurchaseOrderById(input.id);
      if (!po) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (!["owner", "admin", "maintenance_manager", "purchase_manager"].includes(ctx.user.role)) {
        throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062D\u0630\u0641 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0627\u0621" });
      }
      if (["funded", "partially_purchased", "completed"].includes(po.status)) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0645\u0645\u0648\u0651\u0644 \u0623\u0648 \u0645\u0643\u062A\u0645\u0644" });
      }
      await deletePurchaseOrder(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_po", entityType: "purchase_order", entityId: input.id, oldValues: { poNumber: po.poNumber, status: po.status, notes: po.notes } });
      const poDelManagers = await getManagerUsers();
      for (const mgr of poDelManagers) {
        if (mgr.id !== ctx.user.id) {
          await createNotification({ userId: mgr.id, title: `\u062D\u0630\u0641 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 #${po.poNumber}`, message: `\u0642\u0627\u0645 ${ctx.user.name} \u0628\u062D\u0630\u0641 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621`, type: "po_deleted", relatedPOId: input.id });
        }
      }
      return { success: true };
    }),
    editItem: protectedProcedure.input(z3.object({
      id: z3.number(),
      purchaseOrderId: z3.number(),
      itemName: z3.string().optional(),
      description: z3.string().optional(),
      quantity: z3.number().optional(),
      estimatedUnitCost: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const po = await getPurchaseOrderById(input.purchaseOrderId);
      if (!po) throw new TRPCError5({ code: "NOT_FOUND" });
      if (!["pending_estimate", "pending_accounting", "draft"].includes(po.status)) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0635\u0646\u0641 \u0641\u064A \u0637\u0644\u0628 \u0645\u0639\u062A\u0645\u062F \u0623\u0648 \u0645\u0645\u0648\u0644" });
      }
      const oldItem = await getPOItemById(input.id);
      if (!oldItem) throw new TRPCError5({ code: "NOT_FOUND" });
      const updates = {};
      if (input.itemName !== void 0) updates.itemName = input.itemName;
      if (input.description !== void 0) updates.description = input.description;
      if (input.quantity !== void 0) updates.quantity = input.quantity;
      if (input.estimatedUnitCost !== void 0) {
        updates.estimatedUnitCost = input.estimatedUnitCost;
        updates.estimatedTotalCost = String(parseFloat(input.estimatedUnitCost) * (input.quantity || oldItem.quantity));
      } else if (input.quantity !== void 0 && oldItem.estimatedUnitCost) {
        updates.estimatedTotalCost = String(parseFloat(oldItem.estimatedUnitCost) * input.quantity);
      }
      await updatePOItem(input.id, updates);
      await createAuditLog({
        userId: ctx.user.id,
        action: "update",
        entityType: "purchase_order_item",
        entityId: input.id,
        oldValues: { itemName: oldItem.itemName, description: oldItem.description, quantity: oldItem.quantity, estimatedUnitCost: oldItem.estimatedUnitCost },
        newValues: updates
      });
      return { success: true };
    }),
    deleteItem: protectedProcedure.input(z3.object({ id: z3.number(), purchaseOrderId: z3.number() })).mutation(async ({ input, ctx }) => {
      const po = await getPurchaseOrderById(input.purchaseOrderId);
      if (!po) throw new TRPCError5({ code: "NOT_FOUND" });
      if (!["pending_estimate", "pending_accounting"].includes(po.status)) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0635\u0646\u0641 \u0645\u0646 \u0637\u0644\u0628 \u0645\u0639\u062A\u0645\u062F" });
      }
      const item = await getPOItemById(input.id);
      await deletePOItem(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_po_item", entityType: "purchase_order_item", entityId: input.id, oldValues: { itemName: item?.itemName, quantity: item?.quantity } });
      return { success: true };
    }),
    // Delegate estimates cost
    estimateCost: delegateProcedure.input(z3.object({
      purchaseOrderId: z3.number(),
      items: z3.array(z3.object({
        id: z3.number(),
        estimatedUnitCost: z3.string()
      }))
    })).mutation(async ({ input, ctx }) => {
      let totalEstimated = 0;
      for (const item of input.items) {
        const cost = parseFloat(item.estimatedUnitCost);
        const poItem = (await getPOItems(input.purchaseOrderId)).find((i) => i.id === item.id);
        const totalCost = cost * (poItem?.quantity || 1);
        totalEstimated += totalCost;
        await updatePOItem(item.id, { estimatedUnitCost: item.estimatedUnitCost, estimatedTotalCost: String(totalCost), status: "estimated" });
      }
      const allItems = await getPOItems(input.purchaseOrderId);
      const allEstimated = allItems.every((i) => i.status !== "pending");
      if (allEstimated) {
        await updatePurchaseOrder(input.purchaseOrderId, { status: "pending_accounting", totalEstimatedCost: String(totalEstimated) });
        const accountants = await getUsersByRole("accountant");
        for (const acc of accountants) {
          await createNotification({ userId: acc.id, title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F", message: `\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A`, type: "warning", relatedPOId: input.purchaseOrderId });
        }
      }
      return { success: true };
    }),
    // Accounting approval
    approveAccounting: accountantProcedure.input(z3.object({
      id: z3.number(),
      notes: z3.string().optional(),
      custodyAmount: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      await updatePurchaseOrder(input.id, { status: "pending_management", accountingApprovedById: ctx.user.id, accountingApprovedAt: /* @__PURE__ */ new Date(), accountingNotes: input.notes, custodyAmount: input.custodyAmount || null });
      const mgmt = await getUsersByRole("senior_management");
      const po = await getPurchaseOrderById(input.id);
      const custodyMsg = input.custodyAmount ? ` \u0645\u0628\u0644\u063A \u0627\u0644\u0639\u0647\u062F\u0629: ${Number(input.custodyAmount).toLocaleString("ar-SA")} \u0631.\u0633.` : "";
      for (const m of mgmt) {
        await createNotification({ userId: m.id, title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F\u0643", message: `\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0631\u0642\u0645 ${po?.poNumber || input.id} \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0644\u064A\u0627.${custodyMsg}`, type: "warning", relatedPOId: input.id });
      }
      await createAuditLog({ userId: ctx.user.id, action: "approve_accounting", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),
    // Management approval
    approveManagement: managementProcedure.input(z3.object({
      id: z3.number(),
      notes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const po = await getPurchaseOrderById(input.id);
      await updatePurchaseOrder(input.id, { status: "approved", managementApprovedById: ctx.user.id, managementApprovedAt: /* @__PURE__ */ new Date(), managementNotes: input.notes });
      const items = await getPOItems(input.id);
      for (const item of items) {
        await updatePOItem(item.id, { status: "approved" });
      }
      const delegateIds = Array.from(new Set(items.filter((i) => i.delegateId).map((i) => i.delegateId)));
      for (const dId of delegateIds) {
        const delegateItems = items.filter((i) => i.delegateId === dId);
        const itemNames = delegateItems.map((i) => i.itemName).join("\u060C ");
        const custodyInfo = po?.custodyAmount ? ` \u0645\u0628\u0644\u063A \u0627\u0644\u0639\u0647\u062F\u0629 \u0627\u0644\u0645\u064F\u0635\u0631\u0641 \u0644\u0643: ${Number(po.custodyAmount).toLocaleString("ar-SA")} \u0631.\u0633.` : "";
        await createNotification({
          userId: dId,
          title: "\u2705 \u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 - \u0627\u0628\u062F\u0623 \u0627\u0644\u0634\u0631\u0627\u0621 \u0627\u0644\u0622\u0646",
          message: `\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u0631\u0642\u0645 ${po?.poNumber || input.id} \u0645\u0646 \u0642\u0650\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629. \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0645\u0646\u0643: ${itemNames}.${custodyInfo} \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0628\u062F\u0621 \u0628\u0627\u0644\u0634\u0631\u0627\u0621 \u0641\u0648\u0631\u0627\u064B.`,
          type: "success",
          relatedPOId: input.id
        });
      }
      if (delegateIds.length === 0) {
        const managers = await getManagerUsers();
        for (const mgr of managers) {
          await createNotification({
            userId: mgr.id,
            title: "\u2705 \u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621",
            message: `\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u0631\u0642\u0645 ${po?.poNumber || input.id}. \u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0646\u062F\u0648\u0628 \u0645\u064F\u0639\u064A\u064E\u0651\u0646 \u0644\u0644\u0623\u0635\u0646\u0627\u0641.`,
            type: "warning",
            relatedPOId: input.id
          });
        }
      }
      if (po?.ticketId) {
        await updateTicket(po.ticketId, { status: "purchase_approved" });
        await addTicketStatusHistory({ ticketId: po.ticketId, fromStatus: "purchase_pending_management", toStatus: "purchase_approved", changedById: ctx.user.id });
      }
      await createAuditLog({ userId: ctx.user.id, action: "approve_management", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),
    // Reject PO
    reject: protectedProcedure.input(z3.object({
      id: z3.number(),
      reason: z3.string().min(1)
    })).mutation(async ({ input, ctx }) => {
      const poReject = await getPurchaseOrderById(input.id);
      await updatePurchaseOrder(input.id, { status: "rejected", rejectedById: ctx.user.id, rejectedAt: /* @__PURE__ */ new Date(), rejectionReason: input.reason });
      if (poReject?.requestedById && poReject.requestedById !== ctx.user.id) {
        await createNotification({ userId: poReject.requestedById, title: "\u274C \u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621", message: `\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u0631\u0642\u0645 ${poReject.poNumber}. \u0627\u0644\u0633\u0628\u0628: ${input.reason}`, type: "critical", relatedPOId: input.id });
      }
      const managersReject = await getManagerUsers();
      for (const mgr of managersReject) {
        if (mgr.id !== ctx.user.id) {
          await createNotification({ userId: mgr.id, title: "\u274C \u0631\u0641\u0636 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621", message: `\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u0631\u0642\u0645 ${poReject?.poNumber || input.id}. \u0627\u0644\u0633\u0628\u0628: ${input.reason}`, type: "critical", relatedPOId: input.id });
        }
      }
      return { success: true };
    }),
    // ============ المرحلة 1: المندوب يؤكد شراء صنف ============
    confirmItemPurchase: delegateProcedure.input(z3.object({
      itemId: z3.number(),
      purchasedPhotoUrl: z3.string().min(1, "\u0635\u0648\u0631\u0629 \u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u0645\u0634\u062A\u0631\u0649 \u0645\u0637\u0644\u0648\u0628\u0629"),
      invoicePhotoUrl: z3.string().min(1, "\u0635\u0648\u0631\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0637\u0644\u0648\u0628\u0629")
    })).mutation(async ({ input, ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      let item;
      if (isAdminOrOwner) {
        item = await getPOItemById(input.itemId);
      } else {
        const allItems = await getPOItemsByDelegate(ctx.user.id);
        item = allItems.find((i) => i.id === input.itemId);
      }
      if (!item) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u063A\u064A\u0631 \u0645\u062E\u0635\u0635 \u0644\u0643" });
      if (item.status !== "approved" && item.status !== "funded") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0623\u0643\u064A\u062F \u0634\u0631\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0635\u0646\u0641 \u0641\u064A \u062D\u0627\u0644\u062A\u0647 \u0627\u0644\u062D\u0627\u0644\u064A\u0629" });
      }
      await updatePOItem(input.itemId, {
        status: "purchased",
        purchasedAt: /* @__PURE__ */ new Date(),
        purchasedById: ctx.user.id,
        purchasedPhotoUrl: input.purchasedPhotoUrl,
        invoicePhotoUrl: input.invoicePhotoUrl
      });
      const poItems = await getPOItems(item.purchaseOrderId);
      const purchasedOrLater = poItems.filter((i) => ["purchased", "delivered_to_warehouse", "delivered_to_requester"].includes(i.status));
      if (purchasedOrLater.length === poItems.length) {
        await updatePurchaseOrder(item.purchaseOrderId, { status: "purchased" });
        const po2 = await getPurchaseOrderById(item.purchaseOrderId);
        if (po2?.ticketId) {
          await updateTicket(po2.ticketId, { status: "purchased" });
        }
      } else if (purchasedOrLater.length > 0) {
        await updatePurchaseOrder(item.purchaseOrderId, { status: "partial_purchase" });
        const po2 = await getPurchaseOrderById(item.purchaseOrderId);
        if (po2?.ticketId) {
          await updateTicket(po2.ticketId, { status: "partial_purchase" });
        }
      }
      const warehouseUsers = await getUsersByRole("warehouse");
      const po = await getPurchaseOrderById(item.purchaseOrderId);
      const buyer = ctx.user;
      for (const w of warehouseUsers) {
        await createNotification({
          userId: w.id,
          title: "\u{1F4E6} \u0635\u0646\u0641 \u062A\u0645 \u0634\u0631\u0627\u0624\u0647 - \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645",
          message: `\u062A\u0645 \u0634\u0631\u0627\u0621 \u0627\u0644\u0635\u0646\u0641: "${item.itemName}" (\u0627\u0644\u0643\u0645\u064A\u0629: ${item.quantity} ${item.unit || ""}). \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u0631\u0642\u0645: ${po?.poNumber || item.purchaseOrderId}. \u0627\u0644\u0645\u0646\u062F\u0648\u0628: ${buyer.name}. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0639\u0646\u062F \u0648\u0635\u0648\u0644\u0647\u0627.`,
          type: "info",
          relatedPOId: item.purchaseOrderId
        });
      }
      const managers = await getManagerUsers();
      for (const mgr of managers) {
        await createNotification({
          userId: mgr.id,
          title: "\u{1F6D2} \u062A\u0645 \u0634\u0631\u0627\u0621 \u0635\u0646\u0641",
          message: `\u0642\u0627\u0645 ${buyer.name} \u0628\u0634\u0631\u0627\u0621 \u0635\u0646\u0641 "${item.itemName}" \u0645\u0646 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u0631\u0642\u0645 ${po?.poNumber || item.purchaseOrderId}.`,
          type: "info",
          relatedPOId: item.purchaseOrderId
        });
      }
      await createAuditLog({ userId: ctx.user.id, action: "confirm_purchase", entityType: "po_item", entityId: input.itemId });
      return { success: true };
    }),
    // ============ المرحلة 2: المستودع يؤكد التوريد ============
    confirmDeliveryToWarehouse: warehouseProcedure.input(z3.object({
      itemId: z3.number(),
      supplierName: z3.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0631\u062F \u0645\u0637\u0644\u0648\u0628"),
      supplierItemName: z3.string().optional(),
      actualUnitCost: z3.string().min(1, "\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628\u0629"),
      warehousePhotoUrl: z3.string().min(1, "\u0635\u0648\u0631\u0629 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628\u0629")
    })).mutation(async ({ input, ctx }) => {
      const item = await getPOItemById(input.itemId);
      if (!item) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (item.status !== "purchased") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: '\u0647\u0630\u0627 \u0627\u0644\u0635\u0646\u0641 \u0644\u064A\u0633 \u0641\u064A \u062D\u0627\u0644\u0629 "\u062A\u0645 \u0627\u0644\u0634\u0631\u0627\u0621" \u0628\u0639\u062F' });
      }
      const actualTotal = parseFloat(input.actualUnitCost) * item.quantity;
      await updatePOItem(input.itemId, {
        status: "delivered_to_warehouse",
        receivedAt: /* @__PURE__ */ new Date(),
        receivedById: ctx.user.id,
        supplierName: input.supplierName,
        supplierItemName: input.supplierItemName || item.itemName,
        actualUnitCost: input.actualUnitCost,
        actualTotalCost: String(actualTotal),
        warehousePhotoUrl: input.warehousePhotoUrl
      });
      const allItems = await getPOItems(item.purchaseOrderId);
      const allInWarehouse = allItems.every((i) => ["delivered_to_warehouse", "delivered_to_requester"].includes(i.status));
      if (allInWarehouse) {
        const totalActual = allItems.reduce((sum2, i) => sum2 + parseFloat(i.actualTotalCost || "0"), 0);
        await updatePurchaseOrder(item.purchaseOrderId, { status: "received", totalActualCost: String(totalActual) });
        const po = await getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          await updateTicket(po.ticketId, { status: "received_warehouse" });
        }
      }
      const poForNotif = await getPurchaseOrderById(item.purchaseOrderId);
      if (poForNotif?.ticketId) {
        const ticketForNotif = await getTicketById(poForNotif.ticketId);
        if (ticketForNotif?.assignedToId) {
          await createNotification({ userId: ticketForNotif.assignedToId, title: "\u{1F4E6} \u0648\u0635\u0644\u062A \u0645\u0648\u0627\u062F\u0643 \u0644\u0644\u0645\u0633\u062A\u0648\u062F\u0639", message: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0635\u0646\u0641 "${item.itemName}" \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639. \u0633\u064A\u062A\u0645 \u062A\u0633\u0644\u064A\u0645\u0647 \u0644\u0643 \u0642\u0631\u064A\u0628\u0627\u064B.`, type: "info", relatedTicketId: poForNotif.ticketId });
        }
      }
      const managersWH = await getManagerUsers();
      for (const mgr of managersWH) {
        await createNotification({ userId: mgr.id, title: "\u{1F4E6} \u0648\u0635\u0644\u062A \u0628\u0636\u0627\u0639\u0629 \u0644\u0644\u0645\u0633\u062A\u0648\u062F\u0639", message: `\u0627\u0633\u062A\u0644\u0645 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639 \u0627\u0644\u0635\u0646\u0641 "${item.itemName}" \u0628\u062A\u0643\u0644\u0641\u0629 \u0641\u0639\u0644\u064A\u0629 ${input.actualUnitCost} \u0631.\u0633 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062F ${input.supplierName}`, type: "info", relatedPOId: item.purchaseOrderId });
      }
      await createAuditLog({ userId: ctx.user.id, action: "deliver_to_warehouse", entityType: "po_item", entityId: input.itemId, newValues: { supplierName: input.supplierName, actualUnitCost: input.actualUnitCost } });
      return { success: true };
    }),
    // ============ المرحلة 3: المستودع يسلم الصنف للفني/المسؤول ============
    confirmDeliveryToRequester: warehouseProcedure.input(z3.object({
      itemId: z3.number(),
      deliveredToId: z3.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const item = await getPOItemById(input.itemId);
      if (!item) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (item.status !== "delivered_to_warehouse") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0635\u0646\u0641 \u0644\u0645 \u064A\u062A\u0645 \u062A\u0648\u0631\u064A\u062F\u0647 \u0644\u0644\u0645\u0633\u062A\u0648\u062F\u0639 \u0628\u0639\u062F" });
      }
      await updatePOItem(input.itemId, {
        status: "delivered_to_requester",
        deliveredAt: /* @__PURE__ */ new Date(),
        deliveredById: ctx.user.id,
        deliveredToId: input.deliveredToId || null
      });
      const allItems = await getPOItems(item.purchaseOrderId);
      const allDelivered = allItems.every((i) => i.status === "delivered_to_requester");
      if (allDelivered) {
        await updatePurchaseOrder(item.purchaseOrderId, { status: "closed" });
        const po = await getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          const ticket = await getTicketById(po.ticketId);
          if (ticket && ticket.status !== "closed") {
            await updateTicket(po.ticketId, { status: "repaired" });
            await addTicketStatusHistory({ ticketId: po.ticketId, fromStatus: ticket.status, toStatus: "repaired", changedById: ctx.user.id, notes: "\u062A\u0645 \u062A\u0633\u0644\u064A\u0645 \u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0648\u0627\u062F - \u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u063A\u0644\u0627\u0642" });
            const managers = await getManagerUsers();
            for (const mgr of managers) {
              await createNotification({ userId: mgr.id, title: "\u0628\u0644\u0627\u063A \u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u063A\u0644\u0627\u0642", message: `\u062A\u0645 \u062A\u0633\u0644\u064A\u0645 \u062C\u0645\u064A\u0639 \u0645\u0648\u0627\u062F \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber}. \u064A\u0645\u0643\u0646 \u0625\u063A\u0644\u0627\u0642\u0647 \u0627\u0644\u0622\u0646.`, type: "success", relatedTicketId: po.ticketId });
            }
          }
        }
      }
      await createAuditLog({ userId: ctx.user.id, action: "deliver_to_requester", entityType: "po_item", entityId: input.itemId });
      return { success: true };
    }),
    // Get items pending purchase (for delegate)
    pendingPurchaseItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner) {
        const approved = await getPOItemsByStatus("approved");
        const funded = await getPOItemsByStatus("funded");
        return [...approved, ...funded];
      }
      if (ctx.user.role !== "delegate") return [];
      const items = await getPOItemsByDelegate(ctx.user.id);
      return items.filter((i) => i.status === "approved" || i.status === "funded");
    }),
    // Get items pending warehouse receiving
    pendingWarehouseItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner || ctx.user.role === "warehouse") {
        return getPOItemsByStatus("purchased");
      }
      return [];
    }),
    // Get items pending delivery to requester
    pendingDeliveryItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner || ctx.user.role === "warehouse") {
        return getPOItemsByStatus("delivered_to_warehouse");
      }
      return [];
    }),
    myItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner) {
        return getAllPOItems();
      }
      if (ctx.user.role !== "delegate") return [];
      return getPOItemsByDelegate(ctx.user.id);
    })
  }),
  // ============================================================
  // INVENTORY
  // ============================================================
  inventory: router({
    list: protectedProcedure.query(async () => {
      return getInventoryItems();
    }),
    create: warehouseProcedure.input(z3.object({
      itemName: z3.string().min(1),
      description: z3.string().optional(),
      quantity: z3.number().default(0),
      unit: z3.string().optional(),
      minQuantity: z3.number().optional(),
      location: z3.string().optional(),
      siteId: z3.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const id = await createInventoryItem(input);
      await createAuditLog({ userId: ctx.user.id, action: "create_inventory", entityType: "inventory", entityId: id });
      return { id };
    }),
    update: warehouseProcedure.input(z3.object({
      id: z3.number(),
      itemName: z3.string().optional(),
      description: z3.string().optional(),
      unit: z3.string().optional(),
      minQuantity: z3.number().optional(),
      location: z3.string().optional(),
      siteId: z3.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const item = await getInventoryItemById(input.id);
      if (!item) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const { id, ...updateData } = input;
      const oldValues = { itemName: item.itemName, description: item.description, unit: item.unit, minQuantity: item.minQuantity, location: item.location };
      await updateInventoryItem(id, updateData);
      await createAuditLog({ userId: ctx.user.id, action: "update_inventory", entityType: "inventory", entityId: id, oldValues, newValues: updateData });
      return { success: true };
    }),
    delete: warehouseProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const item = await getInventoryItemById(input.id);
      if (!item) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      await deleteInventoryItem(input.id);
      await createAuditLog({ userId: ctx.user.id, action: "delete_inventory", entityType: "inventory", entityId: input.id, oldValues: { itemName: item.itemName, quantity: item.quantity } });
      return { success: true };
    }),
    addTransaction: protectedProcedure.input(z3.object({
      inventoryId: z3.number(),
      type: z3.enum(["in", "out"]),
      quantity: z3.number().min(1),
      reason: z3.string().optional(),
      ticketId: z3.number().optional()
    })).mutation(async ({ input, ctx }) => {
      await addInventoryTransaction({ ...input, performedById: ctx.user.id });
      return { success: true };
    })
  }),
  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserNotifications(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      await markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    })
  }),
  // ============================================================
  // FILE UPLOAD
  // ============================================================
  upload: router({
    getPresignedUrl: protectedProcedure.input(z3.object({
      fileName: z3.string(),
      contentType: z3.string(),
      entityType: z3.string(),
      entityId: z3.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const fileKey = `cmms/${input.entityType}/${Date.now()}-${nanoid(8)}-${input.fileName}`;
      return { fileKey, uploadUrl: `/api/upload` };
    })
  }),
  // ============================================================
  // ATTACHMENTS
  // ============================================================
  attachments: router({
    list: protectedProcedure.input(z3.object({
      entityType: z3.string(),
      entityId: z3.number()
    })).query(async ({ input }) => {
      return getAttachments(input.entityType, input.entityId);
    }),
    add: protectedProcedure.input(z3.object({
      entityType: z3.string(),
      entityId: z3.number(),
      fileName: z3.string(),
      fileUrl: z3.string(),
      fileKey: z3.string(),
      mimeType: z3.string().optional(),
      fileSize: z3.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const id = await createAttachment({
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        mimeType: input.mimeType || null,
        fileSize: input.fileSize || null,
        uploadedById: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "add_attachment",
        entityType: input.entityType,
        entityId: input.entityId,
        newValues: { fileName: input.fileName, mimeType: input.mimeType }
      });
      return { id };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      const attachment = await getAttachmentById(input.id);
      if (!attachment) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0631\u0641\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const canDelete = ["owner", "admin", "maintenance_manager"].includes(ctx.user.role) || attachment.uploadedById === ctx.user.id;
      if (!canDelete) throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u0641\u0642" });
      await deleteAttachment(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "delete_attachment",
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        oldValues: { fileName: attachment.fileName, mimeType: attachment.mimeType }
      });
      return { success: true };
    })
  }),
  // ============================================================
  // DASHBOARD
  // ============================================================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return getDashboardStats();
    }),
    pmMonthlySummary: protectedProcedure.query(async () => {
      const ddb = await getDb();
      if (!ddb) return { activePlans: 0, completedThisMonth: 0, pendingThisMonth: 0, overdueCount: 0, completionRate: 0, totalWorkOrders: 0 };
      const { preventivePlans: preventivePlans3, pmWorkOrders: pmWorkOrders2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const activePlans = await ddb.select().from(preventivePlans3).where(eq3(preventivePlans3.isActive, true));
      const now = /* @__PURE__ */ new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const allWOs = await ddb.select().from(pmWorkOrders2);
      const thisMonthWOs = allWOs.filter((wo) => {
        const d = new Date(wo.scheduledDate || wo.createdAt);
        return d >= monthStart && d <= monthEnd;
      });
      const completedThisMonth = thisMonthWOs.filter((wo) => wo.status === "completed").length;
      const pendingThisMonth = thisMonthWOs.filter((wo) => wo.status !== "completed" && wo.status !== "cancelled").length;
      const overdueCount = allWOs.filter((wo) => {
        if (wo.status === "completed" || wo.status === "cancelled") return false;
        const d = new Date(wo.scheduledDate || wo.createdAt);
        return d < now;
      }).length;
      const totalThisMonth = thisMonthWOs.length;
      const completionRate = totalThisMonth > 0 ? Math.round(completedThisMonth / totalThisMonth * 100) : 0;
      return {
        activePlans: activePlans.length,
        completedThisMonth,
        pendingThisMonth,
        overdueCount,
        completionRate,
        totalWorkOrders: totalThisMonth
      };
    })
  }),
  // ============================================================
  // REPORTS
  // ============================================================
  reports: router({
    ticketsByStatus: protectedProcedure.query(async () => {
      const allTickets = await getTickets();
      const statusCounts = {};
      allTickets.forEach((t2) => {
        statusCounts[t2.status] = (statusCounts[t2.status] || 0) + 1;
      });
      return Object.entries(statusCounts).map(([status, count2]) => ({ status, count: count2 }));
    }),
    ticketsByCategory: protectedProcedure.query(async () => {
      const allTickets = await getTickets();
      const catCounts = {};
      allTickets.forEach((t2) => {
        catCounts[t2.category] = (catCounts[t2.category] || 0) + 1;
      });
      return Object.entries(catCounts).map(([category, count2]) => ({ category, count: count2 }));
    }),
    ticketsByPriority: protectedProcedure.query(async () => {
      const allTickets = await getTickets();
      const priCounts = {};
      allTickets.forEach((t2) => {
        priCounts[t2.priority] = (priCounts[t2.priority] || 0) + 1;
      });
      return Object.entries(priCounts).map(([priority, count2]) => ({ priority, count: count2 }));
    }),
    costComparison: protectedProcedure.query(async () => {
      const pos = await getPurchaseOrders();
      return pos.map((po) => ({
        poNumber: po.poNumber,
        estimated: parseFloat(po.totalEstimatedCost || "0"),
        actual: parseFloat(po.totalActualCost || "0")
      }));
    }),
    monthlySummary: protectedProcedure.query(async () => {
      const allTickets = await getTickets();
      const monthly = {};
      allTickets.forEach((t2) => {
        const month = new Date(t2.createdAt).toISOString().slice(0, 7);
        if (!monthly[month]) monthly[month] = { created: 0, closed: 0 };
        monthly[month].created++;
        if (t2.status === "closed") monthly[month].closed++;
      });
      return Object.entries(monthly).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month));
    }),
    technicianPerformance: protectedProcedure.input(z3.object({
      period: z3.enum(["week", "month", "quarter", "year", "all", "custom"]).default("all"),
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional(),
      siteId: z3.number().optional(),
      sectionId: z3.number().optional(),
      technicianName: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      const period = input?.period || "all";
      let dateFrom;
      let dateTo;
      if (period === "custom" && input?.dateFrom && input?.dateTo) {
        dateFrom = new Date(input.dateFrom);
        dateTo = new Date(input.dateTo);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period !== "all") {
        dateTo = /* @__PURE__ */ new Date();
        dateFrom = /* @__PURE__ */ new Date();
        switch (period) {
          case "week":
            dateFrom.setDate(dateFrom.getDate() - 7);
            break;
          case "month":
            dateFrom.setMonth(dateFrom.getMonth() - 1);
            break;
          case "quarter":
            dateFrom.setMonth(dateFrom.getMonth() - 3);
            break;
          case "year":
            dateFrom.setFullYear(dateFrom.getFullYear() - 1);
            break;
        }
      }
      return getTechnicianPerformance({
        ...period !== "all" ? { dateFrom, dateTo } : {},
        siteId: input?.siteId,
        sectionId: input?.sectionId,
        technicianName: input?.technicianName
      });
    }),
    externalTechnicianPerformance: protectedProcedure.input(z3.object({
      period: z3.enum(["week", "month", "quarter", "year", "all", "custom"]).default("all"),
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      const period = input?.period || "all";
      let dateFrom;
      let dateTo;
      if (period === "custom" && input?.dateFrom && input?.dateTo) {
        dateFrom = new Date(input.dateFrom);
        dateTo = new Date(input.dateTo);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period !== "all") {
        dateTo = /* @__PURE__ */ new Date();
        dateFrom = /* @__PURE__ */ new Date();
        switch (period) {
          case "week":
            dateFrom.setDate(dateFrom.getDate() - 7);
            break;
          case "month":
            dateFrom.setMonth(dateFrom.getMonth() - 1);
            break;
          case "quarter":
            dateFrom.setMonth(dateFrom.getMonth() - 3);
            break;
          case "year":
            dateFrom.setFullYear(dateFrom.getFullYear() - 1);
            break;
        }
      }
      return getExternalTechnicianPerformance(period === "all" ? void 0 : { dateFrom, dateTo });
    }),
    // ── تقرير دورة الشراء ─────────────────────────────────────────────────────
    purchaseCycleReport: protectedProcedure.input(z3.object({
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional(),
      poId: z3.number().optional()
    }).optional()).query(async ({ input }) => {
      const [allPOs, allUsers, allItems] = await Promise.all([
        getPurchaseOrders(),
        getAllUsers(),
        getAllPOItems()
      ]);
      let pos = allPOs;
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom);
        pos = pos.filter((p) => new Date(p.createdAt) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo);
        to.setHours(23, 59, 59, 999);
        pos = pos.filter((p) => new Date(p.createdAt) <= to);
      }
      if (input?.poId) {
        pos = pos.filter((p) => p.id === input.poId);
      }
      const msToHours = (ms) => Math.round(ms / 36e5 * 10) / 10;
      const result = pos.map((po) => {
        const items = allItems.filter((i) => i.purchaseOrderId === po.id);
        const requestedBy = allUsers.find((u) => u.id === po.requestedById)?.name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
        const accountingApprovedBy = allUsers.find((u) => u.id === po.accountingApprovedById)?.name;
        const managementApprovedBy = allUsers.find((u) => u.id === po.managementApprovedById)?.name;
        const t0 = new Date(po.createdAt).getTime();
        const t1 = po.accountingApprovedAt ? new Date(po.accountingApprovedAt).getTime() : null;
        const t2 = po.managementApprovedAt ? new Date(po.managementApprovedAt).getTime() : null;
        const poPhases = [
          { phase: "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628", startAt: new Date(po.createdAt), endAt: po.accountingApprovedAt ? new Date(po.accountingApprovedAt) : null, durationHours: t1 ? msToHours(t1 - t0) : null, actor: requestedBy, status: "done" },
          { phase: "\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A", startAt: po.accountingApprovedAt ? new Date(po.accountingApprovedAt) : null, endAt: po.managementApprovedAt ? new Date(po.managementApprovedAt) : null, durationHours: t1 && t2 ? msToHours(t2 - t1) : null, actor: accountingApprovedBy || null, status: po.accountingApprovedAt ? "done" : "pending" },
          { phase: "\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629", startAt: po.managementApprovedAt ? new Date(po.managementApprovedAt) : null, endAt: null, durationHours: null, actor: managementApprovedBy || null, status: po.managementApprovedAt ? "done" : "pending" }
        ];
        const itemsReport = items.map((item) => {
          const delegate = allUsers.find((u) => u.id === item.delegateId)?.name || "\u063A\u064A\u0631 \u0645\u064F\u0639\u064A\u064E\u0651\u0646";
          const receivedBy = allUsers.find((u) => u.id === item.receivedById)?.name;
          const deliveredBy = allUsers.find((u) => u.id === item.deliveredById)?.name;
          const purchasedBy = allUsers.find((u) => u.id === item.purchasedById)?.name;
          const tCreated = new Date(item.createdAt).getTime();
          const tPurchased = item.purchasedAt ? new Date(item.purchasedAt).getTime() : null;
          const tReceived = item.receivedAt ? new Date(item.receivedAt).getTime() : null;
          const tDelivered = item.deliveredAt ? new Date(item.deliveredAt).getTime() : null;
          const phases = [
            { phase: "\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0633\u0639\u064A\u0631", startAt: new Date(item.createdAt), endAt: item.estimatedUnitCost ? new Date(item.updatedAt) : null, durationHours: item.estimatedUnitCost && t2 ? msToHours(t2 - tCreated) : null, status: item.estimatedUnitCost ? "done" : "pending" },
            { phase: "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0634\u0631\u0627\u0621", startAt: po.managementApprovedAt ? new Date(po.managementApprovedAt) : null, endAt: item.purchasedAt ? new Date(item.purchasedAt) : null, durationHours: t2 && tPurchased ? msToHours(tPurchased - t2) : null, status: item.purchasedAt ? "done" : po.managementApprovedAt ? "in_progress" : "pending" },
            { phase: "\u0634\u0631\u0627\u0621 \u0627\u0644\u0645\u0646\u062F\u0648\u0628", startAt: item.purchasedAt ? new Date(item.purchasedAt) : null, endAt: item.receivedAt ? new Date(item.receivedAt) : null, durationHours: tPurchased && tReceived ? msToHours(tReceived - tPurchased) : null, actor: purchasedBy || delegate, status: item.purchasedAt ? "done" : "pending" },
            { phase: "\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639", startAt: item.receivedAt ? new Date(item.receivedAt) : null, endAt: item.deliveredAt ? new Date(item.deliveredAt) : null, durationHours: tReceived && tDelivered ? msToHours(tDelivered - tReceived) : null, actor: receivedBy || null, status: item.receivedAt ? "done" : "pending" },
            { phase: "\u062A\u0633\u0644\u064A\u0645 \u0644\u0644\u0641\u0646\u064A", startAt: item.deliveredAt ? new Date(item.deliveredAt) : null, endAt: null, durationHours: null, actor: deliveredBy || null, status: item.deliveredAt ? "done" : "pending" }
          ];
          const totalHours = tDelivered ? msToHours(tDelivered - tCreated) : null;
          return {
            itemId: item.id,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            delegate,
            estimatedCost: item.estimatedTotalCost ? parseFloat(item.estimatedTotalCost) : null,
            actualCost: item.actualTotalCost ? parseFloat(item.actualTotalCost) : null,
            currentStatus: item.status,
            totalHours,
            phases
          };
        });
        const completedItems = itemsReport.filter((i) => i.totalHours !== null);
        const totalPOHours = completedItems.length > 0 ? Math.round(completedItems.reduce((s, i) => s + (i.totalHours || 0), 0) / completedItems.length * 10) / 10 : null;
        return {
          poId: po.id,
          poNumber: po.poNumber,
          status: po.status,
          requestedBy,
          createdAt: new Date(po.createdAt),
          ticketId: po.ticketId,
          custodyAmount: po.custodyAmount ? parseFloat(po.custodyAmount) : null,
          poPhases,
          items: itemsReport,
          totalPOHours,
          itemCount: items.length
        };
      });
      const completedPOs = result.filter((r) => r.totalPOHours !== null);
      const avgTotalHours = completedPOs.length > 0 ? Math.round(completedPOs.reduce((s, r) => s + (r.totalPOHours || 0), 0) / completedPOs.length * 10) / 10 : null;
      const phaseNames = ["\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0633\u0639\u064A\u0631", "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0634\u0631\u0627\u0621", "\u0634\u0631\u0627\u0621 \u0627\u0644\u0645\u0646\u062F\u0648\u0628", "\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639", "\u062A\u0633\u0644\u064A\u0645 \u0644\u0644\u0641\u0646\u064A"];
      const phaseAvgs = phaseNames.map((phaseName) => {
        const durations = result.flatMap((r) => r.items.flatMap((i) => i.phases.filter((p) => p.phase === phaseName && p.durationHours !== null).map((p) => p.durationHours)));
        return { phase: phaseName, avgHours: durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length * 10) / 10 : null, count: durations.length };
      });
      return { pos: result, avgTotalHours, phaseAvgs, total: result.length };
    }),
    // ── تقرير دورة الصيانة ────────────────────────────────────────────────────
    maintenanceCycleReport: protectedProcedure.input(z3.object({
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional(),
      ticketId: z3.number().optional(),
      status: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      const [allTickets, allUsers, allSites] = await Promise.all([
        getTickets(),
        getAllUsers(),
        getAllSites()
      ]);
      let tickets2 = allTickets;
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom);
        tickets2 = tickets2.filter((t2) => new Date(t2.createdAt) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo);
        to.setHours(23, 59, 59, 999);
        tickets2 = tickets2.filter((t2) => new Date(t2.createdAt) <= to);
      }
      if (input?.ticketId) {
        tickets2 = tickets2.filter((t2) => t2.id === input.ticketId);
      }
      if (input?.status) {
        tickets2 = tickets2.filter((t2) => t2.status === input.status);
      }
      const msToHours = (ms) => Math.round(ms / 36e5 * 10) / 10;
      const STAGE_LABELS = {
        "new": "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0644\u0627\u063A",
        "pending_triage": "\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0641\u0631\u0632",
        "under_inspection": "\u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635",
        "work_approved": "\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0639\u0645\u0644",
        "approved": "\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
        "assigned": "\u062A\u0639\u064A\u064A\u0646 \u0641\u0646\u064A",
        "in_progress": "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630",
        "needs_purchase": "\u064A\u062D\u062A\u0627\u062C \u0634\u0631\u0627\u0621",
        "purchase_pending_estimate": "\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0633\u0639\u064A\u0631",
        "purchase_pending_accounting": "\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A",
        "purchase_pending_management": "\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
        "purchase_approved": "\u0634\u0631\u0627\u0621 \u0645\u0639\u062A\u0645\u062F",
        "partial_purchase": "\u0634\u0631\u0627\u0621 \u062C\u0632\u0626\u064A",
        "purchased": "\u062A\u0645 \u0627\u0644\u0634\u0631\u0627\u0621",
        "received_warehouse": "\u0627\u0633\u062A\u0644\u0627\u0645 \u0645\u0633\u062A\u0648\u062F\u0639",
        "repaired": "\u062A\u0645 \u0627\u0644\u0625\u0635\u0644\u0627\u062D",
        "verified": "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642",
        "ready_for_closure": "\u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u063A\u0644\u0627\u0642",
        "out_for_repair": "\u062E\u0627\u0631\u062C \u0644\u0644\u0625\u0635\u0644\u0627\u062D",
        "closed": "\u0645\u063A\u0644\u0642"
      };
      const ticketHistories = await Promise.all(tickets2.map((t2) => getTicketHistory(t2.id).then((h) => ({ ticketId: t2.id, history: h }))));
      const historyMap = new Map(ticketHistories.map((th) => [th.ticketId, th.history]));
      const result = tickets2.map((ticket) => {
        const history = historyMap.get(ticket.id) || [];
        const sortedHistory = [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const reportedBy = allUsers.find((u) => u.id === ticket.reportedById)?.name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
        const assignedTo = allUsers.find((u) => u.id === ticket.assignedToId)?.name || "\u063A\u064A\u0631 \u0645\u0633\u0646\u062F";
        const site = allSites.find((s) => s.id === ticket.siteId)?.name || "";
        const phases = [];
        for (let i = 0; i < sortedHistory.length; i++) {
          const entry = sortedHistory[i];
          const nextEntry = sortedHistory[i + 1];
          const startAt = new Date(entry.createdAt);
          const endAt = nextEntry ? new Date(nextEntry.createdAt) : ticket.closedAt ? new Date(ticket.closedAt) : null;
          const durationHours = endAt ? msToHours(endAt.getTime() - startAt.getTime()) : null;
          phases.push({
            fromStatus: entry.fromStatus || "",
            toStatus: entry.toStatus,
            label: STAGE_LABELS[entry.toStatus] || entry.toStatus,
            startAt,
            endAt,
            durationHours,
            changedBy: allUsers.find((u) => u.id === entry.changedById)?.name || "\u0627\u0644\u0646\u0638\u0627\u0645"
          });
        }
        const createdAt = new Date(ticket.createdAt);
        const endTime = ticket.closedAt ? new Date(ticket.closedAt) : /* @__PURE__ */ new Date();
        const totalHours = msToHours(endTime.getTime() - createdAt.getTime());
        const totalDays = Math.round(totalHours / 24 * 10) / 10;
        const maxPhase = phases.reduce((max, p) => {
          if (p.durationHours !== null && (max === null || p.durationHours > (max.durationHours || 0))) return p;
          return max;
        }, null);
        return {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          site,
          reportedBy,
          assignedTo,
          maintenancePath: ticket.maintenancePath,
          createdAt: new Date(ticket.createdAt),
          closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
          totalHours,
          totalDays,
          phases,
          bottleneck: maxPhase ? { phase: maxPhase.label, hours: maxPhase.durationHours } : null,
          isClosed: ticket.status === "closed"
        };
      });
      const closedTickets = result.filter((r) => r.isClosed);
      const avgTotalHours = closedTickets.length > 0 ? Math.round(closedTickets.reduce((s, r) => s + r.totalHours, 0) / closedTickets.length * 10) / 10 : null;
      const allPhaseLabelsSet = new Set(result.flatMap((r) => r.phases.map((p) => p.label)));
      const allPhaseLabels = Array.from(allPhaseLabelsSet);
      const phaseAvgs = allPhaseLabels.map((label) => {
        const durations = result.flatMap((r) => r.phases.filter((p) => p.label === label && p.durationHours !== null).map((p) => p.durationHours));
        return { phase: label, avgHours: durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length * 10) / 10 : null, count: durations.length };
      }).filter((p) => p.avgHours !== null).sort((a, b) => (b.avgHours || 0) - (a.avgHours || 0));
      return { tickets: result, avgTotalHours, avgTotalDays: avgTotalHours ? Math.round(avgTotalHours / 24 * 10) / 10 : null, phaseAvgs, total: result.length, closedCount: closedTickets.length };
    }),
    sectionReport: protectedProcedure.input(z3.object({
      siteId: z3.number().optional(),
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      const allSections = await getSections();
      const allTickets = await getTickets({});
      const allAssets = await listAssets({});
      const allPMWorkOrders = await listPMWorkOrders();
      const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : null;
      const dateTo = input?.dateTo ? new Date(input.dateTo) : null;
      const filteredTickets = allTickets.filter((t2) => {
        if (input?.siteId && t2.siteId !== input.siteId) return false;
        if (dateFrom && new Date(t2.createdAt) < dateFrom) return false;
        if (dateTo && new Date(t2.createdAt) > dateTo) return false;
        return true;
      });
      const filteredPMWOs = allPMWorkOrders.filter((wo) => {
        if (dateFrom && new Date(wo.scheduledDate) < dateFrom) return false;
        if (dateTo && new Date(wo.scheduledDate) > dateTo) return false;
        return true;
      });
      const assetSectionMap = /* @__PURE__ */ new Map();
      allAssets.forEach((a) => assetSectionMap.set(a.id, a.sectionId ?? null));
      const sectionStats = allSections.filter((s) => !input?.siteId || s.siteId === input.siteId).map((section) => {
        const sectionTickets = filteredTickets.filter((t2) => t2.sectionId === section.id);
        const sectionAssets = allAssets.filter((a) => a.sectionId === section.id);
        const openTickets = sectionTickets.filter((t2) => t2.status !== "closed").length;
        const closedTickets = sectionTickets.filter((t2) => t2.status === "closed").length;
        const urgentTickets = sectionTickets.filter((t2) => t2.priority === "critical" || t2.priority === "high").length;
        const maintenanceCost = sectionTickets.reduce((sum2, t2) => {
          return sum2 + (parseFloat(t2.estimatedCost || "0") || 0);
        }, 0);
        const avgCloseTime = (() => {
          const closed = sectionTickets.filter((t2) => t2.status === "closed" && t2.closedAt && t2.createdAt);
          if (!closed.length) return null;
          const totalHours = closed.reduce((sum2, t2) => {
            return sum2 + (new Date(t2.closedAt).getTime() - new Date(t2.createdAt).getTime()) / (1e3 * 60 * 60);
          }, 0);
          return Math.round(totalHours / closed.length * 10) / 10;
        })();
        const sectionPMWOs = filteredPMWOs.filter((wo) => {
          if (wo.assetId && assetSectionMap.get(wo.assetId) === section.id) return true;
          return false;
        });
        const preventiveCount = sectionPMWOs.length;
        const preventiveCompleted = sectionPMWOs.filter((wo) => wo.status === "completed").length;
        return {
          sectionId: section.id,
          sectionName: section.name,
          siteId: section.siteId,
          totalTickets: sectionTickets.length,
          openTickets,
          closedTickets,
          urgentTickets,
          totalAssets: sectionAssets.length,
          maintenanceCost: Math.round(maintenanceCost * 100) / 100,
          avgCloseTimeHours: avgCloseTime,
          preventiveCount,
          preventiveCompleted,
          emergencyCount: sectionTickets.length
          // البلاغات هي الصيانة الطارئة
        };
      }).sort((a, b) => b.totalTickets - a.totalTickets);
      const unassigned = filteredTickets.filter((t2) => !t2.sectionId);
      return { sections: sectionStats, unassignedTickets: unassigned.length, totalTickets: filteredTickets.length };
    }),
    // تقرير التكاليف البصري: حسب القسم والموقع مع فلاتر زمنية
    costReport: protectedProcedure.input(z3.object({
      groupBy: z3.enum(["section", "site"]).default("site"),
      period: z3.enum(["month", "quarter", "year", "all", "custom"]).default("all"),
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      const groupBy = input?.groupBy ?? "site";
      const period = input?.period ?? "all";
      let dateFrom;
      let dateTo;
      if (period === "custom" && input?.dateFrom && input?.dateTo) {
        dateFrom = new Date(input.dateFrom);
        dateTo = new Date(input.dateTo);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period !== "all") {
        dateTo = /* @__PURE__ */ new Date();
        dateFrom = /* @__PURE__ */ new Date();
        if (period === "month") dateFrom.setMonth(dateFrom.getMonth() - 1);
        else if (period === "quarter") dateFrom.setMonth(dateFrom.getMonth() - 3);
        else if (period === "year") dateFrom.setFullYear(dateFrom.getFullYear() - 1);
      }
      const [allTickets, allSites, allSections, allPOs, allPOItems] = await Promise.all([
        getTickets({}),
        getAllSites(),
        getSections(),
        getPurchaseOrders(),
        getAllPOItems()
      ]);
      const filteredTickets = allTickets.filter((t2) => {
        if (dateFrom && new Date(t2.createdAt) < dateFrom) return false;
        if (dateTo && new Date(t2.createdAt) > dateTo) return false;
        return true;
      });
      const deliveredItems = allPOItems.filter((item) => {
        if (item.status !== "delivered_to_warehouse" && item.status !== "delivered_to_requester") return false;
        const dateRef = item.deliveredAt || item.receivedAt || item.createdAt;
        if (dateFrom && new Date(dateRef) < dateFrom) return false;
        if (dateTo && new Date(dateRef) > dateTo) return false;
        return true;
      });
      const poMap = /* @__PURE__ */ new Map();
      allPOs.forEach((po) => poMap.set(po.id, { siteId: po.siteId ?? null, sectionId: po.sectionId ?? null }));
      const monthlyTrend = [];
      for (let i = 11; i >= 0; i--) {
        const d = /* @__PURE__ */ new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const monthKey = d.toISOString().slice(0, 7);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const monthNames = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        const ticketCost = allTickets.filter((t2) => {
          const c = new Date(t2.createdAt);
          return c >= monthStart && c <= monthEnd;
        }).reduce((sum2, t2) => sum2 + parseFloat(t2.actualCost || t2.estimatedCost || "0"), 0);
        const purchaseCost = allPOItems.filter((item) => {
          if (item.status !== "delivered_to_warehouse" && item.status !== "delivered_to_requester") return false;
          const dateRef = item.deliveredAt || item.receivedAt || item.createdAt;
          const c = new Date(dateRef);
          return c >= monthStart && c <= monthEnd;
        }).reduce((sum2, item) => sum2 + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
        monthlyTrend.push({ month: monthKey, label, ticketCost: Math.round(ticketCost * 100) / 100, purchaseCost: Math.round(purchaseCost * 100) / 100, total: Math.round((ticketCost + purchaseCost) * 100) / 100 });
      }
      let groups = [];
      if (groupBy === "site") {
        groups = allSites.map((site) => {
          const siteTickets = filteredTickets.filter((t2) => t2.siteId === site.id);
          const siteItems = deliveredItems.filter((item) => poMap.get(item.purchaseOrderId)?.siteId === site.id);
          const ticketCost = siteTickets.reduce((sum2, t2) => sum2 + parseFloat(t2.actualCost || t2.estimatedCost || "0"), 0);
          const purchaseCost = siteItems.reduce((sum2, item) => sum2 + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
          const ticketsNoCost = siteTickets.filter((t2) => !t2.actualCost && !t2.estimatedCost).length;
          return { id: site.id, name: site.name, ticketCost: Math.round(ticketCost * 100) / 100, purchaseCost: Math.round(purchaseCost * 100) / 100, totalCost: Math.round((ticketCost + purchaseCost) * 100) / 100, ticketCount: siteTickets.length, ticketsNoCost, percentage: 0 };
        });
        const unclassifiedTickets = filteredTickets.filter((t2) => !t2.siteId);
        const unclassifiedItems = deliveredItems.filter((item) => !poMap.get(item.purchaseOrderId)?.siteId);
        const unclassifiedTicketCost = unclassifiedTickets.reduce((sum2, t2) => sum2 + parseFloat(t2.actualCost || t2.estimatedCost || "0"), 0);
        const unclassifiedPurchaseCost = unclassifiedItems.reduce((sum2, item) => sum2 + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
        const unclassifiedTotal = unclassifiedTicketCost + unclassifiedPurchaseCost;
        if (unclassifiedTotal > 0 || unclassifiedTickets.length > 0) {
          groups.push({ id: -1, name: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F", ticketCost: Math.round(unclassifiedTicketCost * 100) / 100, purchaseCost: Math.round(unclassifiedPurchaseCost * 100) / 100, totalCost: Math.round(unclassifiedTotal * 100) / 100, ticketCount: unclassifiedTickets.length, ticketsNoCost: unclassifiedTickets.filter((t2) => !t2.actualCost && !t2.estimatedCost).length, percentage: 0, isUnclassified: true });
        }
      } else {
        groups = allSections.map((section) => {
          const secTickets = filteredTickets.filter((t2) => t2.sectionId === section.id);
          const secItems = deliveredItems.filter((item) => poMap.get(item.purchaseOrderId)?.sectionId === section.id);
          const ticketCost = secTickets.reduce((sum2, t2) => sum2 + parseFloat(t2.actualCost || t2.estimatedCost || "0"), 0);
          const purchaseCost = secItems.reduce((sum2, item) => sum2 + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
          const siteName = allSites.find((s) => s.id === section.siteId)?.name ?? "";
          const ticketsNoCost = secTickets.filter((t2) => !t2.actualCost && !t2.estimatedCost).length;
          return { id: section.id, name: section.name, siteName, ticketCost: Math.round(ticketCost * 100) / 100, purchaseCost: Math.round(purchaseCost * 100) / 100, totalCost: Math.round((ticketCost + purchaseCost) * 100) / 100, ticketCount: secTickets.length, ticketsNoCost, percentage: 0 };
        });
        const unclassifiedTickets = filteredTickets.filter((t2) => !t2.sectionId);
        const unclassifiedItems = deliveredItems.filter((item) => !poMap.get(item.purchaseOrderId)?.sectionId);
        const unclassifiedTicketCost = unclassifiedTickets.reduce((sum2, t2) => sum2 + parseFloat(t2.actualCost || t2.estimatedCost || "0"), 0);
        const unclassifiedPurchaseCost = unclassifiedItems.reduce((sum2, item) => sum2 + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
        const unclassifiedTotal = unclassifiedTicketCost + unclassifiedPurchaseCost;
        if (unclassifiedTotal > 0 || unclassifiedTickets.length > 0) {
          groups.push({ id: -1, name: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F", ticketCost: Math.round(unclassifiedTicketCost * 100) / 100, purchaseCost: Math.round(unclassifiedPurchaseCost * 100) / 100, totalCost: Math.round(unclassifiedTotal * 100) / 100, ticketCount: unclassifiedTickets.length, ticketsNoCost: unclassifiedTickets.filter((t2) => !t2.actualCost && !t2.estimatedCost).length, percentage: 0, isUnclassified: true });
        }
      }
      groups = groups.sort((a, b) => b.totalCost - a.totalCost);
      const grandTotal = groups.reduce((sum2, g) => sum2 + g.totalCost, 0);
      groups = groups.map((g) => ({ ...g, percentage: grandTotal > 0 ? Math.round(g.totalCost / grandTotal * 1e3) / 10 : 0 }));
      const totalTicketsNoCost = filteredTickets.filter((t2) => !t2.actualCost && !t2.estimatedCost).length;
      return { groups, grandTotal: Math.round(grandTotal * 100) / 100, monthlyTrend, groupBy, totalTicketsNoCost };
    }),
    // تقرير أداء الفني الشهري: فحوصات + معدل اكتشاف الأعطال
    technicianMonthlyReport: protectedProcedure.input(z3.object({
      monthsBack: z3.number().min(1).max(12).default(6)
    }).optional()).query(async () => {
      const ddb = await getDb();
      if (!ddb) return { technicians: [], months: [] };
      const { pmExecutionSessions: execSessions, pmExecutionResults: execResults } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const allUsers = await getAllUsers();
      const technicians2 = allUsers.filter((u) => u.role === "technician");
      const sessions = await ddb.select().from(execSessions).where(eq3(execSessions.status, "completed"));
      const results = await ddb.select().from(execResults);
      const allTickets = await getTickets({});
      const pmSourceTickets = allTickets.filter(
        (t2) => t2.description && t2.description.includes("\u0635\u064A\u0627\u0646\u0629 \u062F\u0648\u0631\u064A\u0629")
      );
      const months = [];
      const now = /* @__PURE__ */ new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const technicianData = technicians2.map((tech) => {
        const techSessions = sessions.filter((s) => s.technicianId === tech.id);
        const monthlyData = months.map((month) => {
          const [y, m] = month.split("-").map(Number);
          const monthSessions = techSessions.filter((s) => {
            const d = new Date(s.completedAt || s.startedAt);
            return d.getFullYear() === y && d.getMonth() + 1 === m;
          });
          const sessionIds = monthSessions.map((s) => s.id);
          const sessionResults = results.filter((r) => sessionIds.includes(r.sessionId));
          const defectCount = sessionResults.filter((r) => r.status === "defect").length;
          const totalItems2 = sessionResults.length;
          const monthTickets = pmSourceTickets.filter((t2) => {
            const d = new Date(t2.createdAt);
            return d.getFullYear() === y && d.getMonth() + 1 === m && t2.assignedToId === tech.id;
          });
          return {
            month,
            inspections: monthSessions.length,
            defectsFound: defectCount,
            totalItems: totalItems2,
            ticketsFromPM: monthTickets.length,
            detectionRate: totalItems2 > 0 ? Math.round(defectCount / totalItems2 * 100) : 0
          };
        });
        const totalInspections = techSessions.length;
        const totalDefects = results.filter(
          (r) => techSessions.some((s) => s.id === r.sessionId) && r.status === "defect"
        ).length;
        const totalItems = results.filter(
          (r) => techSessions.some((s) => s.id === r.sessionId)
        ).length;
        return {
          technicianId: tech.id,
          technicianName: tech.name,
          role: tech.role,
          totalInspections,
          totalDefects,
          overallDetectionRate: totalItems > 0 ? Math.round(totalDefects / totalItems * 100) : 0,
          monthlyData
        };
      });
      return { technicians: technicianData, months };
    })
  }),
  // ============================================================
  // AI INSIGHTS
  // ============================================================
  ai: router({
    analyze: protectedProcedure.input(z3.object({
      question: z3.string(),
      conversationHistory: z3.array(z3.object({
        role: z3.enum(["user", "assistant"]),
        content: z3.string()
      })).optional()
    })).mutation(async ({ input, ctx }) => {
      const [tickets2, pos, inventoryItems, allUsers, allSites, stats, recentAudit] = await Promise.all([
        getTickets(),
        getPurchaseOrders(),
        getInventoryItems(),
        getAllUsers(),
        getAllSites(),
        getDashboardStats(),
        getAuditLogsEnhanced({ limit: 50 })
      ]);
      const ticketsByStatus = tickets2.reduce((acc, t2) => {
        acc[t2.status] = (acc[t2.status] || 0) + 1;
        return acc;
      }, {});
      const ticketsByPriority = tickets2.reduce((acc, t2) => {
        acc[t2.priority] = (acc[t2.priority] || 0) + 1;
        return acc;
      }, {});
      const ticketsByCategory = tickets2.reduce((acc, t2) => {
        acc[t2.category] = (acc[t2.category] || 0) + 1;
        return acc;
      }, {});
      const ticketsBySite = tickets2.reduce((acc, t2) => {
        const site = allSites.find((s) => s.id === t2.siteId);
        acc[site?.name || `\u0645\u0648\u0642\u0639 #${t2.siteId}`] = (acc[site?.name || `\u0645\u0648\u0642\u0639 #${t2.siteId}`] || 0) + 1;
        return acc;
      }, {});
      const posByStatus = pos.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});
      const totalPOCost = pos.reduce((sum2, p) => sum2 + parseFloat(p.totalEstimatedCost || "0"), 0);
      const totalActualCost = pos.reduce((sum2, p) => sum2 + parseFloat(p.totalActualCost || "0"), 0);
      const lowStockItems = inventoryItems.filter((i) => i.quantity <= i.minQuantity);
      const recentTickets = tickets2.slice(0, 20).map((t2) => ({
        id: t2.id,
        ticketNumber: t2.ticketNumber,
        title: t2.title,
        description: t2.description,
        status: t2.status,
        priority: t2.priority,
        category: t2.category,
        assignedTo: allUsers.find((u) => u.id === t2.assignedToId)?.name || "\u063A\u064A\u0631 \u0645\u0633\u0646\u062F",
        reportedBy: allUsers.find((u) => u.id === t2.reportedById)?.name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641",
        site: allSites.find((s) => s.id === t2.siteId)?.name || "",
        createdAt: new Date(t2.createdAt).toLocaleDateString("ar-SA")
      }));
      const recentPOs = pos.slice(0, 20).map((p) => ({
        id: p.id,
        poNumber: p.poNumber,
        status: p.status,
        estimatedCost: p.totalEstimatedCost,
        actualCost: p.totalActualCost,
        requestedBy: allUsers.find((u) => u.id === p.requestedById)?.name || "",
        createdAt: new Date(p.createdAt).toLocaleDateString("ar-SA")
      }));
      const dbContext = `
=== \u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 (CMMS) - \u0645\u062D\u062F\u062B\u0629 \u0627\u0644\u0622\u0646 ===

\u0640\u0640\u0640 \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0639\u0627\u0645\u0629 \u0640\u0640\u0640
\u2022 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A: ${tickets2.length}
\u2022 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A \u0627\u0644\u0645\u0641\u062A\u0648\u062D\u0629: ${stats?.openTickets || 0}
\u2022 \u0627\u0644\u0645\u063A\u0644\u0642\u0629 \u0627\u0644\u064A\u0648\u0645: ${stats?.closedToday || 0}
\u2022 \u0627\u0644\u062D\u0631\u062C\u0629: ${stats?.criticalTickets || 0}
\u2022 \u0637\u0644\u0628\u0627\u062A \u0634\u0631\u0627\u0621 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F: ${stats?.pendingApprovals || 0}
\u2022 \u0625\u062C\u0645\u0627\u0644\u064A \u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629: ${stats?.totalMaintenanceCost || 0} \u0631.\u0633

\u0640\u0640\u0640 \u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A \u0640\u0640\u0640
\u062D\u0633\u0628 \u0627\u0644\u062D\u0627\u0644\u0629: ${JSON.stringify(ticketsByStatus)}
\u062D\u0633\u0628 \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629: ${JSON.stringify(ticketsByPriority)}
\u062D\u0633\u0628 \u0627\u0644\u0641\u0626\u0629: ${JSON.stringify(ticketsByCategory)}
\u062D\u0633\u0628 \u0627\u0644\u0645\u0648\u0642\u0639: ${JSON.stringify(ticketsBySite)}

\u0640\u0640\u0640 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0627\u0621 \u0640\u0640\u0640
\u0625\u062C\u0645\u0627\u0644\u064A \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0627\u0621: ${pos.length}
\u062D\u0633\u0628 \u0627\u0644\u062D\u0627\u0644\u0629: ${JSON.stringify(posByStatus)}
\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0642\u062F\u0631\u0629: ${totalPOCost.toFixed(2)} \u0631.\u0633
\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0641\u0639\u0644\u064A\u0629: ${totalActualCost.toFixed(2)} \u0631.\u0633

\u0640\u0640\u0640 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0640\u0640\u0640
\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0635\u0646\u0627\u0641: ${inventoryItems.length}
\u0623\u0635\u0646\u0627\u0641 \u0645\u0646\u062E\u0641\u0636\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646: ${lowStockItems.length}
${lowStockItems.length > 0 ? `\u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0646\u062E\u0641\u0636\u0629: ${lowStockItems.map((i) => `${i.itemName} (\u0627\u0644\u0643\u0645\u064A\u0629: ${i.quantity}, \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649: ${i.minQuantity})`).join(" | ")}` : ""}
\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646: ${JSON.stringify(inventoryItems.map((i) => ({ name: i.itemName, qty: i.quantity, min: i.minQuantity, unit: i.unit, location: i.location })))}

\u0640\u0640\u0640 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0648\u0646 \u0640\u0640\u0640
\u0625\u062C\u0645\u0627\u0644\u064A: ${allUsers.length}
\u0627\u0644\u0642\u0627\u0626\u0645\u0629: ${allUsers.map((u) => `${u.name} (\u0627\u0644\u062F\u0648\u0631: ${u.role}, \u0627\u0644\u0642\u0633\u0645: ${u.department || "-"})`).join(" | ")}

\u0640\u0640\u0640 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0640\u0640\u0640
${allSites.map((s) => `${s.name}: ${s.address || "-"}`).join(" | ")}

\u0640\u0640\u0640 \u0622\u062E\u0631 20 \u0628\u0644\u0627\u063A \u0640\u0640\u0640
${JSON.stringify(recentTickets, null, 0)}

\u0640\u0640\u0640 \u0622\u062E\u0631 20 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0640\u0640\u0640
${JSON.stringify(recentPOs, null, 0)}

\u0640\u0640\u0640 \u0622\u062E\u0631 50 \u0639\u0645\u0644\u064A\u0629 \u062A\u062F\u0642\u064A\u0642 \u0640\u0640\u0640
${JSON.stringify(recentAudit.map((a) => ({ action: a.action, entity: a.entityType, id: a.entityId, desc: a.description, date: new Date(a.createdAt).toLocaleDateString("ar-SA") })), null, 0)}
`;
      const systemPrompt = `\u0623\u0646\u062A "\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0630\u0643\u064A" - \u0645\u0633\u0627\u0639\u062F AI \u0645\u062A\u062E\u0635\u0635 \u0641\u064A \u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644 (CMMS).

\u0642\u0648\u0627\u0639\u062F\u0643 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629:
1. \u0623\u062C\u0628 \u0628\u0646\u0641\u0633 \u0644\u063A\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u062A\u0645\u0627\u0645\u0627\u064B:
   - \u0625\u0630\u0627 \u0643\u062A\u0628 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u2192 \u0623\u062C\u0628 \u0628\u0627\u0644\u0641\u0635\u062D\u0649
   - \u0625\u0630\u0627 \u0643\u062A\u0628 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 (\u0645\u062B\u0644: "\u0648\u0634 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A \u0627\u0644\u064A\u0648\u0645\u061F", "\u0643\u0645 \u0639\u0646\u062F\u0646\u0627 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621\u061F", "\u0648\u0634\u0644\u0648\u0646 \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u061F", "\u0627\u064A\u0634 \u0627\u0644\u0633\u0627\u0644\u0641\u0629\u061F", "\u0648\u064A\u0646 \u0627\u0644\u0645\u0634\u0643\u0644\u0629\u061F") \u2192 \u0623\u062C\u0628 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629
   - \u0625\u0630\u0627 \u0643\u062A\u0628 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 (\u0645\u062B\u0644: "\u0627\u064A\u0647 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A \u062F\u064A\u061F", "\u0639\u0627\u064A\u0632 \u0627\u0639\u0631\u0641", "\u0641\u064A\u0646 \u0627\u0644\u0645\u0634\u0643\u0644\u0629\u061F") \u2192 \u0623\u062C\u0628 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0645\u0635\u0631\u064A\u0629
   - If user writes in English \u2192 Reply in English
   - \u0627\u06AF\u0631 \u0635\u0627\u0631\u0641 \u0627\u0631\u062F\u0648 \u0645\u06CC\u06BA \u0644\u06A9\u06BE\u06D2 \u2192 \u0627\u0631\u062F\u0648 \u0645\u06CC\u06BA \u062C\u0648\u0627\u0628 \u062F\u06CC\u06BA

2. \u0644\u062F\u064A\u0643 \u0648\u0635\u0648\u0644 \u0643\u0627\u0645\u0644 \u0644\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645. \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0631\u0641\u0642\u0629 \u0644\u0644\u0625\u062C\u0627\u0628\u0629 \u0628\u062F\u0642\u0629.

3. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0639\u0646:
   - \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A: \u0639\u062F\u062F\u0647\u0627\u060C \u062D\u0627\u0644\u0627\u062A\u0647\u0627\u060C \u0623\u0648\u0644\u0648\u064A\u0627\u062A\u0647\u0627\u060C \u0641\u0626\u0627\u062A\u0647\u0627\u060C \u0645\u0646 \u0623\u0646\u0634\u0623\u0647\u0627\u060C \u0645\u0646 \u0645\u0633\u0646\u062F \u0625\u0644\u064A\u0647\u060C \u0627\u0644\u0645\u0648\u0642\u0639\u060C \u0627\u0644\u062A\u0627\u0631\u064A\u062E
   - \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0627\u0621: \u0639\u062F\u062F\u0647\u0627\u060C \u062D\u0627\u0644\u0627\u062A\u0647\u0627\u060C \u062A\u0643\u0627\u0644\u064A\u0641\u0647\u0627\u060C \u0645\u0646 \u0637\u0644\u0628\u0647\u0627
   - \u0627\u0644\u0645\u062E\u0632\u0648\u0646: \u0627\u0644\u0623\u0635\u0646\u0627\u0641\u060C \u0627\u0644\u0643\u0645\u064A\u0627\u062A\u060C \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0646\u062E\u0641\u0636\u0629
   - \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646: \u0623\u0633\u0645\u0627\u0624\u0647\u0645\u060C \u0623\u062F\u0648\u0627\u0631\u0647\u0645\u060C \u0623\u0642\u0633\u0627\u0645\u0647\u0645
   - \u0627\u0644\u0645\u0648\u0627\u0642\u0639: \u0623\u0633\u0645\u0627\u0624\u0647\u0627\u060C \u0639\u0646\u0627\u0648\u064A\u0646\u0647\u0627
   - \u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642: \u0622\u062E\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A
   - \u0627\u0644\u062A\u0643\u0627\u0644\u064A\u0641 \u0648\u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629
   - \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0623\u062F\u0627\u0621 \u0648\u0627\u0644\u062A\u0648\u0635\u064A\u0627\u062A
   - \u062E\u0637\u0637 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0648\u0642\u0627\u0626\u064A\u0629

4. \u0643\u0646 \u0645\u0641\u064A\u062F\u0627\u064B \u0648\u0639\u0645\u0644\u064A\u0627\u064B. \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0641\u0639\u0644\u064A\u0629 \u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A. \u0644\u0627 \u062A\u062E\u062A\u0631\u0639 \u0628\u064A\u0627\u0646\u0627\u062A.

5. \u0627\u0633\u062A\u062E\u062F\u0645 \u062A\u0646\u0633\u064A\u0642 Markdown \u0644\u0644\u0631\u062F\u0648\u062F (\u0639\u0646\u0627\u0648\u064A\u0646\u060C \u062C\u062F\u0627\u0648\u0644\u060C \u0642\u0648\u0627\u0626\u0645) \u0644\u062A\u0643\u0648\u0646 \u0648\u0627\u0636\u062D\u0629 \u0648\u0645\u0646\u0638\u0645\u0629.

6. \u0625\u0630\u0627 \u0633\u0623\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0639\u0646 \u0634\u064A\u0621 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u060C \u0623\u062E\u0628\u0631\u0647 \u0628\u0630\u0644\u0643 \u0628\u0648\u0636\u0648\u062D.

7. \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u062D\u0627\u0644\u064A: ${ctx.user?.name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641"} (\u0627\u0644\u062F\u0648\u0631: ${ctx.user?.role || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"})`;
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `\u0647\u0630\u0647 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u062D\u062F\u062B\u0629:
${dbContext}` },
        { role: "assistant", content: "\u062A\u0645 \u062A\u062D\u0645\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0646\u062C\u0627\u062D. \u0623\u0646\u0627 \u062C\u0627\u0647\u0632 \u0644\u0644\u0625\u062C\u0627\u0628\u0629 \u0639\u0644\u0649 \u0623\u064A \u0633\u0624\u0627\u0644." }
      ];
      if (input.conversationHistory?.length) {
        for (const msg of input.conversationHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content: input.question });
      const response = await invokeLLM({ messages });
      return { answer: response.choices[0]?.message?.content || "\u0644\u0645 \u0623\u062A\u0645\u0643\u0646 \u0645\u0646 \u0627\u0644\u0625\u062C\u0627\u0628\u0629" };
    })
  }),
  // ============================================================
  // DATABASE BACKUPSS
  // ============================================================
  backups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629" });
      return getBackups();
    }),
    create: protectedProcedure.input(z3.object({
      description: z3.string().optional()
    }).optional()).mutation(async ({ input, ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629" });
      const exportResult = await exportAllTablesData();
      if (!exportResult) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u0641\u0634\u0644 \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const backupName = `backup-${timestamp2}`;
      const jsonData = JSON.stringify(exportResult.data, null, 2);
      const buffer = Buffer.from(jsonData, "utf-8");
      const fileKey = `cmms/backups/${backupName}.json`;
      const { url } = await storagePut(fileKey, buffer, "application/json");
      const id = await createBackup({
        name: backupName,
        description: input?.description || `\u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 - ${(/* @__PURE__ */ new Date()).toLocaleDateString("ar-SA")}`,
        fileUrl: url,
        fileKey,
        fileSize: buffer.length,
        tablesCount: exportResult.tablesCount,
        recordsCount: exportResult.recordsCount,
        createdById: ctx.user.id
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "create_backup",
        entityType: "backup",
        entityId: id,
        newValues: { name: backupName, tablesCount: exportResult.tablesCount, recordsCount: exportResult.recordsCount }
      });
      return { id, name: backupName, tablesCount: exportResult.tablesCount, recordsCount: exportResult.recordsCount, fileUrl: url };
    }),
    restore: protectedProcedure.input(z3.object({
      id: z3.number()
    })).mutation(async ({ input, ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629" });
      const backup = await getBackupById(input.id);
      if (!backup) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      const response = await fetch(backup.fileUrl);
      if (!response.ok) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
      const backupData = await response.json();
      await restoreFromBackup(backupData);
      await createAuditLog({
        userId: ctx.user.id,
        action: "restore_backup",
        entityType: "backup",
        entityId: input.id,
        newValues: { name: backup.name, restoredAt: (/* @__PURE__ */ new Date()).toISOString() }
      });
      return { success: true, name: backup.name };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError5({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629" });
      const backup = await getBackupById(input.id);
      if (!backup) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      await deleteBackup(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "delete_backup",
        entityType: "backup",
        entityId: input.id,
        oldValues: { name: backup.name }
      });
      return { success: true };
    })
  }),
  // ============================================================
  // AUDIT LOGS
  // ============================================================
  audit: router({
    list: protectedProcedure.input(z3.object({
      entityType: z3.string().optional(),
      entityId: z3.number().optional(),
      userId: z3.number().optional(),
      action: z3.string().optional(),
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional(),
      limit: z3.number().optional()
    }).optional()).query(async ({ input }) => {
      const filters = {};
      if (input?.entityType) filters.entityType = input.entityType;
      if (input?.entityId) filters.entityId = input.entityId;
      if (input?.userId) filters.userId = input.userId;
      if (input?.action) filters.action = input.action;
      if (input?.dateFrom) filters.dateFrom = new Date(input.dateFrom);
      if (input?.dateTo) {
        const d = new Date(input.dateTo);
        d.setHours(23, 59, 59, 999);
        filters.dateTo = d;
      }
      if (input?.limit) filters.limit = input.limit;
      return getAuditLogsEnhanced(filters);
    })
  }),
  // ============================================================
  // TRANSLATION ENGINE
  // ============================================================
  translation: translationRouter,
  // ============================================================
  // ASSETS - إدارة الأصول
  // ============================================================
  assets: router({
    list: protectedProcedure.input(z3.object({
      siteId: z3.number().optional(),
      sectionId: z3.number().optional(),
      status: z3.string().optional(),
      search: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      return listAssets(input ?? {});
    }),
    getById: protectedProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
      const asset = await getAssetById(input.id);
      if (!asset) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0623\u0635\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return asset;
    }),
    create: managerProcedure.input(z3.object({
      name: z3.string().min(1),
      description: z3.string().optional(),
      category: z3.string().optional(),
      brand: z3.string().optional(),
      model: z3.string().optional(),
      serialNumber: z3.string().optional(),
      siteId: z3.number().optional(),
      sectionId: z3.number().optional(),
      locationDetail: z3.string().optional(),
      status: z3.enum(["active", "inactive", "under_maintenance", "disposed"]).optional(),
      purchaseDate: z3.string().optional(),
      purchaseCost: z3.string().optional(),
      warrantyExpiry: z3.string().optional(),
      warrantyNotes: z3.string().optional(),
      photoUrl: z3.string().optional(),
      notes: z3.string().optional(),
      rfidTag: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const assetNumber = await generateAssetNumber();
      let assetTranslation = {};
      const fieldsToTranslate = {};
      if (input.description) fieldsToTranslate.description = input.description;
      if (input.notes) fieldsToTranslate.notes = input.notes;
      if (Object.keys(fieldsToTranslate).length > 0) {
        try {
          const lang = await detectLanguage(Object.values(fieldsToTranslate)[0]);
          const translations = await translateFields(fieldsToTranslate, lang);
          if (translations.description) {
            assetTranslation.description_ar = translations.description.ar;
            assetTranslation.description_en = translations.description.en;
            assetTranslation.description_ur = translations.description.ur;
          }
          if (translations.notes) {
            assetTranslation.notes_ar = translations.notes.ar;
            assetTranslation.notes_en = translations.notes.en;
            assetTranslation.notes_ur = translations.notes.ur;
          }
          assetTranslation.originalLanguage = lang;
        } catch (e) {
          console.error("[Asset] Translation failed:", e);
        }
      }
      const result = await createAsset({
        ...input,
        ...assetTranslation,
        assetNumber,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : void 0,
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : void 0,
        status: input.status ?? "active",
        createdById: ctx.user.id
      });
      if (result && input.rfidTag && input.photoUrl) {
        try {
          const oldKey = input.photoUrl.includes("/api/media?key=") ? decodeURIComponent(input.photoUrl.split("key=")[1]) : input.photoUrl.replace(/^.*\/cmms\//, "cmms/");
          const safeRfid = input.rfidTag.replace(/[^a-zA-Z0-9_\-]/g, "_");
          const newKey = `cmms/assets/${safeRfid}.webp`;
          if (oldKey !== newKey) {
            const { url: newUrl } = await storageRename(oldKey, newKey);
            const proxyUrl = `/api/media?key=${encodeURIComponent(newKey)}`;
            await updateAsset(result.id, { photoUrl: proxyUrl });
            result.photoUrl = proxyUrl;
          }
        } catch (e) {
          console.error("[Asset] RFID photo rename failed (create):", e);
        }
      }
      return result;
    }),
    update: managerProcedure.input(z3.object({
      id: z3.number(),
      name: z3.string().optional(),
      description: z3.string().optional(),
      category: z3.string().optional(),
      brand: z3.string().optional(),
      model: z3.string().optional(),
      serialNumber: z3.string().optional(),
      siteId: z3.number().optional(),
      sectionId: z3.number().optional(),
      locationDetail: z3.string().optional(),
      status: z3.enum(["active", "inactive", "under_maintenance", "disposed"]).optional(),
      purchaseDate: z3.string().optional(),
      purchaseCost: z3.string().optional(),
      warrantyExpiry: z3.string().optional(),
      warrantyNotes: z3.string().optional(),
      photoUrl: z3.string().optional(),
      notes: z3.string().optional(),
      rfidTag: z3.string().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      let assetTranslation = {};
      const assetFieldsToTranslate = {};
      if (data.description) assetFieldsToTranslate.description = data.description;
      if (data.notes) assetFieldsToTranslate.notes = data.notes;
      if (Object.keys(assetFieldsToTranslate).length > 0) {
        try {
          const textForDetection = Object.values(assetFieldsToTranslate)[0];
          const detectedLang = await detectLanguage(textForDetection);
          const translations = await translateFields(assetFieldsToTranslate, detectedLang);
          if (translations.description) {
            assetTranslation.description_ar = translations.description.ar;
            assetTranslation.description_en = translations.description.en;
            assetTranslation.description_ur = translations.description.ur;
          }
          if (translations.notes) {
            assetTranslation.notes_ar = translations.notes.ar;
            assetTranslation.notes_en = translations.notes.en;
            assetTranslation.notes_ur = translations.notes.ur;
          }
        } catch (e) {
          console.error("[Asset] Update translation failed:", e);
        }
      }
      let finalPhotoUrl = data.photoUrl;
      const effectiveRfid = data.rfidTag;
      if (effectiveRfid && data.photoUrl) {
        try {
          const oldKey = data.photoUrl.includes("/api/media?key=") ? decodeURIComponent(data.photoUrl.split("key=")[1]) : data.photoUrl.replace(/^.*\/cmms\//, "cmms/");
          const safeRfid = effectiveRfid.replace(/[^a-zA-Z0-9_\-]/g, "_");
          const newKey = `cmms/assets/${safeRfid}.webp`;
          if (!oldKey.endsWith(`${safeRfid}.webp`)) {
            await storageRename(oldKey, newKey);
            finalPhotoUrl = `/api/media?key=${encodeURIComponent(newKey)}`;
          }
        } catch (e) {
          console.error("[Asset] RFID photo rename failed (update+photo):", e);
        }
      } else if (effectiveRfid && !data.photoUrl) {
        try {
          const existing = await getAssetById(id);
          if (existing?.photoUrl) {
            const oldKey = existing.photoUrl.includes("/api/media?key=") ? decodeURIComponent(existing.photoUrl.split("key=")[1]) : existing.photoUrl.replace(/^.*\/cmms\//, "cmms/");
            const safeRfid = effectiveRfid.replace(/[^a-zA-Z0-9_\-]/g, "_");
            const newKey = `cmms/assets/${safeRfid}.webp`;
            if (!oldKey.endsWith(`${safeRfid}.webp`)) {
              await storageRename(oldKey, newKey);
              finalPhotoUrl = `/api/media?key=${encodeURIComponent(newKey)}`;
            }
          }
        } catch (e) {
          console.error("[Asset] RFID rename on rfid-change failed:", e);
        }
      }
      return updateAsset(id, {
        ...data,
        ...assetTranslation,
        photoUrl: finalPhotoUrl,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : void 0,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : void 0
      });
    }),
    delete: managerProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
      return deleteAsset(input.id);
    }),
    // ============================================================
    // RFID - تقنية تحديد الموقع بالترددات الراديوية
    // ============================================================
    getByRfid: protectedProcedure.input(z3.object({
      rfidTag: z3.string().min(1)
    })).query(async ({ input }) => {
      const asset = await getAssetByRfidTag(input.rfidTag);
      if (!asset) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0623\u0635\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0640 RFID \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return asset;
    }),
    updateRfid: managerProcedure.input(z3.object({
      id: z3.number(),
      rfidTag: z3.string().min(1)
    })).mutation(async ({ input }) => {
      return updateAssetRfidTag(input.id, input.rfidTag);
    }),
    linkRfidTag: protectedProcedure.input(z3.object({
      assetId: z3.number(),
      rfidTag: z3.string().min(1)
    })).mutation(async ({ input }) => {
      const asset = await getAssetById(input.assetId);
      if (!asset) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0623\u0635\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return updateAssetRfidTag(input.assetId, input.rfidTag);
    }),
    getMaintenanceHistory: protectedProcedure.input(z3.object({
      id: z3.number()
    })).query(async ({ input }) => {
      const asset = await getAssetById(input.id);
      if (!asset) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0623\u0635\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return getAssetMaintenanceHistory(input.id);
    }),
    getMaintenanceStats: protectedProcedure.input(z3.object({
      id: z3.number()
    })).query(async ({ input }) => {
      const asset = await getAssetById(input.id);
      if (!asset) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u0623\u0635\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return getAssetMaintenanceStats(input.id);
    }),
    addSparePart: managerProcedure.input(z3.object({
      assetId: z3.number(),
      inventoryItemId: z3.number(),
      minStockLevel: z3.number().optional(),
      preferredQuantity: z3.number().optional(),
      notes: z3.string().optional()
    })).mutation(async ({ input }) => {
      return addAssetSparePart(input);
    }),
    getSpareParts: protectedProcedure.input(z3.object({
      assetId: z3.number()
    })).query(async ({ input }) => {
      return getAssetSpareParts(input.assetId);
    }),
    removeSparePart: managerProcedure.input(z3.object({
      id: z3.number()
    })).mutation(async ({ input }) => {
      return removeAssetSparePart(input.id);
    }),
    getMetrics: protectedProcedure.input(z3.object({
      assetId: z3.number()
    })).query(async ({ input }) => {
      return getAssetMetricsById(input.assetId);
    }),
    calculateMetrics: managerProcedure.input(z3.object({
      assetId: z3.number()
    })).mutation(async ({ input }) => {
      return calculateAssetMetrics(input.assetId);
    }),
    getAllMetrics: protectedProcedure.query(async () => {
      return getAllAssetMetrics();
    }),
    getLowStockAlerts: managerProcedure.query(async () => {
      return getInventoryAlerts();
    }),
    getAssetSparePartsWithLowStock: protectedProcedure.input(z3.object({
      assetId: z3.number()
    })).query(async ({ input }) => {
      return getAssetSparePartsWithLowStock(input.assetId);
    })
  }),
  // ============================================================
  // PREVENTIVE MAINTENANCE - الصيانة الوقائية
  // ============================================================
  preventive: router({
    listPlans: protectedProcedure.input(z3.object({
      assetId: z3.number().optional(),
      siteId: z3.number().optional(),
      isActive: z3.boolean().optional()
    }).optional()).query(async ({ input }) => {
      return listPreventivePlans(input ?? {});
    }),
    getPlanById: protectedProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
      const plan = await getPreventivePlanById(input.id);
      if (!plan) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u062E\u0637\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      return plan;
    }),
    createPlan: managerProcedure.input(z3.object({
      title: z3.string().min(1),
      description: z3.string().optional(),
      assetId: z3.number().optional(),
      siteId: z3.number().optional(),
      frequency: z3.enum(["daily", "weekly", "monthly", "quarterly", "biannual", "annual"]),
      frequencyValue: z3.number().default(1),
      estimatedDurationMinutes: z3.number().optional(),
      assignedToId: z3.number().optional(),
      checklist: z3.array(z3.object({ id: z3.string(), text: z3.string(), required: z3.boolean().optional() })).optional(),
      nextDueDate: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const planNumber = await generatePlanNumber();
      const nextDue = input.nextDueDate ? new Date(input.nextDueDate) : calcNextDueDate(/* @__PURE__ */ new Date(), input.frequency, input.frequencyValue);
      const result = await createPreventivePlan({
        ...input,
        planNumber,
        checklist: input.checklist ?? [],
        nextDueDate: nextDue,
        createdById: ctx.user.id
      });
      return result;
    }),
    updatePlan: managerProcedure.input(z3.object({
      id: z3.number(),
      title: z3.string().optional(),
      description: z3.string().optional(),
      assetId: z3.number().optional(),
      siteId: z3.number().optional(),
      frequency: z3.enum(["daily", "weekly", "monthly", "quarterly", "biannual", "annual"]).optional(),
      frequencyValue: z3.number().optional(),
      estimatedDurationMinutes: z3.number().optional(),
      assignedToId: z3.number().optional(),
      checklist: z3.array(z3.object({ id: z3.string(), text: z3.string(), required: z3.boolean().optional() })).optional(),
      isActive: z3.boolean().optional(),
      nextDueDate: z3.string().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updatePreventivePlan(id, {
        ...data,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : void 0
      });
    }),
    deletePlan: managerProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
      return deletePreventivePlan(input.id);
    }),
    // Work Orders
    listWorkOrders: protectedProcedure.input(z3.object({
      planId: z3.number().optional(),
      assetId: z3.number().optional(),
      status: z3.string().optional(),
      assignedToId: z3.number().optional()
    }).optional()).query(async ({ input }) => {
      return listPMWorkOrders(input ?? {});
    }),
    getWorkOrderById: protectedProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
      const wo = await getPMWorkOrderById(input.id);
      if (!wo) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return wo;
    }),
    generateWorkOrder: managerProcedure.input(z3.object({
      planId: z3.number(),
      scheduledDate: z3.string()
    })).mutation(async ({ input }) => {
      const plan = await getPreventivePlanById(input.planId);
      if (!plan) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0627\u0644\u062E\u0637\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      const woNumber = await generateWorkOrderNumber();
      const result = await createPMWorkOrder({
        workOrderNumber: woNumber,
        planId: input.planId,
        assetId: plan.assetId ?? void 0,
        siteId: plan.siteId ?? void 0,
        title: plan.title,
        scheduledDate: new Date(input.scheduledDate),
        status: "scheduled",
        assignedToId: plan.assignedToId ?? void 0,
        checklistResults: plan.checklist
      });
      const nextDue = calcNextDueDate(new Date(input.scheduledDate), plan.frequency, plan.frequencyValue ?? 1);
      await updatePreventivePlan(input.planId, { lastGeneratedAt: /* @__PURE__ */ new Date(), nextDueDate: nextDue });
      if (plan.assignedToId) {
        try {
          const { sendPushToUser: sendPushToUser2 } = await Promise.resolve().then(() => (init_webPush(), webPush_exports));
          const scheduledDateStr = new Date(input.scheduledDate).toLocaleDateString("ar-SA");
          await sendPushToUser2(plan.assignedToId, {
            title: "\u062A\u0643\u0644\u064A\u0641 \u062C\u062F\u064A\u062F: \u0635\u064A\u0627\u0646\u0629 \u0648\u0642\u0627\u0626\u064A\u0629 \u{1F527}",
            body: `\u0645\u0647\u0645\u0629: ${plan.title}
\u0631\u0642\u0645 \u0627\u0644\u0623\u0645\u0631: ${woNumber}
\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${scheduledDateStr}`,
            tag: `pm-wo-${result.id}`
          });
        } catch (e) {
          console.error("[generateWorkOrder] Push notification failed:", e);
        }
      }
      return result;
    }),
    updateWorkOrder: protectedProcedure.input(z3.object({
      id: z3.number(),
      status: z3.enum(["scheduled", "in_progress", "completed", "overdue", "cancelled"]).optional(),
      // Accept null (from DB) and normalize to [] to prevent validation errors
      checklistResults: z3.array(z3.object({ id: z3.string(), text: z3.string(), done: z3.boolean(), notes: z3.string().optional() })).nullish().transform((v) => v ?? []),
      technicianNotes: z3.string().nullish().transform((v) => v ?? void 0),
      completionPhotoUrl: z3.string().nullish().transform((v) => v ?? void 0),
      completedDate: z3.string().nullish().transform((v) => v ?? void 0)
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      let woTranslation = {};
      if (data.technicianNotes && data.technicianNotes.trim().length > 0) {
        try {
          const detectedLang = await detectLanguage(data.technicianNotes);
          const translations = await translateFields({ technicianNotes: data.technicianNotes }, detectedLang);
          if (translations.technicianNotes) {
            woTranslation.technicianNotes_ar = translations.technicianNotes.ar;
            woTranslation.technicianNotes_en = translations.technicianNotes.en;
            woTranslation.technicianNotes_ur = translations.technicianNotes.ur;
          }
        } catch (e) {
          console.error("[WorkOrder] technicianNotes translation failed:", e);
        }
      }
      return updatePMWorkOrder(id, {
        ...data,
        ...woTranslation,
        completedDate: data.completedDate ? new Date(data.completedDate) : void 0
      });
    }),
    // ─── AI Predictive Analysis ──────────────────────────────────────────
    // Analyze a fault image and return diagnosis + recommendations
    analyzeFaultImage: protectedProcedure.input(z3.object({
      imageUrl: z3.string().url(),
      assetName: z3.string().optional(),
      assetCategory: z3.string().optional(),
      description: z3.string().optional()
    })).mutation(async ({ input }) => {
      const systemPrompt = `\u0623\u0646\u062A \u062E\u0628\u064A\u0631 \u0647\u0646\u062F\u0633\u064A \u0645\u062A\u062E\u0635\u0635 \u0641\u064A \u062A\u0634\u062E\u064A\u0635 \u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0645\u0639\u062F\u0627\u062A \u0648\u0627\u0644\u0623\u0635\u0648\u0644. 
\u0639\u0646\u062F \u062A\u062D\u0644\u064A\u0644 \u0635\u0648\u0631\u0629 \u0627\u0644\u0639\u0637\u0644\u060C \u0642\u062F\u0645:
1. \u062A\u0634\u062E\u064A\u0635 \u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0645\u062D\u062A\u0645\u0644
2. \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0648\u0631\u0629 (\u0645\u0646\u062E\u0641\u0636/\u0645\u062A\u0648\u0633\u0637/\u0639\u0627\u0644\u064D/\u062D\u0631\u062C)
3. \u0627\u0644\u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u0645\u062D\u062A\u0645\u0644\u0629
4. \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062A\u0635\u062D\u064A\u062D\u064A\u0629 \u0627\u0644\u0645\u0648\u0635\u0649 \u0628\u0647\u0627
5. \u0647\u0644 \u064A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u0625\u064A\u0642\u0627\u0641 \u062A\u0634\u063A\u064A\u0644 \u0641\u0648\u0631\u064A\u061F
\u0623\u062C\u0628 \u0628\u0635\u064A\u063A\u0629 JSON \u0645\u0646\u0638\u0645\u0629.`;
      const userMessage = `\u0627\u0644\u0623\u0635\u0644: ${input.assetName ?? "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"} | \u0627\u0644\u0641\u0626\u0629: ${input.assetCategory ?? "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}
\u0627\u0644\u0648\u0635\u0641: ${input.description ?? "\u0644\u0627 \u064A\u0648\u062C\u062F \u0648\u0635\u0641"}
\u0631\u0627\u0628\u0637 \u0627\u0644\u0635\u0648\u0631\u0629: ${input.imageUrl}

\u062D\u0644\u0644 \u0635\u0648\u0631\u0629 \u0627\u0644\u0639\u0637\u0644 \u0648\u0642\u062F\u0645 \u062A\u0634\u062E\u064A\u0635\u0627\u064B \u0645\u0641\u0635\u0644\u0627\u064B.`;
      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "fault_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                diagnosis: { type: "string", description: "\u062A\u0634\u062E\u064A\u0635 \u0627\u0644\u0639\u0637\u0644" },
                severity: { type: "string", enum: ["low", "medium", "high", "critical"], description: "\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0648\u0631\u0629" },
                causes: { type: "array", items: { type: "string" }, description: "\u0627\u0644\u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u0645\u062D\u062A\u0645\u0644\u0629" },
                recommendations: { type: "array", items: { type: "string" }, description: "\u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u0645\u0648\u0635\u0649 \u0628\u0647\u0627" },
                requiresImmediateShutdown: { type: "boolean", description: "\u0647\u0644 \u064A\u062D\u062A\u0627\u062C \u0625\u064A\u0642\u0627\u0641 \u062A\u0634\u063A\u064A\u0644 \u0641\u0648\u0631\u064A" },
                estimatedRepairTime: { type: "string", description: "\u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A \u0644\u0644\u0625\u0635\u0644\u0627\u062D" },
                confidence: { type: "number", description: "\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062B\u0642\u0629 0-100" }
              },
              required: ["diagnosis", "severity", "causes", "recommendations", "requiresImmediateShutdown", "estimatedRepairTime", "confidence"],
              additionalProperties: false
            }
          }
        }
      });
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u0641\u0634\u0644 \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629" });
      return JSON.parse(content);
    }),
    // Predict assets at risk based on maintenance history
    predictAtRiskAssets: protectedProcedure.mutation(async () => {
      const assets2 = await listAssets({});
      const tickets2 = await getTickets();
      if (assets2.length === 0) {
        return { atRiskAssets: [], summary: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0635\u0648\u0644 \u0645\u0633\u062C\u0644\u0629 \u0628\u0639\u062F" };
      }
      const assetSummaries = assets2.slice(0, 20).map((asset) => {
        const assetTickets = tickets2.filter((t2) => t2.assetId === asset.id);
        const recentTickets = assetTickets.filter((t2) => {
          const days = (Date.now() - new Date(t2.createdAt).getTime()) / (1e3 * 60 * 60 * 24);
          return days <= 90;
        });
        return {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          status: asset.status,
          warrantyExpiry: asset.warrantyExpiry,
          totalTickets: assetTickets.length,
          recentTickets: recentTickets.length,
          lastTicketDate: assetTickets.length > 0 ? assetTickets[assetTickets.length - 1].createdAt : null
        };
      });
      const result = await invokeLLM({
        messages: [
          { role: "system", content: "\u0623\u0646\u062A \u0645\u062D\u0644\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0635\u064A\u0627\u0646\u0629 \u0645\u062A\u062E\u0635\u0635. \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0635\u0648\u0644 \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0623\u0639\u0637\u0627\u0644\u060C \u062D\u062F\u062F \u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0623\u0643\u062B\u0631 \u0639\u0631\u0636\u0629 \u0644\u0644\u0623\u0639\u0637\u0627\u0644 \u0648\u0642\u062F\u0645 \u062A\u0648\u0635\u064A\u0627\u062A \u0648\u0642\u0627\u0626\u064A\u0629." },
          { role: "user", content: `\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0635\u0648\u0644:
${JSON.stringify(assetSummaries, null, 2)}

\u062D\u062F\u062F \u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0623\u0643\u062B\u0631 \u062E\u0637\u0648\u0631\u0629 \u0648\u0642\u062F\u0645 \u062A\u0648\u0635\u064A\u0627\u062A.` }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "risk_prediction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                atRiskAssets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      assetId: { type: "number" },
                      assetName: { type: "string" },
                      riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      reason: { type: "string" },
                      recommendation: { type: "string" }
                    },
                    required: ["assetId", "assetName", "riskLevel", "reason", "recommendation"],
                    additionalProperties: false
                  }
                },
                summary: { type: "string", description: "\u0645\u0644\u062E\u0635 \u0627\u0644\u062A\u062D\u0644\u064A\u0644" }
              },
              required: ["atRiskAssets", "summary"],
              additionalProperties: false
            }
          }
        }
      });
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0644\u064A\u0644" });
      return JSON.parse(content);
    }),
    // ─── Checklist Items (New Structured System) ──────────────────────────
    addChecklistItem: managerProcedure.input(z3.object({
      planId: z3.number(),
      text: z3.string().min(1),
      orderIndex: z3.number().optional(),
      isRequired: z3.boolean().default(true)
    })).mutation(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmChecklistItems: pmChecklistItems2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const result = await ddb.insert(pmChecklistItems2).values({
        planId: input.planId,
        text: input.text,
        orderIndex: input.orderIndex ?? 0,
        isRequired: input.isRequired
      });
      return { id: Number(result[0].insertId), ...input };
    }),
    updateChecklistItem: managerProcedure.input(z3.object({
      id: z3.number(),
      text: z3.string().optional(),
      orderIndex: z3.number().optional(),
      isRequired: z3.boolean().optional()
    })).mutation(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmChecklistItems: pmChecklistItems2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { id, ...data } = input;
      await ddb.update(pmChecklistItems2).set(data).where(eq3(pmChecklistItems2.id, id));
      return { success: true };
    }),
    deleteChecklistItem: managerProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmChecklistItems: pmChecklistItems2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      await ddb.delete(pmChecklistItems2).where(eq3(pmChecklistItems2.id, input.id));
      return { success: true };
    }),
    getChecklistItems: protectedProcedure.input(z3.object({ planId: z3.number() })).query(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) return [];
      const { pmChecklistItems: pmChecklistItems2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      return ddb.select().from(pmChecklistItems2).where(eq3(pmChecklistItems2.planId, input.planId)).orderBy(asc2(pmChecklistItems2.orderIndex));
    }),
    reorderChecklistItems: managerProcedure.input(z3.object({
      items: z3.array(z3.object({ id: z3.number(), orderIndex: z3.number() }))
    })).mutation(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmChecklistItems: pmChecklistItems2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      for (const item of input.items) {
        await ddb.update(pmChecklistItems2).set({ orderIndex: item.orderIndex }).where(eq3(pmChecklistItems2.id, item.id));
      }
      return { success: true };
    }),
    // ─── Execution Session ────────────────────────────────────────────────
    startExecution: protectedProcedure.input(z3.object({
      workOrderId: z3.number()
    })).mutation(async ({ input, ctx }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmExecutionSessions: pmExecutionSessions2, pmWorkOrders: pmWorkOrders2, pmChecklistItems: pmChecklistItems2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const wo = await getPMWorkOrderById(input.workOrderId);
      if (!wo) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const items = await ddb.select().from(pmChecklistItems2).where(eq3(pmChecklistItems2.planId, wo.planId)).orderBy();
      const existing = await ddb.select().from(pmExecutionSessions2).where(eq3(pmExecutionSessions2.workOrderId, input.workOrderId));
      if (existing.length > 0) {
        return { session: existing[0], items, workOrder: wo };
      }
      const result = await ddb.insert(pmExecutionSessions2).values({
        workOrderId: input.workOrderId,
        technicianId: ctx.user.id,
        totalItems: items.length
      });
      await ddb.update(pmWorkOrders2).set({ status: "in_progress" }).where(eq3(pmWorkOrders2.id, input.workOrderId));
      const session = await ddb.select().from(pmExecutionSessions2).where(eq3(pmExecutionSessions2.workOrderId, input.workOrderId));
      return { session: session[0], items, workOrder: wo };
    }),
    submitItemResult: protectedProcedure.input(z3.object({
      workOrderId: z3.number(),
      checklistItemId: z3.number(),
      status: z3.enum(["ok", "fixed", "issue"]),
      fixNotes: z3.string().optional(),
      photoUrl: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmExecutionResults: pmExecutionResults2, pmExecutionSessions: pmExecutionSessions2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq7, and: and7 } = await import("drizzle-orm");
      const existing = await ddb.select().from(pmExecutionResults2).where(and7(
        eq7(pmExecutionResults2.workOrderId, input.workOrderId),
        eq7(pmExecutionResults2.checklistItemId, input.checklistItemId)
      ));
      if (existing.length > 0) {
        await ddb.update(pmExecutionResults2).set({ status: input.status, fixNotes: input.fixNotes, photoUrl: input.photoUrl }).where(eq7(pmExecutionResults2.id, existing[0].id));
      } else {
        await ddb.insert(pmExecutionResults2).values({
          workOrderId: input.workOrderId,
          checklistItemId: input.checklistItemId,
          status: input.status,
          fixNotes: input.fixNotes,
          photoUrl: input.photoUrl
        });
      }
      const allResults = await ddb.select().from(pmExecutionResults2).where(eq7(pmExecutionResults2.workOrderId, input.workOrderId));
      const okCount = allResults.filter((r) => r.status === "ok").length;
      const fixedCount = allResults.filter((r) => r.status === "fixed").length;
      const issueCount = allResults.filter((r) => r.status === "issue").length;
      await ddb.update(pmExecutionSessions2).set({ okCount, fixedCount, issueCount }).where(eq7(pmExecutionSessions2.workOrderId, input.workOrderId));
      return { success: true, completedCount: allResults.length };
    }),
    getExecutionProgress: protectedProcedure.input(z3.object({ workOrderId: z3.number() })).query(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmExecutionResults: pmExecutionResults2, pmExecutionSessions: pmExecutionSessions2, pmChecklistItems: pmChecklistItems2, pmWorkOrders: pmWorkOrders2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq7 } = await import("drizzle-orm");
      const wo = await getPMWorkOrderById(input.workOrderId);
      if (!wo) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const items = await ddb.select().from(pmChecklistItems2).where(eq7(pmChecklistItems2.planId, wo.planId)).orderBy();
      const results = await ddb.select().from(pmExecutionResults2).where(eq7(pmExecutionResults2.workOrderId, input.workOrderId));
      const sessions = await ddb.select().from(pmExecutionSessions2).where(eq7(pmExecutionSessions2.workOrderId, input.workOrderId));
      return {
        workOrder: wo,
        items,
        results,
        session: sessions[0] ?? null,
        totalItems: items.length,
        completedItems: results.length
      };
    }),
    completeExecution: protectedProcedure.input(z3.object({
      workOrderId: z3.number(),
      generalNotes: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmExecutionSessions: pmExecutionSessions2, pmWorkOrders: pmWorkOrders2, pmExecutionResults: pmExecutionResults2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq7 } = await import("drizzle-orm");
      const now = /* @__PURE__ */ new Date();
      const sessions = await ddb.select().from(pmExecutionSessions2).where(eq7(pmExecutionSessions2.workOrderId, input.workOrderId));
      if (sessions.length > 0) {
        const startedAt = new Date(sessions[0].startedAt);
        const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1e3);
        await ddb.update(pmExecutionSessions2).set({
          status: "completed",
          completedAt: now,
          durationSeconds,
          generalNotes: input.generalNotes
        }).where(eq7(pmExecutionSessions2.workOrderId, input.workOrderId));
      }
      const results = await ddb.select().from(pmExecutionResults2).where(eq7(pmExecutionResults2.workOrderId, input.workOrderId));
      const issueCount = results.filter((r) => r.status === "issue").length;
      const fixedCount = results.filter((r) => r.status === "fixed").length;
      const okCount = results.filter((r) => r.status === "ok").length;
      await ddb.update(pmWorkOrders2).set({
        status: "completed",
        completedDate: now,
        technicianNotes: input.generalNotes
      }).where(eq7(pmWorkOrders2.id, input.workOrderId));
      const wo = await getPMWorkOrderById(input.workOrderId);
      const techUser = await getUserById(ctx.user.id);
      const techName = techUser?.name ?? ctx.user.name ?? "\u0627\u0644\u0641\u0646\u064A";
      let notifTitle = "";
      let notifContent = "";
      if (issueCount > 0) {
        notifTitle = `\u26A0\uFE0F \u062A\u0646\u0628\u064A\u0647: \u062A\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 ${issueCount} \u062E\u0644\u0644 \u0641\u064A \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u062F\u0648\u0631\u064A`;
        notifContent = `\u0627\u0644\u0641\u0646\u064A ${techName} \u0623\u0646\u0647\u0649 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u062F\u0648\u0631\u064A \u0644\u0640 "${wo?.title ?? ""}" - \u0627\u0643\u062A\u0634\u0641 ${issueCount} \u062E\u0644\u0644\u060C \u0623\u0635\u0644\u062D ${fixedCount} \u0628\u0646\u062F\u060C \u0633\u0644\u064A\u0645 ${okCount} \u0628\u0646\u062F.`;
      } else if (fixedCount > 0) {
        notifTitle = `\u{1F527} \u062A\u0645 \u0625\u0635\u0644\u0627\u062D \u0641\u0648\u0631\u064A \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u062F\u0648\u0631\u064A`;
        notifContent = `\u0627\u0644\u0641\u0646\u064A ${techName} \u0623\u0646\u0647\u0649 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u062F\u0648\u0631\u064A \u0644\u0640 "${wo?.title ?? ""}" - \u0623\u0635\u0644\u062D ${fixedCount} \u0628\u0646\u062F\u060C \u062C\u0645\u064A\u0639 \u0627\u0644\u0628\u0646\u0648\u062F \u0627\u0644\u0623\u062E\u0631\u0649 \u0633\u0644\u064A\u0645\u0629.`;
      } else {
        notifTitle = `\u2705 \u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u062F\u0648\u0631\u064A - \u062C\u0645\u064A\u0639 \u0627\u0644\u0628\u0646\u0648\u062F \u0633\u0644\u064A\u0645\u0629`;
        notifContent = `\u0627\u0644\u0641\u0646\u064A ${techName} \u0623\u0646\u0647\u0649 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u062F\u0648\u0631\u064A \u0644\u0640 "${wo?.title ?? ""}" - \u062C\u0645\u064A\u0639 ${okCount} \u0628\u0646\u062F \u0633\u0644\u064A\u0645\u0629.`;
      }
      await notifyOwner({ title: notifTitle, content: notifContent });
      const managerUsers = await getManagerUsers();
      const notifType = issueCount > 0 ? "critical" : fixedCount > 0 ? "warning" : "success";
      for (const manager of managerUsers) {
        await createNotification({
          userId: manager.id,
          title: notifTitle,
          message: notifContent,
          type: notifType,
          relatedTicketId: void 0,
          relatedPOId: void 0
        });
      }
      return { success: true, issueCount, fixedCount, okCount };
    }),
    createIssueTicket: protectedProcedure.input(z3.object({
      workOrderId: z3.number(),
      checklistItemId: z3.number(),
      assetId: z3.number().optional(),
      siteId: z3.number().optional(),
      description: z3.string()
    })).mutation(async ({ input, ctx }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmExecutionResults: pmExecutionResults2, pmWorkOrders: pmWorkOrders2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq7, and: and7 } = await import("drizzle-orm");
      const wo = await getPMWorkOrderById(input.workOrderId);
      if (!wo) throw new TRPCError5({ code: "NOT_FOUND", message: "\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const ticketNumber = await getNextTicketNumber();
      const ticketId = await createTicket({
        ticketNumber,
        title: `\u062E\u0644\u0644 \u0645\u0643\u062A\u0634\u0641 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u062F\u0648\u0631\u064A: ${wo.title}`,
        description: `${input.description}

\u{1F4CB} \u0627\u0644\u0645\u0635\u062F\u0631: \u0635\u064A\u0627\u0646\u0629 \u062F\u0648\u0631\u064A\u0629 \u0631\u0642\u0645 ${wo.workOrderNumber}`,
        priority: "high",
        status: "open",
        assetId: input.assetId ?? wo.assetId ?? void 0,
        siteId: input.siteId ?? wo.siteId ?? void 0,
        reportedById: ctx.user.id,
        category: "corrective"
      });
      await ddb.update(pmExecutionResults2).set({ linkedTicketId: ticketId, status: "issue" }).where(and7(
        eq7(pmExecutionResults2.workOrderId, input.workOrderId),
        eq7(pmExecutionResults2.checklistItemId, input.checklistItemId)
      ));
      return { ticketId, ticketNumber };
    }),
    // ─── Detection Rate Report ────────────────────────────────────────────
    getDetectionRateReport: protectedProcedure.input(z3.object({
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmExecutionResults: pmExecutionResults2, pmExecutionSessions: pmExecutionSessions2, pmWorkOrders: pmWorkOrders2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { gte: gte3, lte: lte3, and: and7, eq: eq7 } = await import("drizzle-orm");
      const from = input?.dateFrom ? new Date(input.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
      const to = input?.dateTo ? new Date(input.dateTo) : /* @__PURE__ */ new Date();
      const workOrders = await listPMWorkOrders({ status: "completed" });
      const filteredWOs = workOrders.filter((wo) => {
        const d = new Date(wo.completedDate ?? wo.scheduledDate);
        return d >= from && d <= to;
      });
      const woIds = filteredWOs.map((wo) => wo.id);
      let allResults = [];
      for (const woId of woIds) {
        const results = await ddb.select().from(pmExecutionResults2).where(eq7(pmExecutionResults2.workOrderId, woId));
        allResults = allResults.concat(results);
      }
      const totalItems = allResults.length;
      const okItems = allResults.filter((r) => r.status === "ok").length;
      const fixedItems = allResults.filter((r) => r.status === "fixed").length;
      const issueItems = allResults.filter((r) => r.status === "issue").length;
      const issueWithTicket = allResults.filter((r) => r.status === "issue" && r.linkedTicketId).length;
      const allTickets = await getTickets();
      const rangeTickets = allTickets.filter((t2) => {
        const d = new Date(t2.createdAt);
        return d >= from && d <= to;
      });
      const pmSourceTickets = rangeTickets.filter(
        (t2) => t2.description?.includes("\u0627\u0644\u0645\u0635\u062F\u0631: \u0635\u064A\u0627\u0646\u0629 \u062F\u0648\u0631\u064A\u0629")
      );
      const detectionRate = rangeTickets.length > 0 ? Math.round(pmSourceTickets.length / rangeTickets.length * 100) : 0;
      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        completedInspections: filteredWOs.length,
        totalItems,
        okItems,
        fixedItems,
        issueItems,
        issueWithTicket,
        totalTicketsInPeriod: rangeTickets.length,
        pmDetectedTickets: pmSourceTickets.length,
        detectionRate,
        summary: `\u062A\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 ${pmSourceTickets.length} \u0639\u0637\u0644 \u0645\u0646 \u0623\u0635\u0644 ${rangeTickets.length} \u0628\u0644\u0627\u063A (${detectionRate}%) \u0639\u0646 \u0637\u0631\u064A\u0642 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629`
      };
    }),
    // ─── Asset Inspection History ─────────────────────────────────────────
    getAssetInspectionHistory: protectedProcedure.input(z3.object({
      assetId: z3.number(),
      limit: z3.number().optional().default(10)
    })).query(async ({ input }) => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "\u062E\u0637\u0623 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
      const { pmExecutionSessions: pmExecutionSessions2, pmWorkOrders: pmWorkOrders2, pmExecutionResults: pmExecutionResults2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq7, desc: desc3, and: and7 } = await import("drizzle-orm");
      const workOrders = await listPMWorkOrders({ assetId: input.assetId, status: "completed" });
      const woIds = workOrders.map((wo) => wo.id);
      if (woIds.length === 0) return [];
      const sessions = [];
      for (const woId of woIds.slice(0, input.limit)) {
        const sess = await ddb.select().from(pmExecutionSessions2).where(and7(eq7(pmExecutionSessions2.workOrderId, woId), eq7(pmExecutionSessions2.status, "completed"))).limit(1);
        if (sess.length > 0) {
          const wo = workOrders.find((w) => w.id === woId);
          const results = await ddb.select().from(pmExecutionResults2).where(eq7(pmExecutionResults2.workOrderId, woId));
          sessions.push({
            ...sess[0],
            workOrderTitle: wo?.title ?? "",
            workOrderNumber: wo?.workOrderNumber ?? "",
            okCount: results.filter((r) => r.status === "ok").length,
            fixedCount: results.filter((r) => r.status === "fixed").length,
            issueCount: results.filter((r) => r.status === "issue").length,
            totalItems: results.length
          });
        }
      }
      sessions.sort((a, b) => new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime());
      return sessions;
    }),
    // ─── PM Report ────────────────────────────────────────────────────────
    getReport: protectedProcedure.input(z3.object({
      dateFrom: z3.string().optional(),
      dateTo: z3.string().optional()
    }).optional()).query(async ({ input }) => {
      const plans = await listPreventivePlans();
      const workOrders = await listPMWorkOrders();
      const now = /* @__PURE__ */ new Date();
      const from = input?.dateFrom ? new Date(input.dateFrom) : null;
      const to = input?.dateTo ? new Date(input.dateTo) : null;
      const filteredWOs = workOrders.filter((wo) => {
        if (from && new Date(wo.scheduledDate) < from) return false;
        if (to && new Date(wo.scheduledDate) > to) return false;
        return true;
      });
      const totalPlans = plans.length;
      const activePlans = plans.filter((p) => p.isActive !== false).length;
      const inactivePlans = totalPlans - activePlans;
      const overduePlans = plans.filter((p) => {
        if (!p.nextDueDate || p.isActive === false) return false;
        return new Date(p.nextDueDate) < now;
      }).length;
      const totalWOs = filteredWOs.length;
      const completedWOs = filteredWOs.filter((wo) => wo.status === "completed").length;
      const inProgressWOs = filteredWOs.filter((wo) => wo.status === "in_progress").length;
      const scheduledWOs = filteredWOs.filter((wo) => wo.status === "scheduled").length;
      const overdueWOs = filteredWOs.filter((wo) => wo.status === "overdue").length;
      const cancelledWOs = filteredWOs.filter((wo) => wo.status === "cancelled").length;
      const completionRate = totalWOs > 0 ? Math.round(completedWOs / totalWOs * 100) : 0;
      let totalChecklistItems = 0;
      let doneChecklistItems = 0;
      filteredWOs.forEach((wo) => {
        if (Array.isArray(wo.checklistResults)) {
          totalChecklistItems += wo.checklistResults.length;
          doneChecklistItems += wo.checklistResults.filter((c) => c.done).length;
        }
      });
      const checklistCompletionRate = totalChecklistItems > 0 ? Math.round(doneChecklistItems / totalChecklistItems * 100) : 0;
      const byFrequency = {};
      plans.forEach((p) => {
        byFrequency[p.frequency] = (byFrequency[p.frequency] || 0) + 1;
      });
      const recentWorkOrders = filteredWOs.slice(0, 10).map((wo) => ({
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        title: wo.title,
        status: wo.status,
        scheduledDate: wo.scheduledDate,
        completedDate: wo.completedDate,
        completionPhotoUrl: wo.completionPhotoUrl
      }));
      return {
        summary: { totalPlans, activePlans, inactivePlans, overduePlans },
        workOrders: { total: totalWOs, completed: completedWOs, inProgress: inProgressWOs, scheduled: scheduledWOs, overdue: overdueWOs, cancelled: cancelledWOs, completionRate },
        checklist: { total: totalChecklistItems, done: doneChecklistItems, completionRate: checklistCompletionRate },
        byFrequency,
        recentWorkOrders
      };
    })
  }),
  // ============================================================
  // KPI LIVE TRACKING
  // ============================================================
  kpi: router({
    // جلب بيانات Timeline للبلاغات النشطة (24 ساعة الأخيرة)
    getTicketTimelines: managerProcedure.query(async () => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const { tickets: tickets2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { desc: descOp } = await import("drizzle-orm");
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
      const rows = await ddb.select({
        id: tickets2.id,
        ticketNumber: tickets2.ticketNumber,
        title: tickets2.title,
        status: tickets2.status,
        priority: tickets2.priority,
        createdAt: tickets2.createdAt,
        assignedAt: tickets2.assignedAt,
        closedAt: tickets2.closedAt,
        assignedToId: tickets2.assignedToId,
        updatedAt: tickets2.updatedAt
      }).from(tickets2).where(and3(gte2(tickets2.createdAt, cutoff))).orderBy(descOp(tickets2.createdAt)).limit(20);
      const SLA = {
        triage: 30,
        // الفرز خلال 30 دقيقة
        assignment: 60,
        // الإسناد خلال ساعة
        fieldWork: 240,
        // بدء العمل خلال 4 ساعات
        closure: 2880
        // الإغلاق خلال 48 ساعة
      };
      const now = Date.now();
      return rows.map((t2) => {
        const createdMs = new Date(t2.createdAt).getTime();
        const assignedMs = t2.assignedAt ? new Date(t2.assignedAt).getTime() : null;
        const closedMs = t2.closedAt ? new Date(t2.closedAt).getTime() : null;
        const updatedMs = new Date(t2.updatedAt).getTime();
        const triageMs = updatedMs > createdMs ? updatedMs : null;
        const triageDuration = triageMs ? Math.round((triageMs - createdMs) / 6e4) : null;
        const triageStatus = triageMs ? triageDuration <= SLA.triage ? "ok" : triageDuration <= SLA.triage * 2 ? "warning" : "overdue" : (now - createdMs) / 6e4 > SLA.triage ? "overdue" : "pending";
        const assignDuration = assignedMs && triageMs ? Math.round((assignedMs - triageMs) / 6e4) : null;
        const assignStatus = assignedMs ? assignDuration <= SLA.assignment ? "ok" : assignDuration <= SLA.assignment * 2 ? "warning" : "overdue" : t2.assignedToId ? "ok" : triageMs && (now - triageMs) / 6e4 > SLA.assignment ? "overdue" : "pending";
        const fieldStart = ["in_progress", "repaired", "verified", "closed"].includes(t2.status) ? assignedMs : null;
        const fieldDuration = fieldStart && assignedMs ? Math.round((fieldStart - assignedMs) / 6e4) : null;
        const fieldStatus = fieldStart ? fieldDuration <= SLA.fieldWork ? "ok" : fieldDuration <= SLA.fieldWork * 1.5 ? "warning" : "overdue" : assignedMs ? (now - assignedMs) / 6e4 > SLA.fieldWork ? "overdue" : "pending" : "pending";
        const closureDuration = closedMs ? Math.round((closedMs - createdMs) / 6e4) : null;
        const closureStatus = closedMs ? "done" : (now - createdMs) / 6e4 > SLA.closure ? "overdue" : (now - createdMs) / 6e4 > SLA.closure * 0.75 ? "warning" : "pending";
        let bottleneck = null;
        if (closureStatus === "overdue") bottleneck = "\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0625\u063A\u0644\u0627\u0642";
        else if (fieldStatus === "overdue") bottleneck = "\u0628\u062F\u0621 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A";
        else if (assignStatus === "overdue") bottleneck = "\u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0641\u0646\u064A";
        else if (triageStatus === "overdue") bottleneck = "\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0641\u0631\u0632";
        const totalMin = Math.round((now - createdMs) / 6e4);
        const overallStatus = bottleneck ? "overdue" : closedMs ? "done" : "ok";
        return {
          id: t2.id,
          ticketNumber: t2.ticketNumber,
          title: t2.title,
          status: t2.status,
          priority: t2.priority,
          overallStatus,
          bottleneck,
          totalMinutes: totalMin,
          steps: [
            {
              label: "\u0641\u062A\u062D \u0627\u0644\u0628\u0644\u0627\u063A",
              icon: "create",
              completedAt: t2.createdAt,
              durationMin: null,
              status: "done",
              slaMin: null
            },
            {
              label: "\u0627\u0644\u0641\u0631\u0632 \u0648\u0627\u0644\u062A\u0635\u0646\u064A\u0641",
              icon: "triage",
              completedAt: triageMs ? new Date(triageMs) : null,
              durationMin: triageDuration,
              status: triageStatus,
              slaMin: SLA.triage
            },
            {
              label: "\u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0641\u0646\u064A",
              icon: "assign",
              completedAt: t2.assignedAt,
              durationMin: assignDuration,
              status: assignStatus,
              slaMin: SLA.assignment
            },
            {
              label: "\u0628\u062F\u0621 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A",
              icon: "field",
              completedAt: fieldStart ? new Date(fieldStart) : null,
              durationMin: fieldDuration,
              status: fieldStatus,
              slaMin: SLA.fieldWork
            },
            {
              label: "\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0628\u0644\u0627\u063A",
              icon: "close",
              completedAt: t2.closedAt,
              durationMin: closureDuration,
              status: closureStatus,
              slaMin: SLA.closure
            }
          ]
        };
      });
    }),
    // جلب بيانات Timeline لطلبات الشراء
    getPOTimelines: managerProcedure.query(async () => {
      const ddb = await getDb();
      if (!ddb) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const { purchaseOrders: purchaseOrders2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { desc: descOp2 } = await import("drizzle-orm");
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
      const rows = await ddb.select({
        id: purchaseOrders2.id,
        poNumber: purchaseOrders2.poNumber,
        status: purchaseOrders2.status,
        createdAt: purchaseOrders2.createdAt,
        accountingApprovedAt: purchaseOrders2.accountingApprovedAt,
        managementApprovedAt: purchaseOrders2.managementApprovedAt,
        rejectedAt: purchaseOrders2.rejectedAt,
        updatedAt: purchaseOrders2.updatedAt
      }).from(purchaseOrders2).where(and3(gte2(purchaseOrders2.createdAt, cutoff))).orderBy(descOp2(purchaseOrders2.createdAt)).limit(20);
      const SLA = {
        estimate: 240,
        // التسعير 4 ساعات
        accounting: 480,
        // المحاسبة 8 ساعات
        management: 240,
        // الإدارة 4 ساعات
        purchase: 1440
        // الشراء 24 ساعة
      };
      const now = Date.now();
      return rows.map((po) => {
        const createdMs = new Date(po.createdAt).getTime();
        const accMs = po.accountingApprovedAt ? new Date(po.accountingApprovedAt).getTime() : null;
        const mgmtMs = po.managementApprovedAt ? new Date(po.managementApprovedAt).getTime() : null;
        const rejectedMs = po.rejectedAt ? new Date(po.rejectedAt).getTime() : null;
        const updatedMs = new Date(po.updatedAt).getTime();
        const estimateMs = ["pending_accounting", "pending_management", "approved", "partial_purchase", "purchased", "received", "closed"].includes(po.status) ? updatedMs : null;
        const estimateDuration = estimateMs ? Math.round((estimateMs - createdMs) / 6e4) : null;
        const estimateStatus = estimateMs ? estimateDuration <= SLA.estimate ? "ok" : estimateDuration <= SLA.estimate * 2 ? "warning" : "overdue" : (now - createdMs) / 6e4 > SLA.estimate ? "overdue" : "pending";
        const accDuration = accMs && estimateMs ? Math.round((accMs - estimateMs) / 6e4) : null;
        const accStatus = accMs ? "done" : estimateMs ? (now - estimateMs) / 6e4 > SLA.accounting ? "overdue" : (now - estimateMs) / 6e4 > SLA.accounting * 0.75 ? "warning" : "pending" : "pending";
        const mgmtDuration = mgmtMs && accMs ? Math.round((mgmtMs - accMs) / 6e4) : null;
        const mgmtStatus = mgmtMs ? "done" : accMs ? (now - accMs) / 6e4 > SLA.management ? "overdue" : (now - accMs) / 6e4 > SLA.management * 0.75 ? "warning" : "pending" : "pending";
        const purchaseStatus = ["purchased", "received", "closed"].includes(po.status) ? "done" : rejectedMs ? "overdue" : mgmtMs ? (now - mgmtMs) / 6e4 > SLA.purchase ? "overdue" : "pending" : "pending";
        let bottleneck = null;
        if (purchaseStatus === "overdue" && !rejectedMs) bottleneck = "\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0634\u0631\u0627\u0621";
        else if (mgmtStatus === "overdue") bottleneck = "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0625\u062F\u0627\u0631\u0629";
        else if (accStatus === "overdue") bottleneck = "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629";
        else if (estimateStatus === "overdue") bottleneck = "\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062A\u0633\u0639\u064A\u0631";
        const totalMin = Math.round((now - createdMs) / 6e4);
        const overallStatus = rejectedMs ? "rejected" : bottleneck ? "overdue" : ["purchased", "received", "closed"].includes(po.status) ? "done" : "ok";
        return {
          id: po.id,
          poNumber: po.poNumber,
          status: po.status,
          overallStatus,
          bottleneck,
          totalMinutes: totalMin,
          steps: [
            { label: "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628", icon: "create", completedAt: po.createdAt, durationMin: null, status: "done", slaMin: null },
            { label: "\u0625\u0636\u0627\u0641\u0629 \u0639\u0631\u0648\u0636 \u0627\u0644\u0623\u0633\u0639\u0627\u0631", icon: "estimate", completedAt: estimateMs ? new Date(estimateMs) : null, durationMin: estimateDuration, status: estimateStatus, slaMin: SLA.estimate },
            { label: "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629", icon: "accounting", completedAt: po.accountingApprovedAt, durationMin: accDuration, status: accStatus, slaMin: SLA.accounting },
            { label: "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0625\u062F\u0627\u0631\u0629", icon: "management", completedAt: po.managementApprovedAt, durationMin: mgmtDuration, status: mgmtStatus, slaMin: SLA.management },
            { label: "\u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u0627\u0644\u062A\u0633\u0644\u064A\u0645", icon: "purchase", completedAt: null, durationMin: null, status: purchaseStatus, slaMin: SLA.purchase }
          ]
        };
      });
    })
  }),
  // ============================================================
  // PUSH NOTIFICATIONS
  // ============================================================
  push: router({
    getVapidPublicKey: publicProcedure.query(() => {
      return { publicKey: process.env.VAPID_PUBLIC_KEY || "" };
    }),
    subscribe: protectedProcedure.input(z3.object({
      endpoint: z3.string().url(),
      p256dh: z3.string(),
      auth: z3.string(),
      userAgent: z3.string().optional()
    })).mutation(async ({ input, ctx }) => {
      await savePushSubscription({
        userId: ctx.user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent
      });
      return { success: true };
    }),
    unsubscribe: protectedProcedure.input(z3.object({
      endpoint: z3.string()
    })).mutation(async ({ input }) => {
      await deletePushSubscription(input.endpoint);
      return { success: true };
    }),
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const subs = await getPushSubscriptionsByUser(ctx.user.id);
      return { subscribed: subs.length > 0, count: subs.length };
    })
  })
});

// server/_core/context.ts
init_sdk();
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid as nanoid2 } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import { nanoid as nanoid3 } from "nanoid";
import sharp from "sharp";

// server/exportService.ts
init_db();
import ExcelJS from "exceljs";
function styleHeader(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B7A4A" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 30;
  worksheet.columns.forEach((col) => {
    col.width = Math.max(col.width || 15, 15);
  });
}
function addRtlSupport(worksheet) {
  worksheet.views = [{ rightToLeft: true }];
}
async function exportTicketsToExcel() {
  const tickets2 = await getTickets();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = /* @__PURE__ */ new Date();
  const ws = workbook.addWorksheet("\u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A");
  addRtlSupport(ws);
  ws.columns = [
    { header: "\u0631\u0642\u0645 \u0627\u0644\u0628\u0644\u0627\u063A", key: "id", width: 12 },
    { header: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", key: "title", width: 35 },
    { header: "\u0627\u0644\u0648\u0635\u0641", key: "description", width: 45 },
    { header: "\u0627\u0644\u062D\u0627\u0644\u0629", key: "status", width: 18 },
    { header: "\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629", key: "priority", width: 15 },
    { header: "\u0627\u0644\u0641\u0626\u0629", key: "category", width: 18 },
    { header: "\u0627\u0644\u0645\u0648\u0642\u0639", key: "siteId", width: 12 },
    { header: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621", key: "createdAt", width: 22 }
  ];
  styleHeader(ws);
  const statusMap = {
    open: "\u0645\u0641\u062A\u0648\u062D",
    in_progress: "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630",
    pending_approval: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F",
    pending_quote: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0633\u0639\u064A\u0631",
    pending_po: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621",
    pending_funding: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0645\u0648\u064A\u0644",
    closed: "\u0645\u063A\u0644\u0642",
    rejected: "\u0645\u0631\u0641\u0648\u0636"
  };
  const priorityMap = {
    low: "\u0645\u0646\u062E\u0641\u0636\u0629",
    medium: "\u0645\u062A\u0648\u0633\u0637\u0629",
    high: "\u0639\u0627\u0644\u064A\u0629",
    critical: "\u062D\u0631\u062C\u0629"
  };
  const categoryMap = {
    electrical: "\u0643\u0647\u0631\u0628\u0627\u0621",
    plumbing: "\u0633\u0628\u0627\u0643\u0629",
    hvac: "\u062A\u0643\u064A\u064A\u0641",
    structural: "\u0625\u0646\u0634\u0627\u0626\u064A",
    elevator: "\u0645\u0635\u0627\u0639\u062F",
    fire_safety: "\u0633\u0644\u0627\u0645\u0629",
    cleaning: "\u0646\u0638\u0627\u0641\u0629",
    other: "\u0623\u062E\u0631\u0649"
  };
  tickets2.forEach((t2) => {
    ws.addRow({
      id: t2.id,
      title: t2.title,
      description: t2.description,
      status: statusMap[t2.status] || t2.status,
      priority: priorityMap[t2.priority] || t2.priority,
      category: categoryMap[t2.category] || t2.category,
      siteId: t2.siteId,
      createdAt: new Date(t2.createdAt).toLocaleString("ar-SA")
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function exportPurchaseOrdersToExcel() {
  const pos = await getPurchaseOrders();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = /* @__PURE__ */ new Date();
  const ws = workbook.addWorksheet("\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0627\u0621");
  addRtlSupport(ws);
  ws.columns = [
    { header: "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628", key: "poNumber", width: 18 },
    { header: "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A", key: "notes", width: 40 },
    { header: "\u0627\u0644\u062D\u0627\u0644\u0629", key: "status", width: 18 },
    { header: "\u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0642\u062F\u0631\u0629", key: "estimated", width: 18 },
    { header: "\u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0641\u0639\u0644\u064A\u0629", key: "actual", width: 18 },
    { header: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621", key: "createdAt", width: 22 }
  ];
  styleHeader(ws);
  const poStatusMap = {
    draft: "\u0645\u0633\u0648\u062F\u0629",
    pending_approval: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F",
    approved: "\u0645\u0639\u062A\u0645\u062F",
    quoted: "\u062A\u0645 \u0627\u0644\u062A\u0633\u0639\u064A\u0631",
    funded: "\u062A\u0645 \u0627\u0644\u062A\u0645\u0648\u064A\u0644",
    purchased: "\u062A\u0645 \u0627\u0644\u0634\u0631\u0627\u0621",
    received: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645",
    rejected: "\u0645\u0631\u0641\u0648\u0636",
    cancelled: "\u0645\u0644\u063A\u064A"
  };
  pos.forEach((po) => {
    ws.addRow({
      poNumber: po.poNumber,
      notes: po.notes || "-",
      status: poStatusMap[po.status] || po.status,
      estimated: parseFloat(po.totalEstimatedCost || "0"),
      actual: parseFloat(po.totalActualCost || "0"),
      createdAt: new Date(po.createdAt).toLocaleString("ar-SA")
    });
  });
  ws.getColumn("estimated").numFmt = '#,##0.00 "\u0631.\u0633"';
  ws.getColumn("actual").numFmt = '#,##0.00 "\u0631.\u0633"';
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function exportTechnicianPerformanceToExcel(filters) {
  const data = await getTechnicianPerformance(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = /* @__PURE__ */ new Date();
  const ws = workbook.addWorksheet("\u0623\u062F\u0627\u0621 \u0627\u0644\u0641\u0646\u064A\u064A\u0646");
  addRtlSupport(ws);
  ws.columns = [
    { header: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0646\u064A", key: "name", width: 25 },
    { header: "\u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A \u0627\u0644\u0645\u0633\u0646\u062F\u0629", key: "assigned", width: 18 },
    { header: "\u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629", key: "completed", width: 15 },
    { header: "\u0646\u0633\u0628\u0629 \u0627\u0644\u0625\u0646\u062C\u0627\u0632", key: "completionRate", width: 18 },
    { header: "\u0645\u062A\u0648\u0633\u0637 \u0648\u0642\u062A \u0627\u0644\u062D\u0644 (\u0633\u0627\u0639\u0629)", key: "avgTime", width: 25 },
    { header: "\u062F\u0631\u062C\u0629 \u0627\u0644\u0623\u062F\u0627\u0621", key: "score", width: 18 }
  ];
  styleHeader(ws);
  data.forEach((t2) => {
    ws.addRow({
      name: t2.name,
      assigned: t2.assignedTickets,
      completed: t2.completedTickets,
      completionRate: `${t2.completionRate}%`,
      avgTime: t2.avgResolutionTime,
      score: t2.performanceScore
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function exportAuditLogToExcel(filters) {
  const logs = await getAuditLogsEnhanced(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = /* @__PURE__ */ new Date();
  const ws = workbook.addWorksheet("\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642");
  addRtlSupport(ws);
  ws.columns = [
    { header: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", key: "date", width: 22 },
    { header: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", key: "user", width: 20 },
    { header: "\u0627\u0644\u0625\u062C\u0631\u0627\u0621", key: "action", width: 18 },
    { header: "\u0646\u0648\u0639 \u0627\u0644\u0643\u064A\u0627\u0646", key: "entityType", width: 18 },
    { header: "\u0631\u0642\u0645 \u0627\u0644\u0643\u064A\u0627\u0646", key: "entityId", width: 12 },
    { header: "\u0627\u0644\u0648\u0635\u0641", key: "description", width: 45 },
    { header: "\u0627\u0644\u0642\u064A\u0645 \u0627\u0644\u0642\u062F\u064A\u0645\u0629", key: "oldValues", width: 40 },
    { header: "\u0627\u0644\u0642\u064A\u0645 \u0627\u0644\u062C\u062F\u064A\u062F\u0629", key: "newValues", width: 40 }
  ];
  styleHeader(ws);
  const actionMap = {
    create: "\u0625\u0646\u0634\u0627\u0621",
    update: "\u062A\u0639\u062F\u064A\u0644",
    delete: "\u062D\u0630\u0641",
    status_change: "\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629",
    approve: "\u0627\u0639\u062A\u0645\u0627\u062F",
    reject: "\u0631\u0641\u0636",
    assign: "\u0625\u0633\u0646\u0627\u062F",
    purchase: "\u0634\u0631\u0627\u0621",
    deliver: "\u062A\u0648\u0631\u064A\u062F"
  };
  const entityMap = {
    ticket: "\u0628\u0644\u0627\u063A",
    purchase_order: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621",
    po_item: "\u0635\u0646\u0641 \u0634\u0631\u0627\u0621",
    inventory: "\u0645\u062E\u0632\u0648\u0646",
    site: "\u0645\u0648\u0642\u0639",
    user: "\u0645\u0633\u062A\u062E\u062F\u0645"
  };
  logs.forEach((log) => {
    ws.addRow({
      date: new Date(log.createdAt).toLocaleString("ar-SA"),
      user: log.userName || `\u0645\u0633\u062A\u062E\u062F\u0645 #${log.userId}`,
      action: actionMap[log.action] || log.action,
      entityType: entityMap[log.entityType] || log.entityType,
      entityId: log.entityId,
      description: log.description,
      oldValues: log.oldValues ? JSON.stringify(log.oldValues, null, 0) : "",
      newValues: log.newValues ? JSON.stringify(log.newValues, null, 0) : ""
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function exportInventoryToExcel() {
  const items = await getInventoryItems();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = /* @__PURE__ */ new Date();
  const ws = workbook.addWorksheet("\u0627\u0644\u0645\u062E\u0632\u0648\u0646");
  addRtlSupport(ws);
  ws.columns = [
    { header: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641", key: "name", width: 30 },
    { header: "\u0631\u0642\u0645 \u0627\u0644\u0642\u0637\u0639\u0629", key: "partNumber", width: 18 },
    { header: "\u0627\u0644\u0643\u0645\u064A\u0629", key: "quantity", width: 12 },
    { header: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649", key: "minQuantity", width: 15 },
    { header: "\u0627\u0644\u0648\u062D\u062F\u0629", key: "unit", width: 12 },
    { header: "\u0627\u0644\u0645\u0648\u0642\u0639", key: "location", width: 20 },
    { header: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0636\u0627\u0641\u0629", key: "createdAt", width: 22 }
  ];
  styleHeader(ws);
  items.forEach((item) => {
    ws.addRow({
      name: item.itemName,
      partNumber: item.partNumber || "-",
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      unit: item.unit,
      location: item.location || "-",
      createdAt: new Date(item.createdAt).toLocaleString("ar-SA")
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function exportPreventivePlansToExcel() {
  const plans = await listPreventivePlans();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = /* @__PURE__ */ new Date();
  const ws = workbook.addWorksheet("\u062E\u0637\u0637 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0648\u0642\u0627\u0626\u064A\u0629");
  addRtlSupport(ws);
  ws.columns = [
    { header: "\u0631\u0642\u0645 \u0627\u0644\u062E\u0637\u0629", key: "planNumber", width: 15 },
    { header: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", key: "title", width: 35 },
    { header: "\u0627\u0644\u062A\u0643\u0631\u0627\u0631", key: "frequency", width: 15 },
    { header: "\u0627\u0644\u062D\u0627\u0644\u0629", key: "isActive", width: 12 },
    { header: "\u0645\u0648\u0639\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0642\u0627\u062F\u0645", key: "nextDueDate", width: 22 },
    { header: "\u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A\u0629 (\u062F\u0642\u064A\u0642\u0629)", key: "estimatedDuration", width: 22 },
    { header: "\u0639\u062F\u062F \u0628\u0646\u0648\u062F \u0627\u0644\u062A\u062D\u0642\u0642", key: "checklistCount", width: 18 },
    { header: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621", key: "createdAt", width: 22 }
  ];
  styleHeader(ws);
  const freqMap = {
    daily: "\u064A\u0648\u0645\u064A",
    weekly: "\u0623\u0633\u0628\u0648\u0639\u064A",
    monthly: "\u0634\u0647\u0631\u064A",
    quarterly: "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
    biannual: "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A",
    annual: "\u0633\u0646\u0648\u064A"
  };
  plans.forEach((p) => {
    ws.addRow({
      planNumber: p.planNumber,
      title: p.title,
      frequency: freqMap[p.frequency] || p.frequency,
      isActive: p.isActive !== false ? "\u0646\u0634\u0637" : "\u0645\u062A\u0648\u0642\u0641",
      nextDueDate: p.nextDueDate ? new Date(p.nextDueDate).toLocaleDateString("ar-SA") : "-",
      estimatedDuration: p.estimatedDurationMinutes || "-",
      checklistCount: Array.isArray(p.checklist) ? p.checklist.length : 0,
      createdAt: new Date(p.createdAt).toLocaleString("ar-SA")
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function exportPMWorkOrdersToExcel() {
  const workOrders = await listPMWorkOrders();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = /* @__PURE__ */ new Date();
  const ws = workbook.addWorksheet("\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0648\u0642\u0627\u0626\u064A\u0629");
  addRtlSupport(ws);
  ws.columns = [
    { header: "\u0631\u0642\u0645 \u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", key: "workOrderNumber", width: 18 },
    { header: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", key: "title", width: 35 },
    { header: "\u0627\u0644\u062D\u0627\u0644\u0629", key: "status", width: 15 },
    { header: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062C\u062F\u0648\u0644\u0629", key: "scheduledDate", width: 20 },
    { header: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u062C\u0627\u0632", key: "completedDate", width: 20 },
    { header: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0641\u0646\u064A", key: "technicianNotes", width: 40 },
    { header: "\u0635\u0648\u0631\u0629 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0639\u0645\u0644", key: "completionPhoto", width: 18 },
    { header: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621", key: "createdAt", width: 22 }
  ];
  styleHeader(ws);
  const statusMap = {
    scheduled: "\u0645\u062C\u062F\u0648\u0644",
    in_progress: "\u062C\u0627\u0631\u064A",
    completed: "\u0645\u0643\u062A\u0645\u0644",
    overdue: "\u0645\u062A\u0623\u062E\u0631",
    cancelled: "\u0645\u0644\u063A\u064A"
  };
  workOrders.forEach((wo) => {
    ws.addRow({
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      status: statusMap[wo.status] || wo.status,
      scheduledDate: wo.scheduledDate ? new Date(wo.scheduledDate).toLocaleDateString("ar-SA") : "-",
      completedDate: wo.completedDate ? new Date(wo.completedDate).toLocaleDateString("ar-SA") : "-",
      technicianNotes: wo.technicianNotes || "-",
      completionPhoto: wo.completionPhotoUrl ? "\u0645\u0631\u0641\u0648\u0639\u0629" : "-",
      createdAt: new Date(wo.createdAt).toLocaleString("ar-SA")
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// server/workflowPdfService.ts
import PDFDocument from "pdfkit";
async function generateWorkflowGuidePDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: "CMMS Workflow Guide - \u062F\u0644\u064A\u0644 \u0633\u064A\u0631 \u0627\u0644\u0639\u0645\u0644",
        Author: "\u0646\u0638\u0627\u0645 CMMS - Tolan",
        Subject: "Workflow Status Transitions Manual",
        Keywords: "CMMS, Maintenance, Workflow, Triage, Gate Security"
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.rect(0, 0, doc.page.width, 200).fill("#1e293b");
    doc.fillColor("#ffffff").fontSize(28).text("CMMS Workflow Training Manual", 50, 60, { align: "center" }).fontSize(16).text("Status Transitions & Role Responsibilities", 50, 100, { align: "center" }).fontSize(12).fillColor("#94a3b8").text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-GB")}`, 50, 140, { align: "center" });
    doc.moveDown(6);
    const sectionTitle = (title) => {
      doc.moveDown(1).rect(50, doc.y, doc.page.width - 100, 28).fill("#1e40af");
      doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold").text(title, 58, doc.y - 22, { lineBreak: false });
      doc.moveDown(1.5).fillColor("#1e293b").font("Helvetica");
    };
    const row = (label, value, shade = false) => {
      const y = doc.y;
      if (shade) doc.rect(50, y, doc.page.width - 100, 18).fill("#f1f5f9");
      doc.fillColor("#374151").fontSize(9).font("Helvetica-Bold").text(label, 58, y + 4, { width: 180, lineBreak: false }).font("Helvetica").text(value, 245, y + 4, { width: doc.page.width - 295, lineBreak: false });
      doc.moveDown(0.9);
    };
    sectionTitle("1. System Overview");
    doc.fontSize(10).fillColor("#374151").text(
      "The CMMS (Computerized Maintenance Management System) routes every maintenance ticket through three defined paths. All tickets start at PENDING_TRIAGE and end at CLOSED. The Supervisor (Eng. Khaled) performs triage; the Maintenance Manager (Abdel Fattah) approves work and selects the path; technicians execute repairs.",
      { align: "left" }
    );
    sectionTitle("2. Status Reference Table");
    doc.rect(50, doc.y, doc.page.width - 100, 20).fill("#334155");
    doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold").text("#", 58, doc.y - 15, { width: 20, lineBreak: false }).text("Status Code", 82, doc.y - 15, { width: 140, lineBreak: false }).text("Arabic Name", 228, doc.y - 15, { width: 130, lineBreak: false }).text("Responsible Role", 362, doc.y - 15, { width: 160, lineBreak: false });
    doc.moveDown(1.2);
    const statuses = [
      ["1", "pending_triage", "Awaiting Triage", "Supervisor (Khaled)"],
      ["2", "under_inspection", "Under Inspection", "Supervisor (Khaled)"],
      ["3", "work_approved", "Work Approved", "Maintenance Manager (Abdel Fattah)"],
      ["4", "assigned", "Assigned to Technician", "Maintenance Manager"],
      ["5", "in_progress", "In Progress", "Technician"],
      ["6", "repaired", "Repaired", "Technician"],
      ["7", "needs_purchase", "Needs Purchase (Path B)", "Maintenance Manager"],
      ["8", "pending_po_approval", "Awaiting PO Approval", "Supervisor (Khaled)"],
      ["9", "po_approved", "PO Approved", "Supervisor (Khaled)"],
      ["10", "out_for_repair", "Out for External Repair (Path C)", "Gate Security"],
      ["11", "ready_for_closure", "Ready for Closure", "Supervisor / Maint. Manager"],
      ["12", "closed", "Closed", "Khaled (A) / Abdel Fattah (B/C)"],
      ["13", "cancelled", "Cancelled", "Admin / Owner"]
    ];
    statuses.forEach(([num, code, name, role], i) => {
      const y = doc.y;
      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 17).fill("#f8fafc");
      doc.fillColor("#1e293b").fontSize(8.5).font("Helvetica-Bold").text(num, 58, y + 3, { width: 20, lineBreak: false }).font("Courier").fillColor("#1d4ed8").text(code, 82, y + 3, { width: 140, lineBreak: false }).font("Helvetica").fillColor("#374151").text(name, 228, y + 3, { width: 130, lineBreak: false }).fillColor("#6b7280").text(role, 362, y + 3, { width: 160, lineBreak: false });
      doc.moveDown(0.85);
    });
    doc.addPage();
    sectionTitle("3. Path A \u2014 Internal Direct Repair");
    doc.fontSize(10).fillColor("#374151").text(
      "Trigger: No spare parts needed, no external workshop required.\nClosure Right: Supervisor (Eng. Khaled) ONLY."
    );
    doc.moveDown(0.5);
    const pathASteps = [
      ["1", "Ticket Created", "pending_triage", "System auto-assigns on creation"],
      ["2", "Supervisor Triage", "under_inspection", "Khaled: Quick Triage or Detailed Triage"],
      ["3", "Inspection Complete", "work_approved", "Khaled: Completes field inspection + notes"],
      ["4", "Manager Approves", "assigned", "Abdel Fattah: Selects Path A + assigns technician"],
      ["5", "Technician Works", "in_progress", "Technician starts repair"],
      ["6", "Repair Done", "repaired", "Technician uploads after-repair photo"],
      ["7", "Mark Ready", "ready_for_closure", "Manager marks ready for closure"],
      ["8", "Final Closure \u2705", "closed", "Khaled closes the ticket (Path A only)"]
    ];
    doc.rect(50, doc.y, doc.page.width - 100, 20).fill("#1e40af");
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold").text("Step", 58, doc.y - 15, { width: 30, lineBreak: false }).text("Action", 92, doc.y - 15, { width: 130, lineBreak: false }).text("Resulting Status", 226, doc.y - 15, { width: 140, lineBreak: false }).text("Notes", 370, doc.y - 15, { width: 160, lineBreak: false });
    doc.moveDown(1.2);
    pathASteps.forEach(([step, action, status, note], i) => {
      const y = doc.y;
      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 17).fill("#eff6ff");
      doc.fillColor("#1e293b").fontSize(8.5).font("Helvetica-Bold").text(step, 58, y + 3, { width: 30, lineBreak: false }).font("Helvetica").text(action, 92, y + 3, { width: 130, lineBreak: false }).font("Courier").fillColor("#1d4ed8").text(status, 226, y + 3, { width: 140, lineBreak: false }).font("Helvetica").fillColor("#6b7280").text(note, 370, y + 3, { width: 160, lineBreak: false });
      doc.moveDown(0.85);
    });
    doc.moveDown(1);
    sectionTitle("4. Path B \u2014 Internal Repair + Procurement");
    doc.fontSize(10).fillColor("#374151").text(
      "Trigger: Repair requires spare parts not in stock.\nBatching Rule: MAX 15 items per Purchase Order.\nWarehouse Visibility: Warehouse sees items ONLY after Delegate confirms purchase.\nClosure Right: Maintenance Manager (Abdel Fattah) ONLY."
    );
    doc.moveDown(0.5);
    const pathBSteps = [
      ["1-4", "Same as Path A (Triage \u2192 Approval)", "work_approved", ""],
      ["5", "Manager selects Path B", "needs_purchase", "Abdel Fattah: creates PO (max 15 items)"],
      ["6", "Khaled approves PO", "po_approved", "Batching limit enforced by system"],
      ["7", "Delegate purchases items", "\u2014", "Delegate uploads receipt photos per item"],
      ["8", "Warehouse receives items", "\u2014", "Warehouse confirms receipt + actual cost"],
      ["9", "Technician repairs", "in_progress \u2192 repaired", "After all items received"],
      ["10", "Ready for closure", "ready_for_closure", "Manager marks ready"],
      ["11", "Final Closure \u2705", "closed", "Abdel Fattah closes (Path B only)"]
    ];
    doc.rect(50, doc.y, doc.page.width - 100, 20).fill("#065f46");
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold").text("Step", 58, doc.y - 15, { width: 35, lineBreak: false }).text("Action", 97, doc.y - 15, { width: 155, lineBreak: false }).text("Status", 256, doc.y - 15, { width: 130, lineBreak: false }).text("Notes", 390, doc.y - 15, { width: 140, lineBreak: false });
    doc.moveDown(1.2);
    pathBSteps.forEach(([step, action, status, note], i) => {
      const y = doc.y;
      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 17).fill("#ecfdf5");
      doc.fillColor("#1e293b").fontSize(8.5).font("Helvetica-Bold").text(step, 58, y + 3, { width: 35, lineBreak: false }).font("Helvetica").text(action, 97, y + 3, { width: 155, lineBreak: false }).font("Courier").fillColor("#065f46").text(status, 256, y + 3, { width: 130, lineBreak: false }).font("Helvetica").fillColor("#6b7280").text(note, 390, y + 3, { width: 140, lineBreak: false });
      doc.moveDown(0.85);
    });
    doc.addPage();
    sectionTitle("5. Path C \u2014 External Workshop Repair");
    doc.fontSize(10).fillColor("#374151").text(
      "Trigger: Asset must be sent to an external workshop.\nGate Protocol: NO asset may exit or enter without Gate Security digital approval.\nJustification: Manager must provide written justification for external repair.\nClosure Right: Maintenance Manager (Abdel Fattah) ONLY."
    );
    doc.moveDown(0.5);
    const pathCSteps = [
      ["1-4", "Same as Path A (Triage \u2192 Approval)", "work_approved", ""],
      ["5", "Manager selects Path C + justification", "out_for_repair", "Written justification required"],
      ["6", "Gate Security approves EXIT \u2705", "out_for_repair", "Digital gate approval recorded"],
      ["7", "Asset at external workshop", "out_for_repair", "Delegate manages external repair"],
      ["8", "Asset returns", "\u2014", "Delegate brings asset back"],
      ["9", "Gate Security approves ENTRY \u2705", "ready_for_closure", "Digital gate entry recorded"],
      ["10", "Final Closure \u2705", "closed", "Abdel Fattah closes (Path C only)"]
    ];
    doc.rect(50, doc.y, doc.page.width - 100, 20).fill("#7c3aed");
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold").text("Step", 58, doc.y - 15, { width: 35, lineBreak: false }).text("Action", 97, doc.y - 15, { width: 155, lineBreak: false }).text("Status", 256, doc.y - 15, { width: 130, lineBreak: false }).text("Notes", 390, doc.y - 15, { width: 140, lineBreak: false });
    doc.moveDown(1.2);
    pathCSteps.forEach(([step, action, status, note], i) => {
      const y = doc.y;
      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 17).fill("#faf5ff");
      doc.fillColor("#1e293b").fontSize(8.5).font("Helvetica-Bold").text(step, 58, y + 3, { width: 35, lineBreak: false }).font("Helvetica").text(action, 97, y + 3, { width: 155, lineBreak: false }).font("Courier").fillColor("#7c3aed").text(status, 256, y + 3, { width: 130, lineBreak: false }).font("Helvetica").fillColor("#6b7280").text(note, 390, y + 3, { width: 140, lineBreak: false });
      doc.moveDown(0.85);
    });
    doc.moveDown(1);
    sectionTitle("6. Closure Rights Matrix (Critical)");
    [
      ["Path A", "Supervisor (Eng. Khaled)", "ready_for_closure"],
      ["Path B", "Maintenance Manager (Abdel Fattah)", "ready_for_closure"],
      ["Path C", "Maintenance Manager (Abdel Fattah)", "ready_for_closure"]
    ].forEach(([path3, who, prereq], i) => {
      const y = doc.y;
      const bg = i === 0 ? "#eff6ff" : i === 1 ? "#ecfdf5" : "#faf5ff";
      doc.rect(50, y, doc.page.width - 100, 20).fill(bg);
      doc.fillColor("#1e293b").fontSize(9).font("Helvetica-Bold").text(path3, 58, y + 5, { width: 60, lineBreak: false }).font("Helvetica").text(who, 122, y + 5, { width: 200, lineBreak: false }).font("Courier").fillColor("#dc2626").text(`Requires: ${prereq}`, 326, y + 5, { width: 200, lineBreak: false });
      doc.moveDown(1.1);
    });
    doc.moveDown(1);
    sectionTitle("7. Critical Business Rules");
    const rules = [
      ["Batching Limit", "Maximum 15 items per Purchase Order. System enforces this \u2014 excess items are rejected."],
      ["Gate Protocol", "No asset may exit or enter without Gate Security digital approval in the system."],
      ["Warehouse Visibility", "Warehouse staff see items ONLY after the Delegate confirms purchase (status = purchased)."],
      ["Path C Justification", "Selecting Path C requires a mandatory written justification from the Maintenance Manager."],
      ["Auto-Triage", "All new tickets automatically start at pending_triage \u2014 no manual status setting needed."],
      ["NFC/RFID Auto-Fill", "Scanning an NFC/RFID tag auto-fills Asset and Location fields in the new ticket form."],
      ["SLA Indicators", "Orange badge = ticket stuck >24 hours. Red badge = ticket stuck >48 hours. Requires immediate action."]
    ];
    rules.forEach(([rule, desc3], i) => {
      const y = doc.y;
      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 28).fill("#f8fafc");
      doc.fillColor("#1e293b").fontSize(9).font("Helvetica-Bold").text(`\u2022 ${rule}:`, 58, y + 5, { width: 130, lineBreak: false }).font("Helvetica").fillColor("#374151").text(desc3, 192, y + 5, { width: doc.page.width - 242 });
      doc.moveDown(0.3);
    });
    doc.addPage();
    sectionTitle("8. Role Summary & Quick Reference");
    const roles = [
      ["supervisor", "Eng. Khaled", "Triage tickets, approve POs, close Path A tickets"],
      ["maintenance_manager", "Abdel Fattah", "Approve work start, select path, close Path B/C"],
      ["technician", "Field Staff", "Execute repairs, upload after-repair photos"],
      ["gate_security", "Gate Guard", "Approve asset exit/entry for Path C"],
      ["delegate", "Procurement", "Confirm purchases, upload receipts, transport assets"],
      ["warehouse", "Warehouse", "Receive purchased items, confirm delivery to technician"],
      ["owner", "Owner", "Full system access, all operations"],
      ["admin", "System Admin", "Full system access, user management"]
    ];
    doc.rect(50, doc.y, doc.page.width - 100, 20).fill("#1e293b");
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold").text("Role Code", 58, doc.y - 15, { width: 120, lineBreak: false }).text("Person", 182, doc.y - 15, { width: 100, lineBreak: false }).text("Key Responsibilities", 286, doc.y - 15, { width: 250, lineBreak: false });
    doc.moveDown(1.2);
    roles.forEach(([code, person, resp], i) => {
      const y = doc.y;
      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 18).fill("#f1f5f9");
      doc.fillColor("#1e293b").fontSize(8.5).font("Courier").fillColor("#1d4ed8").text(code, 58, y + 4, { width: 120, lineBreak: false }).font("Helvetica-Bold").fillColor("#1e293b").text(person, 182, y + 4, { width: 100, lineBreak: false }).font("Helvetica").fillColor("#374151").text(resp, 286, y + 4, { width: 250, lineBreak: false });
      doc.moveDown(0.9);
    });
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill("#1e293b");
      doc.fillColor("#94a3b8").fontSize(8).text(
        `CMMS Workflow Manual  |  Confidential \u2014 Internal Use Only  |  Page ${i + 1} of ${range.count}`,
        50,
        doc.page.height - 22,
        { align: "center", width: doc.page.width - 100 }
      );
    }
    doc.end();
  });
}

// server/jobs/technician-overdue.ts
init_db();
init_schema();
import { eq as eq4, and as and4, isNotNull as isNotNull2, isNull as isNull2 } from "drizzle-orm";
var SLA_BY_PRIORITY = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 72
};
var DEFAULT_SLA_HOURS = 24;
async function runTechnicianOverdueJob() {
  try {
    const db = await getDb();
    if (!db) return;
    const now = Date.now();
    const assignedTickets = await db.select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      title: tickets.title,
      priority: tickets.priority,
      assignedAt: tickets.assignedAt,
      technicianName: technicians.name
    }).from(tickets).leftJoin(technicians, eq4(tickets.assignedTechnicianId, technicians.id)).where(
      and4(
        isNotNull2(tickets.assignedTechnicianId),
        isNotNull2(tickets.assignedAt),
        isNull2(tickets.closedAt)
      )
    );
    if (assignedTickets.length === 0) return;
    const overdueTickets = assignedTickets.filter((t2) => {
      if (!t2.assignedAt) return false;
      const slaHours = SLA_BY_PRIORITY[t2.priority] ?? DEFAULT_SLA_HOURS;
      const cutoff = new Date(now - slaHours * 60 * 60 * 1e3);
      return new Date(t2.assignedAt) < cutoff;
    });
    if (overdueTickets.length === 0) return;
    const byTechnician = {};
    for (const t2 of overdueTickets) {
      const key = t2.technicianName || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
      if (!byTechnician[key]) byTechnician[key] = { name: key, items: [] };
      byTechnician[key].items.push(t2);
    }
    const lines = Object.values(byTechnician).map(({ name, items }) => {
      const list = items.map((t2) => {
        const slaHours = SLA_BY_PRIORITY[t2.priority] ?? DEFAULT_SLA_HOURS;
        const hoursAgo = Math.floor((now - new Date(t2.assignedAt).getTime()) / 36e5);
        const priorityLabel = t2.priority === "critical" ? "\u062D\u0631\u062C" : t2.priority === "high" ? "\u0645\u0631\u062A\u0641\u0639" : t2.priority === "medium" ? "\u0645\u062A\u0648\u0633\u0637" : "\u0645\u0646\u062E\u0641\u0636";
        return `  \u2022 ${t2.ticketNumber} [${priorityLabel} - SLA: ${slaHours}h] - ${t2.title} (\u0645\u0646\u0630 ${hoursAgo} \u0633\u0627\u0639\u0629)`;
      }).join("\n");
      return `\u0627\u0644\u0641\u0646\u064A: ${name}
${list}`;
    }).join("\n\n");
    await notifyOwner({
      title: `\u26A0\uFE0F \u062A\u0646\u0628\u064A\u0647 SLA: ${overdueTickets.length} \u0628\u0644\u0627\u063A \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0645\u0639\u064A\u0627\u0631\u064A`,
      content: `\u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u062A\u062C\u0627\u0648\u0632\u062A \u0648\u0642\u062A SLA \u0627\u0644\u0645\u062D\u062F\u062F \u062D\u0633\u0628 \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629:

${lines}

---
\u0645\u0639\u0627\u064A\u064A\u0631 SLA: \u0639\u0627\u062C\u0644=4h | \u0645\u0631\u062A\u0641\u0639=8h | \u0645\u062A\u0648\u0633\u0637=24h | \u0645\u0646\u062E\u0641\u0636=72h`
    });
    console.log(`[TechnicianOverdue] Notified about ${overdueTickets.length} overdue tickets (SLA-based)`);
  } catch (err) {
    console.error("[TechnicianOverdue] Job error:", err);
  }
}

// server/jobs/pm-automation.ts
init_db();
init_schema();
import { eq as eq5 } from "drizzle-orm";
init_db();
init_webPush();
async function runPMAutomationJob() {
  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const now = /* @__PURE__ */ new Date();
    console.log(`[PM Automation] Job started at ${now.toISOString()}`);
    const activePlans = await db.select().from(preventivePlans).where(eq5(preventivePlans.isActive, true));
    let createdCount = 0;
    let notifiedCount = 0;
    const errors = [];
    for (const plan of activePlans) {
      try {
        if (!plan.nextDueDate) continue;
        const dueDate = new Date(plan.nextDueDate);
        if (dueDate <= now) {
          const woNumber = await generateWorkOrderNumber();
          await db.insert(pmWorkOrders).values({
            workOrderNumber: woNumber,
            planId: plan.id,
            assetId: plan.assetId ?? void 0,
            siteId: plan.siteId ?? void 0,
            title: plan.title,
            scheduledDate: dueDate,
            status: "scheduled",
            assignedToId: plan.assignedToId ?? void 0,
            checklistResults: plan.checklist ? plan.checklist.map((item) => ({
              id: item.id,
              text: item.text,
              done: false,
              notes: ""
            })) : [],
            originalLanguage: "ar"
          });
          const nextDue = calcNextDueDate(dueDate, plan.frequency, plan.frequencyValue ?? 1);
          await db.update(preventivePlans).set({ nextDueDate: nextDue, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(preventivePlans.id, plan.id));
          createdCount++;
          console.log(`[PM Automation] Created WO ${woNumber} for plan ${plan.planNumber}`);
          if (plan.assignedToId) {
            try {
              const result = await sendPushToUser(plan.assignedToId, {
                title: "\u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u0648\u0642\u0627\u0626\u064A\u0629 \u062C\u062F\u064A\u062F\u0629",
                body: `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646\u0643 \u0639\u0644\u0649 \u0623\u0645\u0631 \u0639\u0645\u0644: ${plan.title} (${woNumber})`,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png",
                tag: `pm-wo-${woNumber}`,
                url: "/preventive",
                type: "pm_work_order"
              });
              if (result.sent > 0) {
                notifiedCount++;
                console.log(`[PM Automation] Push sent to technician (userId=${plan.assignedToId}) for WO ${woNumber}`);
              } else {
                console.log(`[PM Automation] No active push subscriptions for technician (userId=${plan.assignedToId})`);
              }
            } catch (pushErr) {
              console.warn(`[PM Automation] Push notification failed for WO ${woNumber}:`, pushErr);
            }
          }
        }
      } catch (err) {
        errors.push(`Plan ${plan.planNumber}: ${String(err)}`);
        console.error(`[PM Automation] Error for plan ${plan.planNumber}:`, err);
      }
    }
    if (createdCount > 0) {
      await notifyOwner({
        title: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0648\u0642\u0627\u0626\u064A\u0629 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A\u0629",
        content: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 ${createdCount} \u0623\u0645\u0631 \u0639\u0645\u0644 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0644\u0644\u062E\u0637\u0637 \u0627\u0644\u0645\u0633\u062A\u062D\u0642\u0629\u060C \u0648\u062A\u0645 \u0625\u0634\u0639\u0627\u0631 ${notifiedCount} \u0641\u0646\u064A`
      });
    }
    console.log(`[PM Automation] Completed: ${createdCount} work orders created, ${notifiedCount} technicians notified, ${errors.length} errors`);
    return { success: true, createdCount, notifiedCount, errors };
  } catch (error) {
    console.error("[PM Automation] Fatal error:", error);
    return { success: false, error: String(error) };
  }
}

// server/jobs/pm-reminder.ts
init_db();
init_schema();
import { and as and5, inArray as inArray3 } from "drizzle-orm";
init_webPush();
var REMINDER_THRESHOLD_HOURS = 24;
async function runPMWorkOrderReminderJob() {
  try {
    const db = await getDb();
    if (!db) return;
    const now = /* @__PURE__ */ new Date();
    const cutoff = new Date(now.getTime() - REMINDER_THRESHOLD_HOURS * 60 * 60 * 1e3);
    const staleOrders = await db.select().from(pmWorkOrders).where(
      and5(
        inArray3(pmWorkOrders.status, ["scheduled", "in_progress"])
      )
    );
    const overdueOrders = staleOrders.filter((wo) => {
      if (!wo.scheduledDate) return false;
      const scheduled = new Date(wo.scheduledDate);
      return scheduled <= cutoff;
    });
    if (overdueOrders.length === 0) {
      console.log("[PM Reminder] No stale work orders found");
      return;
    }
    let notifiedCount = 0;
    const ownerLines = [];
    for (const wo of overdueOrders) {
      const hoursOverdue = Math.floor(
        (now.getTime() - new Date(wo.scheduledDate).getTime()) / (1e3 * 60 * 60)
      );
      if (wo.assignedToId) {
        try {
          const result = await sendPushToUser(wo.assignedToId, {
            title: "\u23F0 \u062A\u0630\u0643\u064A\u0631: \u0623\u0645\u0631 \u0639\u0645\u0644 \u0628\u062D\u0627\u062C\u0629 \u0644\u0644\u062A\u062D\u062F\u064A\u062B",
            body: `\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 ${wo.workOrderNumber} - ${wo.title} \u0644\u0645 \u064A\u064F\u062D\u062F\u064E\u0651\u062B \u0645\u0646\u0630 ${hoursOverdue} \u0633\u0627\u0639\u0629`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            tag: `pm-reminder-${wo.workOrderNumber}`,
            url: "/preventive",
            type: "pm_reminder"
          });
          if (result.sent > 0) {
            notifiedCount++;
            console.log(`[PM Reminder] Reminder sent to technician (userId=${wo.assignedToId}) for WO ${wo.workOrderNumber} (${hoursOverdue}h overdue)`);
          }
        } catch (err) {
          console.warn(`[PM Reminder] Push failed for WO ${wo.workOrderNumber}:`, err);
        }
      }
      ownerLines.push(`\u2022 ${wo.workOrderNumber} - ${wo.title} (\u0645\u0646\u0630 ${hoursOverdue} \u0633\u0627\u0639\u0629)`);
    }
    if (overdueOrders.length > 0) {
      await notifyOwner({
        title: `\u23F0 \u062A\u0630\u0643\u064A\u0631 \u0635\u064A\u0627\u0646\u0629 \u0648\u0642\u0627\u0626\u064A\u0629: ${overdueOrders.length} \u0623\u0645\u0631 \u0639\u0645\u0644 \u0628\u062F\u0648\u0646 \u062A\u062D\u062F\u064A\u062B`,
        content: `\u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u062A\u062C\u0627\u0648\u0632\u062A ${REMINDER_THRESHOLD_HOURS} \u0633\u0627\u0639\u0629 \u0628\u062F\u0648\u0646 \u062A\u062D\u062F\u064A\u062B \u0645\u0646 \u0627\u0644\u0641\u0646\u064A:

${ownerLines.join("\n")}

\u062A\u0645 \u0625\u0634\u0639\u0627\u0631 ${notifiedCount} \u0641\u0646\u064A`
      });
    }
    console.log(`[PM Reminder] Completed: ${overdueOrders.length} stale orders, ${notifiedCount} technicians notified`);
  } catch (err) {
    console.error("[PM Reminder] Job error:", err);
  }
}

// server/jobs/sla-overdue-push.ts
init_db();
init_schema();
init_webPush();
import { and as and6, isNull as isNull3, lt as lt3, ne as ne2 } from "drizzle-orm";
var SLA_HOURS = 48;
async function runSlaOverduePushJob() {
  try {
    const db = await getDb();
    if (!db) return;
    const now = Date.now();
    const cutoffMs = now - SLA_HOURS * 60 * 60 * 1e3;
    const overdueOrders = await db.select({
      id: pmWorkOrders.id,
      workOrderNumber: pmWorkOrders.workOrderNumber,
      title: pmWorkOrders.title,
      assignedToId: pmWorkOrders.assignedToId,
      scheduledDate: pmWorkOrders.scheduledDate,
      status: pmWorkOrders.status
    }).from(pmWorkOrders).where(
      and6(
        isNull3(pmWorkOrders.completedDate),
        ne2(pmWorkOrders.status, "completed"),
        ne2(pmWorkOrders.status, "cancelled"),
        lt3(pmWorkOrders.scheduledDate, new Date(cutoffMs))
      )
    );
    if (overdueOrders.length === 0) {
      console.log("[SlaOverduePush] No overdue PM work orders found.");
      return;
    }
    let notifiedCount = 0;
    for (const order of overdueOrders) {
      const hoursOverdue = Math.floor((now - new Date(order.scheduledDate).getTime()) / 36e5);
      if (order.assignedToId) {
        try {
          await sendPushToUser(order.assignedToId, {
            title: `\u23F0 \u062A\u062C\u0627\u0648\u0632 SLA: \u0623\u0645\u0631 \u0639\u0645\u0644 #${order.workOrderNumber}`,
            body: `\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 "${order.title}" \u062A\u062C\u0627\u0648\u0632 ${hoursOverdue} \u0633\u0627\u0639\u0629 \u062F\u0648\u0646 \u0625\u063A\u0644\u0627\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0641\u0648\u0631\u064A.`,
            url: "/preventive-maintenance"
          });
          notifiedCount++;
        } catch (e) {
        }
      }
    }
    const orderList = overdueOrders.map((o) => {
      const hrs = Math.floor((now - new Date(o.scheduledDate).getTime()) / 36e5);
      return `  \u2022 #${o.workOrderNumber} - ${o.title} (\u0645\u0646\u0630 ${hrs} \u0633\u0627\u0639\u0629)`;
    }).join("\n");
    await notifyOwner({
      title: `\u{1F534} \u062A\u0646\u0628\u064A\u0647 SLA: ${overdueOrders.length} \u0623\u0645\u0631 \u0639\u0645\u0644 \u0648\u0642\u0627\u0626\u064A \u062A\u062C\u0627\u0648\u0632 48 \u0633\u0627\u0639\u0629`,
      content: `\u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0645\u0639\u064A\u0627\u0631\u064A (48 \u0633\u0627\u0639\u0629) \u062F\u0648\u0646 \u0625\u063A\u0644\u0627\u0642:

${orderList}

\u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0641\u0648\u0631\u064A\u0629.`
    });
    console.log(`[SlaOverduePush] Notified about ${overdueOrders.length} overdue orders, ${notifiedCount} push sent.`);
  } catch (err) {
    console.error("[SlaOverduePush] Job error:", err);
  }
}

// server/pmWorkOrderPdfService.ts
init_db();
import PDFDocument2 from "pdfkit";
var STATUS_LABELS = {
  scheduled: "\u0645\u062C\u062F\u0648\u0644",
  in_progress: "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u0646\u0641\u064A\u0630",
  completed: "\u0645\u0643\u062A\u0645\u0644",
  overdue: "\u0645\u062A\u0623\u062E\u0631",
  cancelled: "\u0645\u0644\u063A\u0649"
};
var STATUS_COLORS = {
  scheduled: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#10b981",
  overdue: "#ef4444",
  cancelled: "#6b7280"
};
var ASSET_STATUS_LABELS = {
  active: "\u0646\u0634\u0637",
  inactive: "\u063A\u064A\u0631 \u0646\u0634\u0637",
  under_maintenance: "\u062A\u062D\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
  disposed: "\u0645\u064F\u0633\u062A\u0628\u0639\u062F"
};
async function generatePMWorkOrderPDF(workOrderId) {
  const wo = await getPMWorkOrderById(workOrderId);
  if (!wo) throw new Error("Work order not found");
  const plan = wo.planId ? await getPreventivePlanById(wo.planId) : null;
  const asset = wo.assetId ? await getAssetById(wo.assetId) : null;
  const assignedUser = wo.assignedToId ? await getUserById(wo.assignedToId) : null;
  const site = wo.siteId ? await getSiteById(wo.siteId) : null;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument2({ size: "A4", margin: 45, info: {
      Title: `\u0623\u0645\u0631 \u0639\u0645\u0644 \u0648\u0642\u0627\u0626\u064A - ${wo.workOrderNumber}`,
      Author: "\u0646\u0638\u0627\u0645 \u062A\u0648\u0644\u0627\u0646 \u0644\u0644\u0635\u064A\u0627\u0646\u0629"
    } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = doc.page.width - 90;
    const LEFT = 45;
    doc.rect(0, 0, doc.page.width, 75).fill("#1e293b");
    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("Work Order \u2014 \u0623\u0645\u0631 \u0639\u0645\u0644 \u0648\u0642\u0627\u0626\u064A", LEFT, 14, { align: "center", width: doc.page.width - 90 });
    doc.fontSize(11).fillColor("#94a3b8").text(`${wo.workOrderNumber}  |  \u0646\u0638\u0627\u0645 \u062A\u0648\u0644\u0627\u0646 \u0644\u0644\u0635\u064A\u0627\u0646\u0629`, LEFT, 40, { align: "center", width: doc.page.width - 90 });
    const statusColor = STATUS_COLORS[wo.status] ?? "#6b7280";
    const statusLabel = STATUS_LABELS[wo.status] ?? wo.status;
    doc.roundedRect(doc.page.width - 120, 20, 80, 22, 4).fill(statusColor);
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold").text(statusLabel, doc.page.width - 118, 27, { width: 76, align: "center" });
    doc.y = 90;
    const section = (title, color = "#1e40af") => {
      doc.moveDown(0.5);
      doc.rect(LEFT, doc.y, W, 22).fill(color);
      doc.fillColor("#fff").fontSize(10).font("Helvetica-Bold").text(title, LEFT + 8, doc.y - 16, { lineBreak: false });
      doc.moveDown(1.2).fillColor("#1e293b").font("Helvetica");
    };
    const infoRow = (label, value, shade = false) => {
      const y = doc.y;
      if (shade) doc.rect(LEFT, y, W, 17).fill("#f8fafc");
      doc.fillColor("#6b7280").fontSize(8.5).font("Helvetica-Bold").text(label, LEFT + 6, y + 4, { width: 130, lineBreak: false });
      doc.fillColor("#1e293b").font("Helvetica").text(value || "\u2014", LEFT + 140, y + 4, { width: W - 145, lineBreak: false });
      doc.moveDown(0.85);
    };
    section("1. \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", "#1e40af");
    infoRow("\u0631\u0642\u0645 \u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", wo.workOrderNumber, false);
    infoRow("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0647\u0645\u0629", wo.title, true);
    infoRow("\u0627\u0644\u062D\u0627\u0644\u0629", statusLabel, false);
    infoRow("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062C\u062F\u0648\u0644\u0629", wo.scheduledDate ? new Date(wo.scheduledDate).toLocaleDateString("ar-SA") : "\u2014", true);
    infoRow("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u062A\u0645\u0627\u0645", wo.completedDate ? new Date(wo.completedDate).toLocaleDateString("ar-SA") : "\u2014", false);
    infoRow("\u0627\u0644\u0641\u0646\u064A \u0627\u0644\u0645\u0639\u064A\u0651\u0646", assignedUser?.name ?? "\u2014", true);
    infoRow("\u0627\u0644\u0645\u0648\u0642\u0639", site?.name ?? "\u2014", false);
    if (plan) {
      infoRow("\u0631\u0642\u0645 \u0627\u0644\u062E\u0637\u0629", plan.planNumber, true);
      infoRow("\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0635\u064A\u0627\u0646\u0629", plan.frequency === "daily" ? "\u064A\u0648\u0645\u064A" : plan.frequency === "weekly" ? "\u0623\u0633\u0628\u0648\u0639\u064A" : plan.frequency === "monthly" ? "\u0634\u0647\u0631\u064A" : plan.frequency === "quarterly" ? "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A" : plan.frequency === "biannual" ? "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A" : "\u0633\u0646\u0648\u064A", false);
    }
    section("2. \u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0635\u0644", "#065f46");
    if (asset) {
      infoRow("\u0631\u0642\u0645 \u0627\u0644\u0623\u0635\u0644", asset.assetNumber, false);
      infoRow("\u0627\u0633\u0645 \u0627\u0644\u0623\u0635\u0644", asset.name, true);
      infoRow("\u0627\u0644\u0641\u0626\u0629", asset.category ?? "\u2014", false);
      infoRow("\u0627\u0644\u0645\u0627\u0631\u0643\u0629 / \u0627\u0644\u0645\u0648\u062F\u064A\u0644", `${asset.brand ?? "\u2014"} / ${asset.model ?? "\u2014"}`, true);
      infoRow("\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062A\u0633\u0644\u0633\u0644\u064A", asset.serialNumber ?? "\u2014", false);
      infoRow("\u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0635\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", ASSET_STATUS_LABELS[asset.status] ?? asset.status, true);
      infoRow("\u0622\u062E\u0631 \u0635\u064A\u0627\u0646\u0629", asset.lastMaintenanceDate ? new Date(asset.lastMaintenanceDate).toLocaleDateString("ar-SA") : "\u2014", false);
      infoRow("\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629", asset.nextMaintenanceDate ? new Date(asset.nextMaintenanceDate).toLocaleDateString("ar-SA") : "\u2014", true);
    } else {
      doc.fillColor("#9ca3af").fontSize(9).text("\u0644\u0627 \u064A\u0648\u062C\u062F \u0623\u0635\u0644 \u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0630\u0627 \u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", LEFT + 8, doc.y);
      doc.moveDown(1);
    }
    const checklist = wo.checklistResults ?? [];
    section("3. \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0641\u062D\u0635 \u0648\u0627\u0644\u062A\u062D\u0642\u0642", "#7c3aed");
    if (checklist.length === 0) {
      doc.fillColor("#9ca3af").fontSize(9).text("\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u0646\u0648\u062F \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0641\u062D\u0635", LEFT + 8, doc.y);
      doc.moveDown(1);
    } else {
      doc.rect(LEFT, doc.y, W, 18).fill("#334155");
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold").text("#", LEFT + 6, doc.y - 13, { width: 20, lineBreak: false }).text("\u0628\u0646\u062F \u0627\u0644\u0641\u062D\u0635", LEFT + 30, doc.y - 13, { width: 260, lineBreak: false }).text("\u0627\u0644\u062D\u0627\u0644\u0629", LEFT + 295, doc.y - 13, { width: 70, lineBreak: false }).text("\u0645\u0644\u0627\u062D\u0638\u0627\u062A", LEFT + 370, doc.y - 13, { width: W - 375, lineBreak: false });
      doc.moveDown(1);
      checklist.forEach((item, i) => {
        if (doc.y > doc.page.height - 120) {
          doc.addPage();
          doc.y = 45;
        }
        const y = doc.y;
        const shade = i % 2 === 0;
        if (shade) doc.rect(LEFT, y, W, 17).fill("#f5f3ff");
        const done = item.done === true;
        doc.circle(LEFT + 14, y + 8, 5).stroke(done ? "#10b981" : "#d1d5db");
        if (done) doc.circle(LEFT + 14, y + 8, 3).fill("#10b981");
        doc.fillColor("#1e293b").fontSize(8).font("Helvetica").text(`${i + 1}`, LEFT + 6, y + 5, { width: 20, lineBreak: false }).text(item.text ?? "", LEFT + 30, y + 5, { width: 260, lineBreak: false });
        const doneColor = done ? "#10b981" : "#ef4444";
        const doneLabel = done ? "\u2713 \u062A\u0645" : "\u2717 \u0644\u0645 \u064A\u062A\u0645";
        doc.fillColor(doneColor).font("Helvetica-Bold").fontSize(7.5).text(doneLabel, LEFT + 295, y + 5, { width: 70, lineBreak: false });
        doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5).text(item.notes || "\u2014", LEFT + 370, y + 5, { width: W - 375, lineBreak: false });
        doc.moveDown(0.85);
      });
      const doneCount = checklist.filter((i) => i.done).length;
      const pct = checklist.length > 0 ? Math.round(doneCount / checklist.length * 100) : 0;
      doc.moveDown(0.3);
      doc.rect(LEFT, doc.y, W, 20).fill("#f0fdf4");
      doc.fillColor("#065f46").fontSize(9).font("Helvetica-Bold").text(`\u0627\u0644\u0625\u0646\u062C\u0627\u0632: ${doneCount} / ${checklist.length} \u0628\u0646\u062F (${pct}%)`, LEFT + 8, doc.y - 14);
      doc.moveDown(1.2);
    }
    section("4. \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0641\u0646\u064A", "#92400e");
    const notes = wo.technicianNotes_ar || wo.technicianNotes || "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0644\u0627\u062D\u0638\u0627\u062A";
    doc.fillColor("#374151").fontSize(9).font("Helvetica").text(notes, LEFT + 8, doc.y, { width: W - 16 });
    doc.moveDown(1.5);
    if (wo.completionPhotoUrl) {
      section("5. \u0635\u0648\u0631\u0629 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0639\u0645\u0644", "#1e293b");
      doc.fillColor("#6b7280").fontSize(9).text(`\u0631\u0627\u0628\u0637 \u0627\u0644\u0635\u0648\u0631\u0629: ${wo.completionPhotoUrl}`, LEFT + 8, doc.y, { width: W - 16 });
      doc.moveDown(1);
    }
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(1);
    doc.rect(LEFT, doc.y, W, 1).fill("#e2e8f0");
    doc.moveDown(0.5);
    const sigY = doc.y;
    const colW = W / 3;
    ["\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0641\u0646\u064A", "\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u0634\u0631\u0641", "\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u062F\u064A\u0631"].forEach((label, i) => {
      const x = LEFT + i * colW;
      doc.rect(x + 10, sigY + 25, colW - 20, 1).fill("#94a3b8");
      doc.fillColor("#6b7280").fontSize(8).font("Helvetica").text(label, x, sigY + 30, { width: colW, align: "center" });
    });
    doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill("#1e293b");
    doc.fillColor("#94a3b8").fontSize(7.5).text(
      `\u0646\u0638\u0627\u0645 \u062A\u0648\u0644\u0627\u0646 \u0644\u0644\u0635\u064A\u0627\u0646\u0629  |  \u062A\u0645 \u0627\u0644\u0625\u0646\u0634\u0627\u0621: ${(/* @__PURE__ */ new Date()).toLocaleDateString("ar-SA")} ${(/* @__PURE__ */ new Date()).toLocaleTimeString("ar-SA")}  |  ${wo.workOrderNumber}`,
      0,
      doc.page.height - 22,
      { align: "center", width: doc.page.width }
    );
    doc.end();
  });
}

// server/_core/index.ts
init_sdk();
var EXPORT_ALLOWED_ROLES = /* @__PURE__ */ new Set([
  "owner",
  "admin",
  "maintenance_manager",
  "supervisor",
  "senior_management",
  "accounting"
]);
async function requireAuthMiddleware(req, res, next) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u2014 \u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
    }
    req.authenticatedUser = user;
    next();
  } catch {
    return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u2014 \u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  }
}
async function requireExportRole(req, res, next) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u2014 \u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
    }
    if (!EXPORT_ALLOWED_ROLES.has(user.role)) {
      return res.status(403).json({ error: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
    }
    req.authenticatedUser = user;
    next();
  } catch {
    return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u2014 \u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  }
}
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  app.set("trust proxy", 1);
  const server = createServer(app);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // unsafe-eval removed (high risk, not needed for production build)
        // unsafe-inline kept: required for Vite HMR in dev and inline event handlers in built bundle
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        mediaSrc: ["'self'", "blob:", "https:"],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? ""),
    message: { error: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0637\u0644\u0628\u0627\u062A. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B" }
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? ""),
    message: { error: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0628\u0639\u062F 15 \u062F\u0642\u064A\u0642\u0629" }
  });
  app.use("/api/", apiLimiter);
  app.use("/api/oauth/", authLimiter);
  app.use(express2.json({ limit: "1mb" }));
  app.use(express2.urlencoded({ limit: "1mb", extended: true }));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
        "image/heif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ]);
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D: ${file.mimetype}`));
      }
    }
  });
  app.get("/api/media", async (req, res) => {
    try {
      const key = req.query.key;
      if (!key || typeof key !== "string" || key.trim() === "") {
        return res.status(400).json({ error: "Missing or invalid key" });
      }
      if (key.includes("..") || key.toLowerCase().includes("%2e%2e")) {
        return res.status(400).json({ error: "Invalid key" });
      }
      const normalizedKey = key.replace(/^\/+/, "");
      if (!normalizedKey.startsWith("cmms/")) {
        return res.status(400).json({ error: "Invalid key" });
      }
      const { stream, contentType } = await storageGetStream(normalizedKey);
      res.setHeader("Content-Type", contentType || "image/webp");
      res.setHeader("Cache-Control", "public, max-age=86400");
      stream.pipe(res);
    } catch (error) {
      console.error("Media proxy error:", error);
      res.status(404).json({ error: "Media not found" });
    }
  });
  app.post("/api/upload", requireAuthMiddleware, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const isImage = req.file.mimetype.startsWith("image/");
      let fileBuffer = req.file.buffer;
      let mimeType = req.file.mimetype;
      let ext = req.file.originalname.split(".").pop() || "bin";
      if (isImage) {
        fileBuffer = await sharp(req.file.buffer).resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).webp({ quality: 75, effort: 2 }).toBuffer();
        mimeType = "image/webp";
        ext = "webp";
      }
      const fileKey = `cmms/uploads/${Date.now()}-${nanoid3(8)}.${ext}`;
      await storagePut(fileKey, fileBuffer, mimeType);
      const proxyUrl = `/api/media?key=${encodeURIComponent(fileKey)}`;
      res.json({ url: proxyUrl, fileKey });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });
  app.get("/api/export/tickets", requireExportRole, async (_req, res) => {
    try {
      const buffer = await exportTicketsToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=tickets-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/purchase-orders", requireExportRole, async (_req, res) => {
    try {
      const buffer = await exportPurchaseOrdersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=purchase-orders-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/technician-performance", requireExportRole, async (req, res) => {
    try {
      const filters = {};
      if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const d = new Date(req.query.dateTo);
        d.setHours(23, 59, 59, 999);
        filters.dateTo = d;
      }
      const buffer = await exportTechnicianPerformanceToExcel(Object.keys(filters).length ? filters : void 0);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=technician-performance-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/audit-log", requireExportRole, async (req, res) => {
    try {
      const filters = {};
      if (req.query.entityType) filters.entityType = req.query.entityType;
      if (req.query.action) filters.action = req.query.action;
      if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const d = new Date(req.query.dateTo);
        d.setHours(23, 59, 59, 999);
        filters.dateTo = d;
      }
      const buffer = await exportAuditLogToExcel(Object.keys(filters).length ? filters : void 0);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=audit-log-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/inventory", requireExportRole, async (_req, res) => {
    try {
      const buffer = await exportInventoryToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=inventory-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/preventive-plans", requireExportRole, async (_req, res) => {
    try {
      const buffer = await exportPreventivePlansToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=preventive-plans-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/pm-work-orders", requireExportRole, async (_req, res) => {
    try {
      const buffer = await exportPMWorkOrdersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=pm-work-orders-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/workflow-guide", requireExportRole, async (_req, res) => {
    try {
      const buffer = await generateWorkflowGuidePDF();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=CMMS-Workflow-Guide-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.pdf`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/export/pm-work-order/:id", requireAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "\u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      const buffer = await generatePMWorkOrderPDF(id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=work-order-${id}-${Date.now()}.pdf`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
  const ONE_HOUR = 60 * 60 * 1e3;
  setTimeout(() => {
    runTechnicianOverdueJob();
    setInterval(runTechnicianOverdueJob, ONE_HOUR);
  }, 5e3);
  const SIX_HOURS = 6 * 60 * 60 * 1e3;
  setTimeout(() => {
    runPMAutomationJob();
    setInterval(runPMAutomationJob, SIX_HOURS);
  }, 1e4);
  const TWO_HOURS = 2 * 60 * 60 * 1e3;
  setTimeout(() => {
    runPMWorkOrderReminderJob();
    setInterval(runPMWorkOrderReminderJob, TWO_HOURS);
  }, 15e3);
  const SIX_HOURS_MS = 6 * 60 * 60 * 1e3;
  setTimeout(() => {
    runSlaOverduePushJob();
    setInterval(runSlaOverduePushJob, SIX_HOURS_MS);
  }, 2e4);
}
startServer().catch(console.error);
