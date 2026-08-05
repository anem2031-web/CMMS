import { describe, expect, it, vi } from "vitest";
import {
  isPOVisible,
  filterVisiblePOs,
  canPerformAction,
  assertCanPerformAction,
  assertPOVisible,
  canPerformItemAction,
  isItemAssignedToDelegate,
  canPerformItemStatusAction,
  canResolveCreatorReturnedItem,
  canRequestPOItemDelegateChange,
  canResolvePOItemDelegateChange,
} from "../_core/authz/engine";
import { PO_STATUS, ROLE } from "../_core/authz/policy";

// ══════════════════════════════════════════════════════════════════════════
// اختبارات الحارس المركزي — تطابق جدول الصلاحيات المعتمد (v2 + تضييق الحسابات)
// كل سطر هنا يقابل سطرًا بجدول "Purchase-Orders-Permissions-Table-Final.md"
// ══════════════════════════════════════════════════════════════════════════

describe("engine.isPOVisible — نطاق الرؤية لكل دور", () => {
  const po = (status: string, requestedById = 1) => ({ id: 1, status, requestedById });

  it("owner/admin يريان أي طلب بأي حالة", () => {
    expect(isPOVisible({ role: "owner", userId: 999 }, po(PO_STATUS.DRAFT))).toBe(true);
    expect(isPOVisible({ role: "admin", userId: 999 }, po(PO_STATUS.CLOSED))).toBe(true);
  });

  it("maintenance_manager/purchase_manager يريان أي طلب بأي حالة", () => {
    expect(isPOVisible({ role: "maintenance_manager", userId: 999 }, po(PO_STATUS.DRAFT))).toBe(true);
    expect(isPOVisible({ role: "purchase_manager", userId: 999 }, po(PO_STATUS.PENDING_MANAGEMENT))).toBe(true);
  });

  it("purchase_requester يرى طلبه فقط", () => {
    expect(isPOVisible({ role: "purchase_requester", userId: 1 }, po(PO_STATUS.DRAFT, 1))).toBe(true);
    expect(isPOVisible({ role: "purchase_requester", userId: 2 }, po(PO_STATUS.DRAFT, 1))).toBe(false);
  });

  it("technician/operator/supervisor/gate_security يرون طلباتهم فقط (لا صلاحية وظيفية أخرى)", () => {
    for (const role of ["technician", "operator", "supervisor", "gate_security"]) {
      expect(isPOVisible({ role, userId: 1 }, po(PO_STATUS.PENDING_ACCOUNTING, 1))).toBe(true);
      expect(isPOVisible({ role, userId: 2 }, po(PO_STATUS.PENDING_ACCOUNTING, 1))).toBe(false);
    }
  });

  it("food_warehouse_manager يرى طلبه + طلبات المساعدين فقط", () => {
    const ctx = { role: "food_warehouse_manager", userId: 10, assistantUserIds: [20, 21] };
    expect(isPOVisible(ctx, po(PO_STATUS.DRAFT, 10))).toBe(true); // طلبه هو
    expect(isPOVisible(ctx, po(PO_STATUS.DRAFT, 20))).toBe(true); // مساعد تابع له
    expect(isPOVisible(ctx, po(PO_STATUS.DRAFT, 99))).toBe(false); // شخص غير تابع
  });

  it("delegate يرى الطلبات المسندة إليه + طلباته الشخصية", () => {
    const ctx = { role: "delegate", userId: 5, delegateAssignedPoIds: [7, 8] };
    expect(isPOVisible(ctx, { id: 7, status: PO_STATUS.APPROVED, requestedById: 1 })).toBe(true);
    expect(isPOVisible(ctx, { id: 9, status: PO_STATUS.DRAFT, requestedById: 5 })).toBe(true);
    expect(isPOVisible(ctx, { id: 10, status: PO_STATUS.APPROVED, requestedById: 1 })).toBe(false);
  });

  describe("accountant — نطاقه الوظيفي الدقيق + طلباته الشخصية", () => {
    const ctx = { role: "accountant", userId: 3 };
    it("يرى طلباته الشخصية في جميع المراحل", () => {
      for (const status of Object.values(PO_STATUS)) {
        expect(isPOVisible(ctx, po(status, 3))).toBe(true);
      }
    });
    it("يرى فقط pending_accounting", () => {
      expect(isPOVisible(ctx, po(PO_STATUS.PENDING_ACCOUNTING))).toBe(true);
    });
    it("لا يرى draft/pending_review/pending_estimate", () => {
      expect(isPOVisible(ctx, po(PO_STATUS.DRAFT))).toBe(false);
      expect(isPOVisible(ctx, po(PO_STATUS.PENDING_REVIEW))).toBe(false);
      expect(isPOVisible(ctx, po(PO_STATUS.PENDING_ESTIMATE))).toBe(false);
    });
    it("لا يرى الطلب بعد اعتماده هو نفسه (pending_management)", () => {
      expect(isPOVisible(ctx, po(PO_STATUS.PENDING_MANAGEMENT))).toBe(false);
    });
    it("لا يرى الطلب بعد رفضه هو نفسه (rejected)", () => {
      expect(isPOVisible(ctx, po(PO_STATUS.REJECTED))).toBe(false);
    });
    it("لا يرى أي حالة لاحقة أخرى (approved/purchased/closed)", () => {
      expect(isPOVisible(ctx, po(PO_STATUS.APPROVED))).toBe(false);
      expect(isPOVisible(ctx, po(PO_STATUS.PURCHASED))).toBe(false);
      expect(isPOVisible(ctx, po(PO_STATUS.CLOSED))).toBe(false);
    });
  });

  describe("senior_management / executive_director — نطاق العمل + طلباتهم الشخصية", () => {
    for (const role of ["senior_management", "executive_director"]) {
      it(`${role}: يرى طلباته الشخصية قبل pending_management`, () => {
        const ctx = { role, userId: 4 };
        expect(isPOVisible(ctx, po(PO_STATUS.DRAFT, 4))).toBe(true);
        expect(isPOVisible(ctx, po(PO_STATUS.PENDING_ACCOUNTING, 4))).toBe(true);
      });
      it(`${role}: لا يرى قبل pending_management`, () => {
        const ctx = { role, userId: 4 };
        expect(isPOVisible(ctx, po(PO_STATUS.DRAFT))).toBe(false);
        expect(isPOVisible(ctx, po(PO_STATUS.PENDING_ACCOUNTING))).toBe(false);
      });
      it(`${role}: يرى من pending_management فصاعدًا`, () => {
        const ctx = { role, userId: 4 };
        expect(isPOVisible(ctx, po(PO_STATUS.PENDING_MANAGEMENT))).toBe(true);
        expect(isPOVisible(ctx, po(PO_STATUS.APPROVED))).toBe(true);
        expect(isPOVisible(ctx, po(PO_STATUS.CLOSED))).toBe(true);
        expect(isPOVisible(ctx, po(PO_STATUS.REJECTED))).toBe(true);
      });
    }
  });

  it("🔧 إصلاح 2026-07-30: warehouse يرى طلباته الخاصة بأي حالة (دور مزدوج: مستلِم ومُنشئ)", () => {
    const ctx = { role: "warehouse", userId: 6 };
    // طلبات غيره بمراحل ما قبل الشراء: محجوبة (كما كان)
    expect(isPOVisible(ctx, po(PO_STATUS.DRAFT, 99))).toBe(false);
    expect(isPOVisible(ctx, po(PO_STATUS.PENDING_ESTIMATE, 99))).toBe(false);
    // طلباته هو بنفس المراحل: ظاهرة الآن (كانت محجوبة قبل الإصلاح — خلل حقيقي)
    expect(isPOVisible(ctx, po(PO_STATUS.DRAFT, 6))).toBe(true);
    expect(isPOVisible(ctx, po(PO_STATUS.PENDING_ESTIMATE, 6))).toBe(true);
    expect(isPOVisible(ctx, po(PO_STATUS.PENDING_ACCOUNTING, 6))).toBe(true);
  });

  it("warehouse يرى طلبات الآخرين في مراحل عمل المستودع الأربع فقط", () => {
    const ctx = { role: "warehouse", userId: 6 };
    expect(isPOVisible(ctx, po(PO_STATUS.APPROVED, 99))).toBe(false);
    expect(isPOVisible(ctx, po(PO_STATUS.PARTIAL_PURCHASE, 99))).toBe(true);
    expect(isPOVisible(ctx, po(PO_STATUS.PURCHASED, 99))).toBe(true);
    expect(isPOVisible(ctx, po(PO_STATUS.RECEIVED, 99))).toBe(true);
    expect(isPOVisible(ctx, po(PO_STATUS.CLOSED, 99))).toBe(true);
    expect(isPOVisible(ctx, po(PO_STATUS.REJECTED, 99))).toBe(false);
    expect(isPOVisible(ctx, po(PO_STATUS.REVISION_NEEDED, 99))).toBe(false);
  });

  it("كل دور يملك صلاحية الإنشاء يمكنه رؤية طلبه الشخصي في جميع الحالات", () => {
    for (const role of Object.values(ROLE)) {
      expect(canPerformAction("create", { role, userId: 77 })).toBe(true);
      for (const status of Object.values(PO_STATUS)) {
        expect(isPOVisible({ role, userId: 77 }, po(status, 77))).toBe(true);
      }
    }
  });

  it("دور غير معرَّف بالسياسة يُرفض تلقائيًا (Default Deny)", () => {
    expect(isPOVisible({ role: "some_future_role", userId: 1 }, po(PO_STATUS.DRAFT, 1))).toBe(false);
  });
});

