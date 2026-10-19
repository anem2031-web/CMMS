// ============================================================
// يحوّل نص HTML جاهز (نفس القالب المستخدم للطباعة المباشرة) إلى
// ملف PDF حقيقي عبر نقطة التصدير العامة في الخادم (Puppeteer)،
// ثم يعرضه في تبويب جديد أو ينزّله — بلا أي تكرار لمنطق القوالب.
// ============================================================

export type InventoryPdfSource = { type: "receipt" | "delivery" | "warehouse_issue" | "return" | "disposal" | "count" | "settlement"; id: number };

async function fetchPdfBlob(html: string, filename: string, download: boolean, source?: InventoryPdfSource): Promise<Blob> {
  const res = await fetch(`/api/export/html-to-pdf?download=${download ? "1" : "0"}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, filename, source }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "تعذر إنشاء ملف PDF");
  }
  return res.blob();
}

// يفتح المستند كـPDF في تبويب جديد للعرض
export async function viewDocumentAsPdf(html: string, filename: string, source?: InventoryPdfSource) {
  const blob = await fetchPdfBlob(html, filename, false, source);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ينزّل المستند كملف PDF مباشرة على جهاز المستخدم
export async function downloadDocumentAsPdf(html: string, filename: string, source?: InventoryPdfSource) {
  const blob = await fetchPdfBlob(html, filename, true, source);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
