import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// ============================================================
// معالجة أمنية عاجلة — اختبارات صلاحيات:
//   1) reject (approvals.router.ts)   — حماية بحسب الدور + مرحلة الطلب
//   2) getById (purchase-orders.router.ts) — منع الوصول المباشر بدون صلاحية
//   3) list (purchase-orders.router.ts)    — تطابق نطاقه مع getById تمامًا
// مبني على جدول الصلاحيات المعتمد (نسخة v2) الذي اعتمده صاحب المشروع.
// ============================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@test.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

vi.mock("../_core/db", () => {
  const pos: any[] = [];
  const items: any[] = [];
  const notifications: any[] = [];
  const auditLogs: any[] = [];
  const procurementComments: any[] = [];
  const users: any[] = [
    { id: 1, name: "Requester", role: "purchase_requester" },
    { id: 2, name: "Delegate A", role: "delegate" },
    { id: 3, name: "Accountant", role: "accountant" },
    { id: 4, name: "SeniorMgmt", role: "senior_management" },
    { id: 5, name: "ExecDirector", role: "executive_director" },
    { id: 6, name: "Warehouse", role: "warehouse" },
    { id: 7, name: "Technician", role: "technician" },
    { id: 8, name: "MaintManager", role: "maintenance_manager" },
    { id: 9, name: "Owner", role: "owner" },
    { id: 10, name: "FoodAssistant", role: "food_warehouse_assistant" },
    { id: 11, name: "FoodManager", role: "food_warehouse_manager" },
  ];

  return {
    getPurchaseOrderById: vi.fn(async (id: number) => pos.find(p => p.id === id) || null),
    getPurchaseOrders: vi.fn(async (filters: any = {}) => {
      let result = [...pos];
      if (filters.status) result = result.filter(p => p.status === filters.status);
      if (filters.requestedById) result = result.filter(p => p.requestedById === filters.requestedById);
      return result;
    }),
    updatePurchaseOrder: vi.fn(async (id: number, data: any) => {
      const po = pos.find(p => p.id === id);
      if (po) Object.assign(po, data);
    }),
    getPOItems: vi.fn(async (poId: number) => items.filter(i => i.purchaseOrderId === poId)),
    getPOItemsByDelegate: vi.fn(async (delegateId: number) => items.filter(i => i.delegateId === delegateId)),
    getProcurementComments: vi.fn(async () => procurementComments),
    createProcurementComment: vi.fn(async (data: any) => { procurementComments.push(data); return procurementComments.length; }),
    createNotification: vi.fn(async (data: any) => { notifications.push(data); return 1; }),
    createAuditLog: vi.fn(async (data: any) => { auditLogs.push(data); return 1; }),
    getManagerUsers: vi.fn(async () => users.filter(u => u.role === "maintenance_manager" || u.role === "owner" || u.role === "admin")),
    getUsersByRole: vi.fn(async (role: string) => users.filter(u => u.role === role)),
    getUserById: vi.fn(async (id: number) => users.find(u => u.id === id) || null),
    getUserIdsByRole: vi.fn(async (role: string) => users.filter(u => u.role === role).map(u => u.id)),

    _pos: pos,
    _items: items,
    _reset: () => {
      pos.length = 0;
      items.length = 0;
      notifications.length = 0;
      auditLogs.length = 0;
      procurementComments.length = 0;
    },
    _setupScenario: () => {
      pos.length = 0;
      items.length = 0;
      notifications.length = 0;
      auditLogs.length = 0;
      procurementComments.length = 0;

      // طلب لكل مرحلة رئيسية بدورة الحياة
      pos.push({ id: 1, poNumber: "PR-0001", status: "draft", requestedById: 1 });
      pos.push({ id: 2, poNumber: "PR-0002", status: "pending_review", requestedById: 1 });
      pos.push({ id: 3, poNumber: "PR-0003", status: "pending_estimate", requestedById: 1 });
      pos.push({ id: 4, poNumber: "PR-0004", status: "pending_accounting", requestedById: 1 });
      pos.push({ id: 5, poNumber: "PR-0005", status: "pending_management", requestedById: 1 });
      pos.push({ id: 6, poNumber: "PR-0006", status: "approved", requestedById: 1 });
      pos.push({ id: 7, poNumber: "PR-0007", status: "partial_purchase", requestedById: 1 });
      pos.push({ id: 8, poNumber: "PR-0008", status: "purchased", requestedById: 1 });
      pos.push({ id: 9, poNumber: "PR-0009", status: "received", requestedById: 1 });

      // طلب تابع لمستخدم آخر تمامًا (لاختبار عدم رؤيته من أدوار "طلباته فقط")
      pos.push({ id: 100, poNumber: "PR-0100", status: "pending_accounting", requestedById: 999 });

      // طلب أنشأه الفني نفسه (userId=7) — لاختبار أنه يرى طلبه هو فقط
      pos.push({ id: 200, poNumber: "PR-0200", status: "pending_review", requestedById: 7 });

      // صنف مخصص للمندوب صاحب id=2 ضمن الطلب رقم 6
      items.push({ id: 1, purchaseOrderId: 6, delegateId: 2, itemName: "صنف تجريبي" });
    },
  };
});