describe("engine.filterVisiblePOs — تطابق نطاق list() مع getById() بالضرورة", () => {
  it("يجمع للمحاسب بين pending_accounting وطلباته الشخصية", () => {
    const pos = [
      { id: 1, status: PO_STATUS.DRAFT, requestedById: 1 },
      { id: 2, status: PO_STATUS.PENDING_ACCOUNTING, requestedById: 1 },
      { id: 3, status: PO_STATUS.PENDING_MANAGEMENT, requestedById: 1 },
      { id: 4, status: PO_STATUS.DRAFT, requestedById: 3 },
      { id: 5, status: PO_STATUS.CLOSED, requestedById: 3 },
    ];
    const result = filterVisiblePOs({ role: "accountant", userId: 3 }, pos);
    expect(result.map((p) => p.id)).toEqual([2, 4, 5]);
  });
});

describe("engine.canPerformAction / assertCanPerformAction — الإجراءات", () => {
  it("owner/admin يقدران على أي إجراء بأي حالة", () => {
    expect(canPerformAction("reject", { role: "owner", userId: 1 }, { status: PO_STATUS.DRAFT })).toBe(true);
    expect(canPerformAction("deleteOrder", { role: "admin", userId: 1 })).toBe(true);
  });

  describe("reject — مقيّد بالمرحلة (نفس مرحلة الاعتماد المقابلة)", () => {
    it("accountant يرفض فقط بمرحلة pending_accounting", () => {
      expect(canPerformAction("reject", { role: "accountant", userId: 3 }, { status: PO_STATUS.PENDING_ACCOUNTING })).toBe(true);
      expect(canPerformAction("reject", { role: "accountant", userId: 3 }, { status: PO_STATUS.PENDING_MANAGEMENT })).toBe(false);
    });
    it("senior_management يرفض فقط بمرحلة pending_management", () => {
      expect(canPerformAction("reject", { role: "senior_management", userId: 4 }, { status: PO_STATUS.PENDING_MANAGEMENT })).toBe(true);
      expect(canPerformAction("reject", { role: "senior_management", userId: 4 }, { status: PO_STATUS.PENDING_ACCOUNTING })).toBe(false);
    });
    it("executive_director ممنوع من الرفض بأي مرحلة (مستثنى صراحة، ليس بالقائمة)", () => {
      expect(canPerformAction("reject", { role: "executive_director", userId: 5 }, { status: PO_STATUS.PENDING_MANAGEMENT })).toBe(false);
    });
    it("technician (أي دور آخر) ممنوع من الرفض دائمًا — هذا هو الإصلاح الأمني الأصلي", () => {
      expect(canPerformAction("reject", { role: "technician", userId: 7 }, { status: PO_STATUS.PENDING_MANAGEMENT })).toBe(false);
    });
  });

  it("approveAccounting: accountant فقط بمرحلة pending_accounting", () => {
    expect(canPerformAction("approveAccounting", { role: "accountant", userId: 3 }, { status: PO_STATUS.PENDING_ACCOUNTING })).toBe(true);
    expect(canPerformAction("approveAccounting", { role: "senior_management", userId: 4 }, { status: PO_STATUS.PENDING_ACCOUNTING })).toBe(false);
  });

  it("✅ إصلاح 2026-07-28: approveAccounting يُمنع على طلب تجاوز مرحلة المحاسبة (rejected/approved/purchased)", () => {
    const ctx = { role: "accountant", userId: 3 };
    expect(canPerformAction("approveAccounting", ctx, { status: PO_STATUS.REJECTED })).toBe(false);
    expect(canPerformAction("approveAccounting", ctx, { status: PO_STATUS.APPROVED })).toBe(false);
    expect(canPerformAction("approveAccounting", ctx, { status: PO_STATUS.PURCHASED })).toBe(false);
  });

  it("approveManagement: senior_management فقط، executive_director ممنوع صراحة", () => {
    expect(canPerformAction("approveManagement", { role: "senior_management", userId: 4 }, { status: PO_STATUS.PENDING_MANAGEMENT })).toBe(true);
    expect(canPerformAction("approveManagement", { role: "executive_director", userId: 5 }, { status: PO_STATUS.PENDING_MANAGEMENT })).toBe(false);
  });

  it("✅ إصلاح 2026-07-28: approveManagement يُمنع على طلب تجاوز مرحلة الإدارة (rejected/purchased/closed)", () => {
    const ctx = { role: "senior_management", userId: 4 };
    expect(canPerformAction("approveManagement", ctx, { status: PO_STATUS.REJECTED })).toBe(false);
    expect(canPerformAction("approveManagement", ctx, { status: PO_STATUS.PURCHASED })).toBe(false);
    expect(canPerformAction("approveManagement", ctx, { status: PO_STATUS.CLOSED })).toBe(false);
  });

  it("editDraft/submitDraft: منشئ الطلب فقط لبقية الأدوار، وowner/admin يتجاوزان الملكية والحالة", () => {
    expect(canPerformAction("editDraft", { role: "purchase_requester", userId: 1, isCreator: true }, { status: PO_STATUS.DRAFT })).toBe(true);
    expect(canPerformAction("editDraft", { role: "purchase_requester", userId: 1, isCreator: false }, { status: PO_STATUS.DRAFT })).toBe(false);
    expect(canPerformAction("editDraft", { role: "purchase_requester", userId: 1, isCreator: true }, { status: PO_STATUS.PENDING_REVIEW })).toBe(false);
    expect(canPerformAction("editDraft", { role: "admin", userId: 99, isCreator: false }, { status: PO_STATUS.DRAFT })).toBe(true);
    expect(canPerformAction("submitDraft", { role: "owner", userId: 98, isCreator: false }, { status: PO_STATUS.DRAFT })).toBe(true);
  });

  it("deleteOrder: owner/admin فقط (لا بند إضافي بالسياسة)", () => {
    expect(canPerformAction("deleteOrder", { role: "purchase_manager", userId: 1 })).toBe(false);
    expect(canPerformAction("deleteOrder", { role: "owner", userId: 1 })).toBe(true);
  });

  it("assertCanPerformAction يرمي FORBIDDEN عند الرفض", () => {
    expect(() =>
      assertCanPerformAction("reject", { role: "technician", userId: 7 }, { status: PO_STATUS.PENDING_MANAGEMENT })
    ).toThrow();
  });


  it("cancelItem مرتبط بمرحلة الدور مع بقاء owner/admin مطلقين", () => {
    const maint = { role: "maintenance_manager", userId: 8 };
    const senior = { role: "senior_management", userId: 4 };

    expect(canPerformAction("cancelItem", maint, { status: PO_STATUS.PENDING_REVIEW })).toBe(true);
    expect(canPerformAction("cancelItem", maint, { status: PO_STATUS.PENDING_ESTIMATE })).toBe(false);
    expect(canPerformAction("cancelItem", maint, { status: PO_STATUS.PENDING_ACCOUNTING })).toBe(false);
    expect(canPerformAction("cancelItem", senior, { status: PO_STATUS.PENDING_REVIEW })).toBe(false);
    expect(canPerformAction("cancelItem", senior, { status: PO_STATUS.PENDING_MANAGEMENT })).toBe(true);
    expect(canPerformAction("cancelItem", { role: "owner", userId: 9 }, { status: PO_STATUS.APPROVED })).toBe(true);
    expect(canPerformAction("cancelItem", { role: "admin", userId: 99 }, { status: PO_STATUS.CLOSED })).toBe(true);
  });

  it("إجراء غير معرَّف بالسياسة يُرفض تلقائيًا (Default Deny)", () => {
    expect(canPerformAction("someFutureAction" as any, { role: "owner", userId: 1 })).toBe(true); // owner bypass
    expect(canPerformAction("someFutureAction" as any, { role: "accountant", userId: 3 })).toBe(false);
  });
});

