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
    getPOItemById: vi.fn(async (id: number) => items.find(i => i.id === id) || null),
    updatePOItem: vi.fn(async (id: number, data: any) => {
      const item = items.find(i => i.id === id);
      if (item) Object.assign(item, data, { updatedAt: new Date() });
    }),
    getPOItemsForPOs: vi.fn(async (poIds: number[]) => items.filter(i => poIds.includes(i.purchaseOrderId))),
    getPOItemsByDelegate: vi.fn(async (delegateId: number) => items.filter(i => i.delegateId === delegateId)),
    getProcurementComments: vi.fn(async () => procurementComments),
    createProcurementComment: vi.fn(async (data: any) => { procurementComments.push(data); return procurementComments.length; }),
    createNotification: vi.fn(async (data: any) => { notifications.push(data); return 1; }),
    createAuditLog: vi.fn(async (data: any) => { auditLogs.push(data); return 1; }),
    getPurchaseManagerUsers: vi.fn(async () => users.filter(u => u.role === "maintenance_manager" || u.role === "owner" || u.role === "admin")),
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

      // طلبات شخصية لأدوار وظيفية كانت تفقد رؤية طلباتها خارج نطاق عمل الدور
      pos.push({ id: 200, poNumber: "PR-0200", status: "pending_review", requestedById: 7 }); // technician
      pos.push({ id: 201, poNumber: "PR-0201", status: "draft", requestedById: 3 }); // accountant
      pos.push({ id: 202, poNumber: "PR-0202", status: "closed", requestedById: 3 }); // accountant
      pos.push({ id: 203, poNumber: "PR-0203", status: "draft", requestedById: 6 }); // warehouse
      pos.push({ id: 204, poNumber: "PR-0204", status: "draft", requestedById: 2 }); // delegate
      pos.push({ id: 205, poNumber: "PR-0205", status: "draft", requestedById: 4 }); // senior_management
      pos.push({ id: 206, poNumber: "PR-0206", status: "pending_accounting", requestedById: 5 }); // executive_director

      // حالات تحقق الصلاحيات المطلقة للمالك والمدير على طلبات أنشأها آخرون
      pos.push({ id: 207, poNumber: "PR-0207", status: "revision_needed", requestedById: 1, notes: "قبل" });
      pos.push({ id: 208, poNumber: "PR-0208", status: "closed", requestedById: 1, notes: "قبل" });

      // صنف مخصص للمندوب صاحب id=2 ضمن الطلب رقم 6
      items.push({ id: 1, purchaseOrderId: 6, delegateId: 2, itemName: "صنف تجريبي" });

      // أصناف أعادها المندوب لمنشئ الطلب للتعديل ثم إعادة الإرسال
      pos.push({ id: 209, poNumber: "PR-0209", status: "pending_accounting", requestedById: 1 });
      items.push({
        id: 20, purchaseOrderId: 209, delegateId: 2, itemName: "صنف يحتاج مراجعة",
        description: "قبل", quantity: 1, unit: "قطعة", status: "needs_item_revision",
        itemRevisionNote: "عدّل المواصفات", itemRevisionRequestedById: 2,
        itemRevisionRequestedAt: new Date(), updatedAt: new Date("2026-08-01T10:00:00Z"),
      });
      pos.push({ id: 210, poNumber: "PR-0210", status: "approved", requestedById: 1 });
      items.push({
        id: 21, purchaseOrderId: 210, delegateId: 2, itemName: "صنف ملغى الشراء",
        quantity: 2, unit: "قطعة", status: "purchase_cancelled", estimatedUnitCost: "50",
        estimatedTotalCost: "100", purchaseCancelReason: "غير متوفر",
        purchaseCancelledById: 2, purchaseCancelledByName: "Delegate A",
        purchaseCancelledAt: new Date(), updatedAt: new Date("2026-08-01T11:00:00Z"),
      });
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

  it("accountant يرى مسودته وطلبه المغلق لأنهما من إنشائه", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    await expect(caller.purchaseOrders.getById({ id: 201 })).resolves.toMatchObject({ id: 201 });
    await expect(caller.purchaseOrders.getById({ id: 202 })).resolves.toMatchObject({ id: 202 });
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

  it("warehouse/delegate/senior_management/executive_director يرون طلباتهم الشخصية خارج نطاقهم الوظيفي", async () => {
    await expect(appRouter.createCaller(createContext("warehouse", 6)).purchaseOrders.getById({ id: 203 }))
      .resolves.toMatchObject({ id: 203 });
    await expect(appRouter.createCaller(createContext("delegate", 2)).purchaseOrders.getById({ id: 204 }))
      .resolves.toMatchObject({ id: 204 });
    await expect(appRouter.createCaller(createContext("senior_management", 4)).purchaseOrders.getById({ id: 205 }))
      .resolves.toMatchObject({ id: 205 });
    await expect(appRouter.createCaller(createContext("executive_director", 5)).purchaseOrders.getById({ id: 206 }))
      .resolves.toMatchObject({ id: 206 });
  });

  it("maintenance_manager يرى أي طلب بأي حالة", async () => {
    const caller = appRouter.createCaller(createContext("maintenance_manager", 8));
    const result = await caller.purchaseOrders.getById({ id: 1 }); // draft
    expect(result.id).toBe(1);
  });
});