const db = await import("../_core/db") as any;

describe("معالجة أمنية عاجلة — reject", () => {
  beforeEach(() => { db._reset(); vi.clearAllMocks(); db._setupScenario(); });

  it("[سيناريو 1] technician لا يستطيع رفض طلب بمرحلة pending_management", async () => {
    const caller = appRouter.createCaller(createContext("technician", 7));
    await expect(caller.purchaseOrders.reject({ id: 5, reason: "سبب" })).rejects.toThrow();
  });

  it("[سيناريو 2] accountant يستطيع الرفض بمرحلة pending_accounting", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    const result = await caller.purchaseOrders.reject({ id: 4, reason: "سبب" });
    expect(result).toEqual({ success: true });
    expect(db._pos.find((p: any) => p.id === 4).status).toBe("rejected");
  });

  it("[سيناريو 3] accountant لا يستطيع الرفض بمرحلة pending_management", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    await expect(caller.purchaseOrders.reject({ id: 5, reason: "سبب" })).rejects.toThrow();
  });

  it("[سيناريو 4] senior_management يستطيع الرفض بمرحلة pending_management", async () => {
    const caller = appRouter.createCaller(createContext("senior_management", 4));
    const result = await caller.purchaseOrders.reject({ id: 5, reason: "سبب" });
    expect(result).toEqual({ success: true });
  });

  it("[سيناريو 5] executive_director ممنوع من الرفض حتى بمرحلة pending_management", async () => {
    const caller = appRouter.createCaller(createContext("executive_director", 5));
    await expect(caller.purchaseOrders.reject({ id: 5, reason: "سبب" })).rejects.toThrow();
  });

  it("[سيناريو 6] admin/owner يرفضان بأي مرحلة", async () => {
    const callerOwner = appRouter.createCaller(createContext("owner", 9));
    const result = await callerOwner.purchaseOrders.reject({ id: 1, reason: "سبب" }); // draft
    expect(result).toEqual({ success: true });
  });
});