describe("assertPOVisible", () => {
  it("يرمي FORBIDDEN لدور لا يملك الرؤية", () => {
    expect(() =>
      assertPOVisible({ role: "technician", userId: 2 }, { id: 1, status: PO_STATUS.DRAFT, requestedById: 1 })
    ).toThrow();
  });
  it("لا يرمي شيئًا لدور يملك الرؤية", () => {
    expect(() =>
      assertPOVisible({ role: "technician", userId: 1 }, { id: 1, status: PO_STATUS.DRAFT, requestedById: 1 })
    ).not.toThrow();
  });
});

describe("engine.canPerformItemAction — editItem/deleteItem (منطق مستوى الصنف)", () => {
  for (const action of ["editItem", "deleteItem"] as const) {
    describe(action, () => {
      it("maintenance_manager يعدّل/يحذف فقط قبل خروج الطلب من مرحلته", () => {
        const ctx = { role: "maintenance_manager", userId: 8, isCreator: false };
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.DRAFT })
        ).toBe(true);
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.PENDING_REVIEW })
        ).toBe(true);
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.PENDING_ESTIMATE })
        ).toBe(false);
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.PENDING_ACCOUNTING })
        ).toBe(false);
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.PENDING_MANAGEMENT })
        ).toBe(false);
      });

      it("منشئ الطلب العادي (غير مميّز) يُمنع بالحالات العادية بدون استثناء مراجعة/إلغاء", () => {
        const ctx = { role: "purchase_requester", userId: 1, isCreator: true };
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.PENDING_ESTIMATE })
        ).toBe(false);
      });

      it("منشئ الطلب يُسمح له لو الصنف needs_item_revision (بغض النظر عن دوره)", () => {
        const ctx = { role: "purchase_requester", userId: 1, isCreator: true };
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "needs_item_revision", poStatus: PO_STATUS.PENDING_ACCOUNTING })
        ).toBe(true);
      });

      it("منشئ الطلب يُسمح له لو الصنف purchase_cancelled", () => {
        const ctx = { role: "purchase_requester", userId: 1, isCreator: true };
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "purchase_cancelled", poStatus: PO_STATUS.APPROVED })
        ).toBe(true);
      });

      it("owner/admin يتجاوزان الملكية والحالة حتى عند revision_needed", () => {
        const ctxOwner = { role: "owner", userId: 999, isCreator: false };
        const ctxAdmin = { role: "admin", userId: 998, isCreator: false };
        expect(
          canPerformItemAction(action, ctxOwner, { itemStatus: "pending", poStatus: PO_STATUS.REVISION_NEEDED })
        ).toBe(true);
        expect(
          canPerformItemAction(action, ctxAdmin, { itemStatus: "delivered_to_requester", poStatus: PO_STATUS.CLOSED })
        ).toBe(true);
      });

      it("cancelled حالة نهائية غير قابلة للتعديل أو الحذف حتى لـ owner/admin", () => {
        const ctxOwner = { role: "owner", userId: 999, isCreator: false };
        const ctxAdmin = { role: "admin", userId: 998, isCreator: false };
        expect(
          canPerformItemAction(action, ctxOwner, { itemStatus: "cancelled", poStatus: PO_STATUS.PENDING_REVIEW })
        ).toBe(false);
        expect(
          canPerformItemAction(action, ctxAdmin, { itemStatus: "cancelled", poStatus: PO_STATUS.CLOSED })
        ).toBe(false);
      });

      it("عند po.status=revision_needed: منشئ الطلب مسموح له حتى لو دوره عادي", () => {
        const ctx = { role: "purchase_requester", userId: 1, isCreator: true };
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.REVISION_NEEDED })
        ).toBe(true);
      });

      it("غير منشئ الطلب وغير مميّز: ممنوع دائمًا بأي حالة", () => {
        const ctx = { role: "technician", userId: 55, isCreator: false };
        expect(
          canPerformItemAction(action, ctx, { itemStatus: "pending", poStatus: PO_STATUS.DRAFT })
        ).toBe(false);
      });
    });
  }

  it("deleteItem لا يشمل revision_needed ضمن الحالات العادية للأدوار المميّزة (خلافًا لـeditItem)", () => {
    const ctx = { role: "maintenance_manager", userId: 8, isCreator: false };
    // maintenance_manager غير منشئ الطلب، والحالة revision_needed تُقصر على المنشئ حصرًا في كلا الإجراءين أصلًا
    expect(
      canPerformItemAction("deleteItem", ctx, { itemStatus: "pending", poStatus: PO_STATUS.REVISION_NEEDED })
    ).toBe(false);
  });
});