describe("معالجة أمنية عاجلة — تطابق نطاق list() مع getById()", () => {
  beforeEach(() => { db._reset(); vi.clearAllMocks(); db._setupScenario(); });

  it("قائمة accountant تجمع بين pending_accounting وطلباته الشخصية", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    const list = await caller.purchaseOrders.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((po: any) => po.status === "pending_accounting" || po.requestedById === 3)).toBe(true);
    expect(list.map((po: any) => po.id)).toEqual(expect.arrayContaining([4, 100, 201, 202]));
    // كل طلب ظاهر بالقائمة يجب أن يكون قابلًا للفتح عبر getById لنفس الدور (تطابق النطاقين)
    for (const po of list) {
      await expect(caller.purchaseOrders.getById({ id: po.id })).resolves.toBeDefined();
    }
  });

  it("accountant لا يرى طلب شخص آخر بعد انتقاله إلى pending_management", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    await caller.purchaseOrders.getById({ id: 4 }); // متاح أثناء pending_accounting
    db._pos.find((p: any) => p.id === 4).status = "pending_management"; // محاكاة اعتماده
    await expect(caller.purchaseOrders.getById({ id: 4 })).rejects.toThrow();
    const list = await caller.purchaseOrders.list();
    expect(list.some((po: any) => po.id === 4)).toBe(false);
  });

  it("accountant لا يرى طلب شخص آخر بعد رفضه", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    await caller.purchaseOrders.reject({ id: 4, reason: "سبب" }); // accountant يرفض بمرحلته
    await expect(caller.purchaseOrders.getById({ id: 4 })).rejects.toThrow();
    const list = await caller.purchaseOrders.list();
    expect(list.some((po: any) => po.id === 4)).toBe(false);
  });

  it("قائمة warehouse تجمع مراحل عمل المستودع الأربع مع طلباته الشخصية فقط", async () => {
    db._pos.push({ id: 211, poNumber: "PR-0211", status: "rejected", requestedById: 999 });
    db._pos.push({ id: 212, poNumber: "PR-0212", status: "revision_needed", requestedById: 999 });
    db._pos.push({ id: 213, poNumber: "PR-0213", status: "rejected", requestedById: 6 });

    const caller = appRouter.createCaller(createContext("warehouse", 6));
    const list = await caller.purchaseOrders.list();
    const visibleStatuses = ["partial_purchase", "purchased", "received", "closed"];
    expect(list.every((po: any) => visibleStatuses.includes(po.status) || po.requestedById === 6)).toBe(true);
    expect(list.some((po: any) => po.id === 203 && po.status === "draft")).toBe(true);
    expect(list.some((po: any) => po.id === 211)).toBe(false);
    expect(list.some((po: any) => po.id === 212)).toBe(false);
    expect(list.some((po: any) => po.id === 213 && po.status === "rejected")).toBe(true);
  });

  it("قائمة delegate تجمع الطلبات المسندة إليه مع مسودته الشخصية", async () => {
    const caller = appRouter.createCaller(createContext("delegate", 2));
    const list = await caller.purchaseOrders.list();
    expect(list.map((po: any) => po.id)).toEqual(expect.arrayContaining([6, 204]));
    expect(list.some((po: any) => po.id === 7)).toBe(false);
  });

  it("قائمة technician تعرض طلبه هو فقط (PR-0200)، ولا تعرض أي طلب آخر", async () => {
    const caller = appRouter.createCaller(createContext("technician", 7));
    const list = await caller.purchaseOrders.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(200);
    expect(list.every((po: any) => po.requestedById === 7)).toBe(true);
  });

  it("قائمة senior_management تحجب المراحل المبكرة للآخرين وتعرض طلباته الشخصية", async () => {
    const caller = appRouter.createCaller(createContext("senior_management", 4));
    const list = await caller.purchaseOrders.list();
    const hiddenStatuses = ["draft", "pending_review", "pending_estimate", "pending_accounting"];
    expect(list.every((po: any) => !hiddenStatuses.includes(po.status) || po.requestedById === 4)).toBe(true);
    expect(list.some((po: any) => po.id === 205 && po.status === "draft")).toBe(true);
  });
});

