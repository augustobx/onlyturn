import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function config() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) throw new Error("Cloudflare R2 no está configurado");
  return { endpoint, bucket, accessKeyId, secretAccessKey, publicUrl };
}

export function r2IsConfigured() {
  return Boolean(process.env.R2_ENDPOINT && process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_PUBLIC_URL);
}

export async function uploadTenantImage(tenantId: string, kind: string, file: File) {
  if (!allowedTypes.has(file.type)) throw new Error("Formato de imagen no permitido");
  if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error("La imagen debe pesar menos de 5 MB");
  const cfg = config();
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const objectKey = `tenants/${tenantId}/${kind.toLowerCase()}/${randomUUID()}.${extension}`;
  const client = new S3Client({ region: "auto", endpoint: cfg.endpoint, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } });
  await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: objectKey, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type, CacheControl: "public, max-age=31536000, immutable" }));
  return { objectKey, publicUrl: `${cfg.publicUrl}/${objectKey}`, mimeType: file.type, sizeBytes: file.size };
}
