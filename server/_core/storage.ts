// Storage helpers using iDrive e2 (S3-compatible)
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_ENDPOINT   = process.env.S3_ENDPOINT   || "https://s3.eu-central-1.idrivee2.com";
const S3_REGION     = process.env.S3_REGION      || "eu-central-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY  || "";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY  || "";
const S3_BUCKET     = process.env.S3_BUCKET      || "cmms-uploads";

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

/**
 * فحص صحّة التخزين عند إقلاع السيرفر.
 *
 * سبب وجوده (2026-08-13): توقّف رفع الملفات في النظام بالكامل لأن `S3_ACCESS_KEY`
 * في `.env` كان يحوي حرفًا خاطئًا واحدًا عند نسخه من لوحة iDrive (`j` بدل `i`).
 * لم يكن هناك أي مؤشر عند الإقلاع، فظهر العطل فقط كفشل رفع عند المستخدم النهائي،
 * واستغرق تشخيصه ساعتين. هذا الفحص يكشف نفس الحالة خلال ثانيتين من `npm run dev`.
 *
 * ⚠️ لا يوقف السيرفر إطلاقًا — التخزين ليس شرطًا لتشغيل بقية النظام (البلاغات،
 * أوامر العمل، المخزون تعمل بلا رفع ملفات). يطبع تحذيرًا واضحًا ويكمل.
 */
export async function checkStorageHealth(): Promise<boolean> {
  const missing: string[] = [];
  if (!S3_ACCESS_KEY) missing.push("S3_ACCESS_KEY");
  if (!S3_SECRET_KEY) missing.push("S3_SECRET_KEY");
  if (missing.length > 0) {
    console.error(`[Storage] ❌ متغيرات مفقودة في .env: ${missing.join("، ")}`);
    console.error("[Storage] ⚠️  رفع الملفات وعرض الصور لن يعملا حتى تُضاف هذه القيم ويُعاد تشغيل السيرفر.");
    return false;
  }

  try {
    // HeadBucket أخف عملية ممكنة: تتحقق من المفتاح والسر والمنطقة ووجود المستودع
    // والصلاحية عليه دفعة واحدة، بلا نقل أي بيانات.
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`[Storage] ✅ متصل بالمستودع "${S3_BUCKET}" على ${S3_ENDPOINT}`);
    return true;
  } catch (error: any) {
    const name = error?.name || error?.Code || "UnknownError";
    const status = error?.$metadata?.httpStatusCode;
    console.error(`[Storage] ❌ فشل الاتصال بالتخزين: ${name}${status ? ` (HTTP ${status})` : ""}`);

    // ترجمة أشيع الأخطاء إلى سبب وإجراء محدد بدل رسالة SDK المبهمة
    if (name === "InvalidAccessKeyId") {
      console.error(`[Storage]    السبب: مفتاح الوصول غير موجود في سجلات المزوّد.`);
      console.error(`[Storage]    المفتاح المُستخدَم: ${S3_ACCESS_KEY.slice(0, 4)}…${S3_ACCESS_KEY.slice(-4)} (${S3_ACCESS_KEY.length} حرفًا)`);
      console.error(`[Storage]    الإجراء: قارنه حرفًا بحرف بلوحة iDrive e2 — انسخه بزر النسخ ولا تكتبه يدويًا`);
      console.error(`[Storage]              (الأحرف 0/O و 1/l/I و i/j متشابهة بصريًا وسببت هذا العطل سابقًا)،`);
      console.error(`[Storage]              وتأكد أن المفتاح لم تنتهِ صلاحيته أو يُحذف.`);
    } else if (name === "SignatureDoesNotMatch") {
      console.error(`[Storage]    السبب: المفتاح صحيح لكن S3_SECRET_KEY خاطئ أو ناقص.`);
      console.error(`[Storage]    الإجراء: السر لا يُعرض بعد الإنشاء — أنشئ مفتاحًا جديدًا وانسخه بـ Copy All.`);
    } else if (name === "NoSuchBucket" || name === "NotFound") {
      console.error(`[Storage]    السبب: المستودع "${S3_BUCKET}" غير موجود في المنطقة "${S3_REGION}".`);
      console.error(`[Storage]    الإجراء: تحقق من S3_BUCKET و S3_ENDPOINT — كل منطقة لها endpoint منفصل.`);
    } else if (name === "AccessDenied" || status === 403) {
      console.error(`[Storage]    السبب: المفتاح صالح لكن بلا صلاحية على هذا المستودع.`);
      console.error(`[Storage]    الإجراء: راجع Assign buckets وصلاحية Read/Write للمفتاح في لوحة المزوّد.`);
    } else {
      console.error(`[Storage]    التفاصيل: ${error?.message || "بلا تفاصيل"}`);
    }
    console.error(`[Storage] ⚠️  رفع الملفات وعرض الصور لن يعملا حتى يُصلَح هذا. بقية النظام تعمل طبيعيًا.`);
    return false;
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body as Buffer,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  const url = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  try {
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { expiresIn: 3600 }
    );
    return { key, url: signedUrl };
  } catch {
    const publicUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
    return { key, url: publicUrl };
  }
}

export async function storageGetStream(relKey: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string }> {
  const key = normalizeKey(relKey);
  const response = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  const stream = response.Body as NodeJS.ReadableStream;
  const contentType = response.ContentType || "application/octet-stream";
  return { stream, contentType };
}

/**
 * Rename (copy → delete) a file in S3-compatible storage.
 * Used to rename asset photos to match their RFID tag.
 * Returns the new key and public URL.
 */
export async function storageRename(
  oldRelKey: string,
  newRelKey: string
): Promise<{ key: string; url: string }> {
  const oldKey = normalizeKey(oldRelKey);
  const newKey = normalizeKey(newRelKey);

  // 1. Copy to new key
  await s3.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${oldKey}`,
      Key: newKey,
      ACL: "public-read",
    })
  );

  // 2. Delete old key
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: oldKey,
    })
  );

  const url = `${S3_ENDPOINT}/${S3_BUCKET}/${newKey}`;
  return { key: newKey, url };
}

/**
 * Delete a file from S3-compatible storage.
 */
export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
}

/**
 * Presigned URL للرفع المباشر من المتصفح إلى S3
 * صالح 5 دقائق فقط، مقيّد بنوع الملف
 */
export async function storagePresignedPut(
  relKey: string,
  contentType: string,
  expiresIn = 300
): Promise<{ uploadUrl: string; key: string; proxyUrl: string }> {
  const key = normalizeKey(relKey);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "public-read",
    }),
    { expiresIn }
  );
  const proxyUrl = `/api/media?key=${encodeURIComponent(key)}`;
  return { uploadUrl, key, proxyUrl };
}

/**
 * Presigned URL للقراءة المباشرة من S3
 * صالح ساعة واحدة
 */
export async function storagePresignedGet(
  relKey: string,
  expiresIn = 3600
): Promise<string> {
  const key = normalizeKey(relKey);
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn }
  );
}
