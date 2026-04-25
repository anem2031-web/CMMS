// Storage helpers using iDrive e2 (S3-compatible)
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
