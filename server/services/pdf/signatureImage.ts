// ============================================================
// التوقيع الإلكتروني — تحويل صورة التوقيع المخزَّنة إلى data URL
//
// لماذا base64 وليس رابطًا مباشرًا؟
// وثائق PDF تُبنى بـPuppeteer عبر page.setContent()، وهي بلا عنوان أساس،
// فالروابط النسبية مثل /api/media?key=... لا يمكن للمتصفح داخل الخادم
// أن يحلّها. لذلك نقرأ الملف مباشرة من التخزين ونضمّنه في الـHTML
// كـ data URL — فيظهر التوقيع دائمًا بلا اعتماد على الشبكة أو المصادقة.
// ============================================================
import { storageGetStream } from "../../_core/storage";

// يستخرج مفتاح التخزين من أي صيغة محفوظة (proxy URL، رابط S3 كامل، أو مفتاح مباشر)
function extractStorageKey(urlOrKey: string): string | null {
  if (!urlOrKey) return null;

  // /api/media?key=cmms/uploads/xxx.webp
  if (urlOrKey.includes("/api/media")) {
    try {
      const url = new URL(urlOrKey, "http://localhost");
      const key = url.searchParams.get("key");
      return key ? decodeURIComponent(key) : null;
    } catch {
      return null;
    }
  }

  // رابط S3/iDrive كامل
  const s3Match = urlOrKey.match(/idrivee2\.com\/[^/]+\/(.+)$/);
  if (s3Match) return s3Match[1];

  // مفتاح مباشر
  if (urlOrKey.startsWith("cmms/") || urlOrKey.startsWith("uploads/")) return urlOrKey;

  return null;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * يحوّل رابط/مفتاح صورة التوقيع إلى data URL جاهز للتضمين في HTML.
 * يُرجع "" عند غياب التوقيع أو فشل القراءة — فتبقى خانة التوقيع فارغة
 * للتوقيع اليدوي بدل تعطيل إصدار الوثيقة بالكامل.
 */
export async function getSignatureDataUrl(urlOrKey: string | null | undefined): Promise<string> {
  if (!urlOrKey) return "";
  const key = extractStorageKey(urlOrKey);
  if (!key) return "";
  try {
    const { stream, contentType } = await storageGetStream(key);
    const buffer = await streamToBuffer(stream);
    const mime = contentType.startsWith("image/") ? contentType : "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (e: any) {
    console.error("[Signature] تعذّرت قراءة صورة التوقيع:", e?.message || e);
    return "";
  }
}