describe("معالجة الرؤية — actionableForMe", () => {
  beforeEach(() => { db._reset(); vi.clearAllMocks(); db._setupScenario(); });

  it("يعرض للمحاسب مسودته الشخصية كإجراء مطلوب منه", async () => {
    const caller = appRouter.createCaller(createContext("accountant", 3));
    const result = await caller.purchaseOrders.actionableForMe();
    expect(result.items.some((po: any) => po.id === 201 && po.reason === "مسودة لم تُرسل بعد")).toBe(true);
  });

  it("لا يحول طلب المستخدم المرسل إلى إجراء له عندما ينتظر دورًا آخر", async () => {
    const caller = appRouter.createCaller(createContext("executive_director", 5));
    const result = await caller.purchaseOrders.actionableForMe();
    expect(result.items.some((po: any) => po.id === 206)).toBe(false);
  });
});

describe("صلاحيات owner/admin المطلقة على طلبات الآخرين", () => {
  beforeEach(() => { db._reset(); vi.clearAllMocks(); db._setupScenario(); });


  it("مدير الصيانة لا يعدل الطلب في pending_estimate أو pending_accounting", async () => {
    const caller = appRouter.createCaller(createContext("maintenance_manager", 8));
    await expect(caller.purchaseOrders.update({ id: 3, notes: "غير مسموح" })).rejects.toThrow();
    await expect(caller.purchaseOrders.update({ id: 4, notes: "غير مسموح" })).rejects.toThrow();
    await expect(caller.purchaseOrders.update({ id: 2, notes: "مسموح أثناء المراجعة" })).resolves.toEqual({ success: true });
  });

  it("owner يعيد تقديم طلب revision_needed أنشأه مستخدم آخر", async () => {
    const caller = appRouter.createCaller(createContext("owner", 9));
    await expect(caller.purchaseOrders.resubmit({ id: 207, note: "تمت المراجعة إداريًا" })).resolves.toEqual({ success: true });
    expect(db._pos.find((p: any) => p.id === 207).status).toBe("pending_review");
  });

  it("admin يعدل بيانات طلب مغلق أنشأه مستخدم آخر", async () => {
    const caller = appRouter.createCaller(createContext("admin", 99));
    await expect(caller.purchaseOrders.update({ id: 208, notes: "تعديل إداري" })).resolves.toEqual({ success: true });
    expect(db._pos.find((p: any) => p.id === 208).notes).toBe("تعديل إداري");
  });

  it("الدور العادي لا يعيد تقديم طلب مستخدم آخر", async () => {
    const caller = appRouter.createCaller(createContext("purchase_requester", 55));
    await expect(caller.purchaseOrders.resubmit({ id: 207 })).rejects.toThrow();
  });
});

describe("تعديل الصنف المرتجع وحفظه وإعادة إرساله", () => {
  beforeEach(() => { db._reset(); vi.clearAllMocks(); db._setupScenario(); });

  it("منشئ الطلب يعدل صنف طلب المراجعة ويعيده للمندوب في عملية واحدة", async () => {
    const caller = appRouter.createCaller(createContext("purchase_requester", 1));
    await expect(caller.purchaseOrders.editAndResubmitReturnedItem({
      id: 20,
      purchaseOrderId: 209,
      itemName: "صنف معدل",
      description: "تم تعديل المواصفات",
      quantity: 3,
      unit: "علبة",
      lastKnownUpdatedAt: "2026-08-01T10:00:00.000Z",
    })).resolves.toEqual({ success: true, status: "pending" });

    expect(db._items.find((i: any) => i.id === 20)).toMatchObject({
      itemName: "صنف معدل",
      description: "تم تعديل المواصفات",
      quantity: 3,
      unit: "علبة",
      status: "pending",
      itemRevisionNote: null,
      itemRevisionRequestedById: null,
      itemRevisionRequestedAt: null,
    });
  });

  for (const role of ["owner", "admin"]) {
    it(`${role} يعدل صنفًا ملغى الشراء من طلب شخص آخر ويعيده للشراء`, async () => {
      const caller = appRouter.createCaller(createContext(role, role === "owner" ? 9 : 99));
      await expect(caller.purchaseOrders.editAndResubmitReturnedItem({
        id: 21,
        purchaseOrderId: 210,
        itemName: `صنف معدل بواسطة ${role}`,
        quantity: 4,
        lastKnownUpdatedAt: "2026-08-01T11:00:00.000Z",
      })).resolves.toEqual({ success: true, status: "approved" });

      expect(db._items.find((i: any) => i.id === 21)).toMatchObject({
        itemName: `صنف معدل بواسطة ${role}`,
        quantity: 4,
        status: "approved",
        estimatedTotalCost: "200",
        purchaseCancelReason: null,
        purchaseCancelledById: null,
        purchaseCancelledByName: null,
        purchaseCancelledAt: null,
      });
    });
  }

  it("مستخدم غير المنشئ وغير الإدارة لا يستطيع التعديل وإعادة الإرسال", async () => {
    const caller = appRouter.createCaller(createContext("maintenance_manager", 8));
    await expect(caller.purchaseOrders.editAndResubmitReturnedItem({
      id: 20,
      purchaseOrderId: 209,
      itemName: "تعديل غير مسموح",
    })).rejects.toThrow();
  });
});