describe("engine.isItemAssignedToDelegate — estimateCost/confirmPurchase", () => {
  it("المندوب صاحب الصنف مسموح له", () => {
    expect(
      isItemAssignedToDelegate({ role: "delegate", userId: 5 }, { delegateId: 5 })
    ).toBe(true);
  });
  it("مندوب آخر غير مسموح له", () => {
    expect(
      isItemAssignedToDelegate({ role: "delegate", userId: 5 }, { delegateId: 6 })
    ).toBe(false);
  });
  it("owner/admin يتجاوزان دائمًا", () => {
    expect(
      isItemAssignedToDelegate({ role: "owner", userId: 999 }, { delegateId: 6 })
    ).toBe(true);
  });
});


describe("engine.canResolveCreatorReturnedItem — حسم الصنف المعاد للمنشئ", () => {
  it("منشئ الطلب يستطيع حسم طلب مراجعة الصنف أو إلغاء الشراء", () => {
    const ctx = { role: "purchase_requester", userId: 10 };
    expect(canResolveCreatorReturnedItem(ctx, { requestedById: 10, itemStatus: "needs_item_revision" })).toBe(true);
    expect(canResolveCreatorReturnedItem(ctx, { requestedById: 10, itemStatus: "purchase_cancelled" })).toBe(true);
  });

  it("مستخدم آخر لا يستطيع الحسم حتى لو كان دوره يملك تعديلًا وظيفيًا", () => {
    expect(
      canResolveCreatorReturnedItem(
        { role: "maintenance_manager", userId: 20 },
        { requestedById: 10, itemStatus: "needs_item_revision" }
      )
    ).toBe(false);
  });

  it("owner/admin يستطيعان الحسم بغض النظر عن المنشئ", () => {
    for (const role of ["owner", "admin"]) {
      expect(
        canResolveCreatorReturnedItem(
          { role, userId: 999 },
          { requestedById: 10, itemStatus: "purchase_cancelled" }
        )
      ).toBe(true);
    }
  });

  it("لا يسمح بالحسم لصنف ليس في حالة عودة للمنشئ حتى مع owner/admin", () => {
    for (const role of ["purchase_requester", "owner", "admin"]) {
      expect(
        canResolveCreatorReturnedItem(
          { role, userId: 10 },
          { requestedById: 10, itemStatus: "approved" }
        )
      ).toBe(false);
    }
  });
});

