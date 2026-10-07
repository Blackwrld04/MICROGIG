import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../env.js";
import { ApiError, notFound, forbidden, conflict, unprocessable } from "../../errors.js";
import { db } from "../../db/connection.js";
import { orders } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import type { AuthUser } from "../../types/auth.js";
import { EXPECTED_TYPE, deliveryKindFor, detectFileType, listZipEntries, sha256Hex } from "../../lib/file-inspect.js";

const MAX_DELIVERY_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (DEL-03)
const MAX_GALLERY_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DELIVERY_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export const ALLOWED_GALLERY_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const s3Client = (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && (env.S3_PRIVATE_BUCKET_NAME || env.S3_PUBLIC_BUCKET_NAME))
  ? new S3Client({
      region: env.S3_REGION || "auto",
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      // Without these, the SDK signs a CRC32 of an *empty* body into presigned PUT URLs and
      // S3/R2 reject the real upload with BadDigest.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    })
  : null;

export async function createDeliveryPresignedUpload(
  userId: string,
  input: { filename: string; contentType: string; fileSize: number; orderId: string },
) {
  if (!s3Client || !env.S3_PRIVATE_BUCKET_NAME) {
    throw new ApiError("File storage not configured", 503);
  }

  if (!input.orderId) {
    throw unprocessable("orderId is required");
  }

  if (!ALLOWED_DELIVERY_MIME_TYPES.has(input.contentType)) {
    throw unprocessable(
      `File type ${input.contentType} is not permitted. Allowed: ZIP, PNG, JPG, WEBP, PDF, DOCX, TXT`,
    );
  }

  if (input.fileSize <= 0 || input.fileSize > MAX_DELIVERY_FILE_SIZE) {
    throw unprocessable(`File exceeds maximum allowed size of 50 MB`);
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.sellerId !== userId) {
    throw forbidden("Only the assigned freelancer can upload deliverables.");
  }
  if (!["IN_PROGRESS", "IN_REVISION"].includes(order.status)) {
    throw conflict("Cannot upload deliverable when order is not in progress or in revision.");
  }

  const deliveryUuid = crypto.randomUUID();
  const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileKey = `deliveries/${input.orderId}/${deliveryUuid}/${sanitizedFilename}`;

  const cmd = new PutObjectCommand({
    Bucket: env.S3_PRIVATE_BUCKET_NAME,
    Key: fileKey,
    ContentType: input.contentType,
    ContentLength: input.fileSize,
  });
  const uploadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });

  return { uploadUrl, fileKey };
}

export async function createGalleryPresignedUpload(
  userId: string,
  input: { filename: string; contentType: string; fileSize: number },
) {
  if (!s3Client || !env.S3_PUBLIC_BUCKET_NAME) {
    throw new ApiError("File storage not configured", 503);
  }

  if (!ALLOWED_GALLERY_MIME_TYPES.has(input.contentType)) {
    throw unprocessable(
      `Image type ${input.contentType} is not permitted. Allowed: JPEG, PNG, WEBP, GIF`,
    );
  }

  if (input.fileSize <= 0 || input.fileSize > MAX_GALLERY_FILE_SIZE) {
    throw unprocessable("Image exceeds maximum allowed size of 10 MB");
  }

  const uploadUuid = crypto.randomUUID();
  const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileKey = `showcase/${userId}/${uploadUuid}/${sanitizedFilename}`;

  const cmd = new PutObjectCommand({
    Bucket: env.S3_PUBLIC_BUCKET_NAME,
    Key: fileKey,
    ContentType: input.contentType,
    ContentLength: input.fileSize,
  });
  const uploadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });

  const publicUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT}/${env.S3_PUBLIC_BUCKET_NAME}/${fileKey}`
      : `https://${env.S3_PUBLIC_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`;

  return { uploadUrl, fileKey, publicUrl };
}

export async function getDeliveryDownloadUrl(fileKey: string, fileName?: string) {
  if (!s3Client || !env.S3_PRIVATE_BUCKET_NAME) {
    throw new ApiError("File storage not configured", 503);
  }

  const cmd = new GetObjectCommand({
    Bucket: env.S3_PRIVATE_BUCKET_NAME,
    Key: fileKey,
    // Always download, never render inline on the storage origin.
    ResponseContentDisposition: `attachment; filename="${(fileName ?? fileKey.split("/").pop() ?? "download").replace(/[^\w.\- ]/g, "_")}"`,
  });
  const downloadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });

  return {
    downloadUrl,
    expiresInSeconds: 900,
  };
}

/**
 * Who may fetch a delivery's files (DEL-07): the seller and admins always; the buyer only
 * once the order is COMPLETED. Before that the buyer gets metadata and, for images, the
 * watermarked preview.
 */
