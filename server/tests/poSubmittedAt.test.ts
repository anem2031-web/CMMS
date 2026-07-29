import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// ══════════════════════════════════════════════════════════════════════════
// اختبار: تسجيل تاريخ الإرسال (submittedAt) عند تحويل المسودة لطلب رسمي
//
// المشكلة المعالَجة: مسودة تُنشأ ثم تبقى أسبوعين قبل إرسالها. كانت القائمة
// تُرتَّب بـcreatedAt فيظهر الطلب مدفونًا بين الطلبات القديمة لحظة وصوله.
// ══════════════════════════════════════════════════════════════════════════

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId, openId: `u-${userId}`, email: `u${userId}@t.com`, name: `User ${userId}`,
    loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const pos: any[] = [];
const items: any[] = [];
const updateSpy = vi.fn();

vi.mock("../_core/db", () => ({
  getPurchaseOrderById: vi.fn(async (id: number) => pos.find((p) => p.id === id) || null),
  getPOItems: vi.fn(async (poId: number) => items.filter((i) => i.purchaseOrderId === poId)),
  updatePurchaseOrder: vi.fn(async (id: number, data: any) => {
    updateSpy(id, data);
    const po = pos.find((p) => p.id === id);
    if (po) Object.assign(po, data);
  }),
  getManagerUsers: vi.fn(async () => []),
  createNotification: vi.fn(async () => 1),
  createAuditLog: vi.fn(async () => 1),
  getUsersByRole: vi.fn(async () => []),
  getUserIdsByRole: vi.fn(async () => []),
  getPOItemsByDelegate: vi.fn(async () => []),
  getProcurementComments: vi.fn(async () => []),
  createProcurementComment: vi.fn(async () => 1),
  getUserById: vi.fn(async () => null),
  getPurchaseOrders: vi.fn(async () => []),
}));

beforeEach(() => {
  pos.length = 0;
  items.length = 0;
  updateSpy.mockReset();
  vi.clearAllMocks();

  // مسودة أُنشئت قبل أسبوعين
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  pos.push({
    id: 1, poNumber: "PR-0001", status: "draft", requestedById: 1,
    createdAt: twoWeeksAgo, submittedAt: null,
  });
  items.push({ id: 1, purchaseOrderId: 1, itemName: "صنف" });
});

describe("submitDraft — تسجيل تاريخ الإرسال", () => {
  it("يسجّل submittedAt بتاريخ اليوم عند تحويل المسودة لطلب رسمي", async () => {
    const caller = appRouter.createCaller(createContext("purchase_requester", 1));
    const before = Date.now();
    await caller.purchaseOrders.submitDraft({ id: 1 });

    const [, data] = updateSpy.mock.calls[0];
    expect(data.status).toBe("pending_review");
    expect(data.submittedAt).toBeInstanceOf(Date);
    expect(data.submittedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("لا يمسّ createdAt الأصلي (يبقى تاريخ إنشاء المسودة محفوظًا)", async () => {
    const originalCreatedAt = pos[0].createdAt;
    const caller = appRouter.createCaller(createContext("purchase_requester", 1));
    await caller.purchaseOrders.submitDraft({ id: 1 });

    const [, data] = updateSpy.mock.calls[0];
    expect(data.createdAt).toBeUndefined(); // لم يُرسل ضمن التحديث إطلاقًا
    expect(pos[0].createdAt).toBe(originalCreatedAt);
  });

  it("تاريخ الإرسال يختلف فعليًا عن تاريخ الإنشاء (جوهر الإصلاح)", async () => {
    const caller = appRouter.createCaller(createContext("purchase_requester", 1));
    await caller.purchaseOrders.submitDraft({ id: 1 });

    const submitted = pos[0].submittedAt.getTime();
    const created = new Date(pos[0].createdAt).getTime();
    // الفارق يقارب أسبوعين — وهو بالضبط ما كان يدفن الطلب بالقائمة سابقًا
    expect(submitted - created).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
  });
});