describe("معالجة أمنية عاجلة — getById", () => {
  beforeEach(() => { db._reset(); vi.clearAllMocks(); db._setupScenario(); });

  it("[سيناريو 7] purchase_requester لا يرى طلب مستخدم آخر", async () => {
    const caller = appRouter.createCaller(createContext("purchase_requester", 1));
    await expect(caller.purchaseOrders.getById({ id: 100 })).rejects.toThrow();
  });

  it("[سيناريو 8] purchase_requester يرى طلبه هو", async () => {
    const caller = appRouter.createCaller(createContext("purchase_requester", 1));
    const result = await caller.purchaseOrders.getById({ id: 1 });
    expect(result.id).toBe(1);
  });

  it("[سيناريو 9] accountant لا يرى طلبًا بحالة draft", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    await expect(caller.purchaseOrders.getById({ id: 1 })).rejects.toThrow();
  });

  it("[سيناريو 10] accountant يرى طلبًا بحالة pending_accounting", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    const result = await caller.purchaseOrders.getById({ id: 4 });
    expect(result.id).toBe(4);
  });

  it("[سيناريو 11] warehouse لا يرى طلبًا بحالة approved", async () => {
    const caller = appRouter.createCaller(createContext("warehouse", 6));
    await expect(caller.purchaseOrders.getById({ id: 6 })).rejects.toThrow();
  });

  it("[سيناريو 12] warehouse يرى طلبًا بحالة purchased", async () => {
    const caller = appRouter.createCaller(createContext("warehouse", 6));
    const result = await caller.purchaseOrders.getById({ id: 8 });
    expect(result.id).toBe(8);
  });

  it("[سيناريو 13] delegate يرى طلبًا له فيه صنف مخصص", async () => {
    const caller = appRouter.createCaller(createContext("delegate", 2));
    const result = await caller.purchaseOrders.getById({ id: 6 });
    expect(result.id).toBe(6);
  });

  it("[سيناريو 14] delegate لا يرى طلبًا ليس له فيه أي صنف", async () => {
    const caller = appRouter.createCaller(createContext("delegate", 2));
    await expect(caller.purchaseOrders.getById({ id: 7 })).rejects.toThrow();
  });

  it("senior_management لا يرى طلبًا بحالة pending_accounting", async () => {
    const caller = appRouter.createCaller(createContext("senior_management", 4));
    await expect(caller.purchaseOrders.getById({ id: 4 })).rejects.toThrow();
  });

  it("maintenance_manager يرى أي طلب بأي حالة", async () => {
    const caller = appRouter.createCaller(createContext("maintenance_manager", 8));
    const result = await caller.purchaseOrders.getById({ id: 1 }); // draft
    expect(result.id).toBe(1);
  });
});

describe("معالجة أمنية عاجلة — تطابق نطاق list() مع getById()", () => {
  beforeEach(() => { db._reset(); vi.clearAllMocks(); db._setupScenario(); });

  it("قائمة accountant تحتوي فقط الطلبات بحالة pending_accounting بالضبط (تطابق تام لا نطاق)", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    const list = await caller.purchaseOrders.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((po: any) => po.status === "pending_accounting")).toBe(true);
    // كل طلب ظاهر بالقائمة يجب أن يكون قابلًا للفتح عبر getById لنفس الدور (تطابق النطاقين)
    for (const po of list) {
      await expect(caller.purchaseOrders.getById({ id: po.id })).resolves.toBeDefined();
    }
  });

  it("accountant لا يرى الطلب فور اعتماده (pending_management) حتى لو هو من اعتمده", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    await caller.purchaseOrders.getById({ id: 4 }); // متاح أثناء pending_accounting
    db._pos.find((p: any) => p.id === 4).status = "pending_management"; // محاكاة اعتماده
    await expect(caller.purchaseOrders.getById({ id: 4 })).rejects.toThrow();
    const list = await caller.purchaseOrders.list();
    expect(list.some((po: any) => po.id === 4)).toBe(false);
  });

  it("accountant لا يرى الطلب فور رفضه (rejected) حتى لو هو من رفضه", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    await caller.purchaseOrders.reject({ id: 4, reason: "سبب" }); // accountant يرفض بمرحلته
    await expect(caller.purchaseOrders.getById({ id: 4 })).rejects.toThrow();
    const list = await caller.purchaseOrders.list();
    expect(list.some((po: any) => po.id === 4)).toBe(false);
  });

  it("قائمة warehouse تحتوي فقط partial_purchase/purchased/received/closed", async () => {
    const caller = appRouter.createCaller(createContext("warehouse", 6));
    const list = await caller.purchaseOrders.list();
    const visibleStatuses = ["partial_purchase", "purchased", "received", "closed"];
    expect(list.every((po: any) => visibleStatuses.includes(po.status))).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("قائمة technician تعرض طلبه هو فقط (PR-0200)، ولا تعرض أي طلب آخر", async () => {
    const caller = appRouter.createCaller(createContext("technician", 7));
    const list = await caller.purchaseOrders.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(200);
    expect(list.every((po: any) => po.requestedById === 7)).toBe(true);
  });

  it("قائمة senior_management لا تحتوي pending_accounting أو ما قبلها", async () => {
    const caller = appRouter.createCaller(createContext("senior_management", 4));
    const list = await caller.purchaseOrders.list();
    const hiddenStatuses = ["draft", "pending_review", "pending_estimate", "pending_accounting"];
    expect(list.every((po: any) => !hiddenStatuses.includes(po.status))).toBe(true);
  });
});