export function canDownloadDelivery(user: Pick<AuthUser, "id" | "isAdmin">, order: { buyerId: string; sellerId: string; status: string }) {
  if (user.isAdmin || order.sellerId === user.id) return true;
  return order.buyerId === user.id && order.status === "COMPLETED";
}

export function storageConfigured() {
  return Boolean(s3Client && env.S3_PRIVATE_BUCKET_NAME);
}

export interface InspectedDelivery {
  size: number;
  sha256: string;
  contentType: string;
  kind: "image" | "archive" | "document";
  fileTree: string[] | null;
  body: Buffer;
}

/**
 * Downloads an uploaded deliverable and checks it on the server (DEL-03/07): it must exist,
 * be within 50 MB, have an allowed type whose magic bytes match, and its size and SHA-256 are
 * computed here rather than trusted from the client. ZIPs get a sanitised file tree.
 */
export async function inspectDeliveryObject(fileKey: string): Promise<InspectedDelivery> {
  if (!s3Client || !env.S3_PRIVATE_BUCKET_NAME) {
    throw new ApiError("File storage not configured", 503);
  }

  let head;
  try {
    head = await s3Client.send(new HeadObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET_NAME, Key: fileKey }));
  } catch {
    throw unprocessable("The uploaded file wasn't found in storage. Please upload it again.");
  }

  const size = Number(head.ContentLength ?? 0);
  if (size <= 0) throw unprocessable("The uploaded file is empty.");
  if (size > MAX_DELIVERY_FILE_SIZE) throw unprocessable("File exceeds maximum allowed size of 50 MB");

  const contentType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase();
  const expected = EXPECTED_TYPE[contentType];
  if (!ALLOWED_DELIVERY_MIME_TYPES.has(contentType) || !expected) {
    throw unprocessable("This file type isn't allowed. Use ZIP, PNG, JPG, WEBP, PDF, DOCX or TXT.");
  }

  const object = await s3Client.send(new GetObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET_NAME, Key: fileKey }));
  const bytes = await object.Body?.transformToByteArray();
  if (!bytes) throw unprocessable("The uploaded file couldn't be read.");
  const body = Buffer.from(bytes);

  if (detectFileType(body) !== expected) {
    throw unprocessable("The file's contents don't match its type. Please upload the original file.");
  }

  const kind = deliveryKindFor(contentType);
  const fileTree = kind === "archive" ? listZipEntries(body) : null;
  if (kind === "archive" && !fileTree) throw unprocessable("This ZIP file appears to be damaged.");

  return { size: body.length, sha256: sha256Hex(body), contentType, kind, fileTree, body };
}

/**
 * DEL-06: a watermarked WEBP of an image deliverable, stored privately next to it. The buyer
 * sees this before the order is completed; the original stays locked.
 */
export async function createWatermarkedPreview(fileKey: string, image: Buffer, orderNumber: number) {
  if (!s3Client || !env.S3_PRIVATE_BUCKET_NAME) return null;
  const { default: sharp } = await import("sharp");

  const base = sharp(image, { limitInputPixels: 50_000_000 }).rotate().resize(1200, 900, { fit: "inside", withoutEnlargement: true });
  const { width = 1200, height = 900 } = await base.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const label = `MICRO-GIG PREVIEW #${orderNumber} • UNACCEPTED DELIVERABLE`;
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 18));
  const rows = Array.from({ length: 7 }, (_, i) => {
    const y = Math.round(((i + 0.5) / 7) * height);
    return `<text x="${width / 2}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="rgba(255,255,255,0.45)" stroke="rgba(0,0,0,0.35)" stroke-width="1" text-anchor="middle" transform="rotate(-30 ${width / 2} ${y})">${label}</text>`;
  }).join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;

  const preview = await base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).webp({ quality: 75 }).toBuffer();
  const previewKey = fileKey.replace(/^deliveries\//, "previews/") + ".preview.webp";
  await s3Client.send(
    new PutObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET_NAME, Key: previewKey, Body: preview, ContentType: "image/webp" }),
  );
  return previewKey;
}

export async function getPrivateObject(key: string) {
  if (!s3Client || !env.S3_PRIVATE_BUCKET_NAME) throw new ApiError("File storage not configured", 503);
  const object = await s3Client.send(new GetObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET_NAME, Key: key }));
  const bytes = await object.Body?.transformToByteArray();
  if (!bytes) throw notFound("Preview not found");
  return { body: Buffer.from(bytes), contentType: object.ContentType ?? "application/octet-stream" };
}
