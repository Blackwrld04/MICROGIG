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

export async function getDeliveryDownloadUrl(fileKey: string) {
  if (!s3Client || !env.S3_PRIVATE_BUCKET_NAME) {
    throw new ApiError("File storage not configured", 503);
  }

  const cmd = new GetObjectCommand({
    Bucket: env.S3_PRIVATE_BUCKET_NAME,
    Key: fileKey,
  });
  const downloadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });

  return {
    downloadUrl,
    expiresInSeconds: 900,
  };
}

export async function verifyObjectExists(fileKey: string): Promise<boolean> {
  if (!s3Client || !env.S3_PRIVATE_BUCKET_NAME) {
    return true;
  }
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: env.S3_PRIVATE_BUCKET_NAME,
        Key: fileKey,
      }),
    );
    return true;
  } catch (err) {
    return false;
  }
}