describe("engine.canPerformItemStatusAction — confirmDeliveryToWarehouse/confirmDeliveryToRequester (حالة الصنف لا الطلب)", () => {
  it("warehouse يستلم صنفًا حالته purchased فقط", () => {
    const ctx = { role: "warehouse", userId: 6 };
    expect(canPerformItemStatusAction("confirmDeliveryToWarehouse", ctx, "purchased")).toBe(true);
    expect(canPerformItemStatusAction("confirmDeliveryToWarehouse", ctx, "approved")).toBe(false);
  });

  it("مثال الشراء الجزئي: صنف 'مشترى' يُقبل، صنف 'معتمد بانتظار الشراء' بنفس الطلب يُرفض", () => {
    const ctx = { role: "warehouse", userId: 6 };
    // صنف 1 بنفس الطلب: مشترى فعلاً
    expect(canPerformItemStatusAction("confirmDeliveryToWarehouse", ctx, "purchased")).toBe(true);
    // صنف 2 بنفس الطلب: لسه ما اشتُرى (approved) — يُمنع رغم أن حالة الطلب نفسه "شراء جزئي"
    expect(canPerformItemStatusAction("confirmDeliveryToWarehouse", ctx, "approved")).toBe(false);
  });

  it("warehouse يسلّم للطالب فقط صنفًا حالته delivered_to_warehouse", () => {
    const ctx = { role: "warehouse", userId: 6 };
    expect(canPerformItemStatusAction("confirmDeliveryToRequester", ctx, "delivered_to_warehouse")).toBe(true);
    expect(canPerformItemStatusAction("confirmDeliveryToRequester", ctx, "purchased")).toBe(false);
  });

  it("دور آخر غير warehouse ممنوع دائمًا", () => {
    const ctx = { role: "delegate", userId: 5 };
    expect(canPerformItemStatusAction("confirmDeliveryToWarehouse", ctx, "purchased")).toBe(false);
  });

  it("owner/admin يتجاوزان بأي حالة صنف", () => {
    const ctx = { role: "owner", userId: 999 };
    expect(canPerformItemStatusAction("confirmDeliveryToWarehouse", ctx, "approved")).toBe(true);
  });
});


