import { describe, expect, it } from "vitest";
import { computeActionablePOs } from "../routers/purchase/actionable";

// ══════════════════════════════════════════════════════════════════════════
// اختبارات "بانتظار إجرائي" — الفئات الثلاث لكل دور
// ══════════════════════════════════════════════════════════════════════════

const po = (over: Partial<any> = {}) => ({
  id: 1, poNumber: "PO-0001", status: "pending_review", requestedById: 99, ...over,
});

describe("الفئة 1 — طلب بمرحلة يستطيع دور المستخدم التصرف فيها", () => {
  it("مدير الصيانة يرى طلبًا بمرحلة المراجعة", () => {
    const r = computeActionablePOs(
      { id: 8, role: "maintenance_manager" },
      [po({ status: "pending_review" })],
      []
    );
    expect(r).toHaveLength(1);
    expect(r[0].reason).toBe("يحتاج مراجعتك وتوزيع الأصناف");
    expect(r[0].actionLabel).toBe("راجع");
  });

  it("المحاسب يرى طلبًا بمرحلة الاعتماد المحاسبي فقط", () => {
    const acc = { id: 3, role: "accountant" };
    const inStage = computeActionablePOs(acc, [po({ status: "pending_accounting" })], []);
    expect(inStage).toHaveLength(1);
    expect(inStage[0].reason).toBe("يحتاج اعتمادك المحاسبي");

    // بعد اعتماده، لا يعود يظهر له
    const passed = computeActionablePOs(acc, [po({ status: "pending_management" })], []);
    expect(passed).toHaveLength(0);
  });

  it("الإدارة العليا ترى مرحلة الاعتماد الإداري، والمدير التنفيذي لا (ممنوع من الاعتماد)", () => {
    const mgmt = computeActionablePOs({ id: 4, role: "senior_management" }, [po({ status: "pending_management" })], []);
    expect(mgmt).toHaveLength(1);

    const exec = computeActionablePOs({ id: 5, role: "executive_director" }, [po({ status: "pending_management" })], []);
    expect(exec).toHaveLength(0);
  });

  it("دور لا علاقة له بالطلب لا يرى شيئًا", () => {
    const r = computeActionablePOs({ id: 7, role: "technician" }, [po({ status: "pending_accounting" })], []);
    expect(r).toHaveLength(0);
  });
});

describe("الفئة 2 — طلب رُدّ لمنشئه للمراجعة", () => {
  it("منشئ الطلب يراه مع الإجراء الصحيح", () => {
    const r = computeActionablePOs(
      { id: 99, role: "purchase_requester" },
      [po({ status: "revision_needed", requestedById: 99 })],
      []
    );
    expect(r).toHaveLength(1);
    expect(r[0].reason).toBe("رُدّ إليك للمراجعة");
    expect(r[0].actionLabel).toBe("تعديل وإعادة إرسال");
  });

  it("مستخدم آخر لا يراه", () => {
    const r = computeActionablePOs(
      { id: 50, role: "purchase_requester" },
      [po({ status: "revision_needed", requestedById: 99 })],
      []
    );
    expect(r).toHaveLength(0);
  });
});

describe("الفئة 3 — صنف ملغى أو يحتاج مراجعة (قرار منشئ الطلب)", () => {
  const items = [
    { purchaseOrderId: 1, status: "purchase_cancelled" },
    { purchaseOrderId: 1, status: "approved" },
    { purchaseOrderId: 1, status: "approved" },
    { purchaseOrderId: 1, status: "approved" },
    { purchaseOrderId: 1, status: "approved" },
  ];

  it("منشئ الطلب يرى صنفًا ملغى مع العدد التفصيلي", () => {
    const r = computeActionablePOs(
      { id: 99, role: "purchase_requester" },
      [po({ status: "approved", requestedById: 99 })],
      items
    );
    expect(r).toHaveLength(1);
    expect(r[0].reason).toBe("صنف ملغى يحتاج قرارك — 1 من 5 أصناف");
    expect(r[0].actionLabel).toBe("معالجة");
  });

  it("صنف بحالة مراجعة يعطي وصفًا مختلفًا", () => {
    const r = computeActionablePOs(
      { id: 99, role: "purchase_requester" },
      [po({ status: "approved", requestedById: 99 })],
      [{ purchaseOrderId: 1, status: "needs_item_revision" }, { purchaseOrderId: 1, status: "approved" }]
    );
    expect(r[0].reason).toBe("صنف يحتاج مراجعتك — 1 من 2 أصناف");
  });

  it("مستخدم ليس منشئ الطلب لا يراه ضمن هذي الفئة", () => {
    const r = computeActionablePOs(
      { id: 50, role: "purchase_requester" },
      [po({ status: "approved", requestedById: 99 })],
      items
    );
    expect(r).toHaveLength(0);
  });
});

describe("ملخص الأصناف — 'تم شراء 3 من 5'", () => {
  it("يظهر عند وجود تقدم جزئي فعلي", () => {
    const r = computeActionablePOs(
      { id: 99, role: "purchase_requester" },
      [po({ status: "revision_needed", requestedById: 99 })],
      [
        { purchaseOrderId: 1, status: "purchased" },
        { purchaseOrderId: 1, status: "purchased" },
        { purchaseOrderId: 1, status: "purchased" },
        { purchaseOrderId: 1, status: "approved" },
        { purchaseOrderId: 1, status: "approved" },
      ]
    );
    expect(r[0].itemsSummary).toBe("تم شراء 3 من 5");
  });

  it("لا يظهر إذا لم يُشترَ شيء بعد", () => {
    const r = computeActionablePOs(
      { id: 99, role: "purchase_requester" },
      [po({ status: "revision_needed", requestedById: 99 })],
      [{ purchaseOrderId: 1, status: "approved" }, { purchaseOrderId: 1, status: "approved" }]
    );
    expect(r[0].itemsSummary).toBeUndefined();
  });

  it("لا يظهر إذا اكتمل الشراء بالكامل (لا يوجد 'جزئي')", () => {
    const r = computeActionablePOs(
      { id: 99, role: "purchase_requester" },
      [po({ status: "revision_needed", requestedById: 99 })],
      [{ purchaseOrderId: 1, status: "purchased" }, { purchaseOrderId: 1, status: "purchased" }]
    );
    expect(r[0].itemsSummary).toBeUndefined();
  });
});

describe("سلوك عام", () => {
  it("لا يكرّر الطلب الواحد مرتين حتى لو انطبقت أكثر من فئة", () => {
    const r = computeActionablePOs(
      { id: 99, role: "purchase_requester" },
      [po({ status: "revision_needed", requestedById: 99 })],
      [{ purchaseOrderId: 1, status: "needs_item_revision" }]
    );
    expect(r).toHaveLength(1);
  });

  it("قائمة فارغة تُرجع نتيجة فارغة", () => {
    expect(computeActionablePOs({ id: 1, role: "owner" }, [], [])).toEqual([]);
  });
});
