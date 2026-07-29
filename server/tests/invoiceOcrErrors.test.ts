import { describe, expect, it, vi, beforeEach } from "vitest";

// ══════════════════════════════════════════════════════════════════════════
// اختبارات ترجمة أخطاء مزوّد الذكاء الاصطناعي إلى رسائل واضحة للمستخدم
// (تحليل الفواتير — invoiceOcr.service.ts)
// ══════════════════════════════════════════════════════════════════════════

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

const { analyzeInvoiceFromBase64 } = await import("../services/ocr/invoiceOcr.service");

const B64 = "iVBORw0KGgo=";

beforeEach(() => {
  createMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

async function expectMessage(thrown: any, contains: string[]) {
  createMock.mockRejectedValueOnce(thrown);
  try {
    await analyzeInvoiceFromBase64(B64, "image/jpeg");
    throw new Error("كان يفترض أن ترمي خطأ");
  } catch (e: any) {
    for (const c of contains) expect(e.message).toContain(c);
    // لا يجب أن تتسرّب أي تفاصيل تقنية للمستخدم
    expect(e.message).not.toContain("request_id");
    expect(e.message).not.toContain("invalid_request_error");
    expect(e.message).not.toContain("Anthropic");
    return e.message;
  }
}

describe("نفاد الرصيد — الحالة التي واجهها المستخدم فعليًا", () => {
  it("يعرض رسالة عربية واضحة مع البديل، بلا أي تفاصيل تقنية", async () => {
    const raw = Object.assign(
      new Error(
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}'
      ),
      { status: 400, request_id: "req_011CdVzZjtFdzp2tVd5U9rTd" }
    );
    const msg = await expectMessage(raw, [
      "تعذّر تحليل الفاتورة تلقائياً",
      "إدخال بيانات الفاتورة يدوياً",
      "إبلاغ مسؤول النظام",
    ]);
    expect(msg).not.toContain("credit balance");
  });

  it("يسجّل التفاصيل التقنية كاملة بسجلات الخادم (لا بالشاشة)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createMock.mockRejectedValueOnce(
      Object.assign(new Error("Your credit balance is too low"), {
        status: 400,
        request_id: "req_ABC123",
      })
    );
    await analyzeInvoiceFromBase64(B64, "image/jpeg").catch(() => {});
    const logged = spy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(logged).toContain("[OCR] Anthropic API error 400");
    expect(logged).toContain("req_ABC123");
  });
});

describe("باقي أخطاء المزوّد — كل حالة لها رسالة مناسبة", () => {
  it("مفتاح غير صالح (401) → رسالة إعدادات", async () => {
    await expectMessage(
      Object.assign(new Error("authentication_error: invalid x-api-key"), { status: 401 }),
      ["إعدادات خدمة التحليل الذكي غير صحيحة", "يدوياً"]
    );
  });

  it("تجاوز حد الاستخدام (429) → رسالة انشغال مؤقت", async () => {
    await expectMessage(
      Object.assign(new Error("rate limit exceeded"), { status: 429 }),
      ["مشغولة حالياً", "المحاولة بعد قليل"]
    );
  });

  it("عطل بخوادم المزوّد (500) → رسالة عطل مؤقت", async () => {
    await expectMessage(
      Object.assign(new Error("internal server error"), { status: 500 }),
      ["عطلاً مؤقتاً", "المحاولة بعد قليل"]
    );
  });

  it("خطأ غير متوقع → رسالة عامة مع البديل اليدوي", async () => {
    await expectMessage(new Error("something totally unexpected"), [
      "خطأ غير متوقع",
      "يدوياً",
    ]);
  });
});