describe("تغيير مندوب الصنف قبل التسعير", () => {
  const base = {
    delegateId: 10,
    itemStatus: "pending",
    batchId: null,
    estimatedUnitCost: null,
    delegateChangeRequestedAt: null,
  };

  it("المندوب الحالي فقط يستطيع إنشاء الطلب قبل التسعير", () => {
    expect(canRequestPOItemDelegateChange({ role: "delegate", userId: 10 }, base)).toBe(true);
    expect(canRequestPOItemDelegateChange({ role: "delegate", userId: 11 }, base)).toBe(false);
    expect(canRequestPOItemDelegateChange({ role: "maintenance_manager", userId: 10 }, base)).toBe(false);
  });

  it("يُمنع الطلب بعد التسعير أو الإرسال أو مع وجود طلب معلّق", () => {
    expect(canRequestPOItemDelegateChange({ role: "delegate", userId: 10 }, { ...base, itemStatus: "estimated" })).toBe(false);
    expect(canRequestPOItemDelegateChange({ role: "delegate", userId: 10 }, { ...base, estimatedUnitCost: "25.00" })).toBe(false);
    expect(canRequestPOItemDelegateChange({ role: "delegate", userId: 10 }, { ...base, batchId: 7 })).toBe(false);
    expect(canRequestPOItemDelegateChange({ role: "delegate", userId: 10 }, { ...base, delegateChangeRequestedAt: new Date() })).toBe(false);
  });

  it("مدير الصيانة وowner/admin يحسمون الطلب، وبقية الأدوار لا", () => {
    const pendingRequest = { ...base, delegateChangeRequestedAt: new Date() };
    for (const role of ["maintenance_manager", "owner", "admin"]) {
      expect(canResolvePOItemDelegateChange({ role, userId: 99 }, pendingRequest)).toBe(true);
    }
    expect(canResolvePOItemDelegateChange({ role: "delegate", userId: 10 }, pendingRequest)).toBe(false);
    expect(canResolvePOItemDelegateChange({ role: "purchase_manager", userId: 20 }, pendingRequest)).toBe(false);
  });
});
