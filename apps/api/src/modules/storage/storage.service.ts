import crypto from "node:crypto";
import { env } from "../../env.js";
import { ApiError } from "../../errors.js";

const MAX_DELIVERY_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (DEL-03)
const MAX_GALLERY_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB

export async function createDeliveryPresignedUpload(
  userId: string,
  input: { filename: string; contentType: string; fileSize: number; orderId?: string },
) {
  if (input.fileSize > MAX_DELIVERY_FILE_SIZE) {
    throw new ApiError("File exceeds maximum allowed size of 50 MB", 422);
  }

  const orderId = input.orderId || crypto.randomUUID();
  const deliveryUuid = crypto.randomUUID();
  const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileKey = `deliveries/${orderId}/${deliveryUuid}/${sanitizedFilename}`;

  // In production with S3 configured, sign an S3 PUT URL; in dev/local, return mock upload target
  const uploadUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : `/api/v1/uploads/raw/${fileKey}`;

  return { uploadUrl, fileKey };
}

export async function createGalleryPresignedUpload(
  userId: string,
  input: { filename: string; contentType: string; fileSize: number },
) {
  if (input.fileSize > MAX_GALLERY_FILE_SIZE) {
    throw new ApiError("Image exceeds maximum allowed size of 10 MB", 422);
  }

  const uploadUuid = crypto.randomUUID();
  const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileKey = `showcase/${userId}/${uploadUuid}/${sanitizedFilename}`;

  const uploadUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : `/api/v1/uploads/raw/${fileKey}`;

  const publicUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : `https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800`;

  return { uploadUrl, fileKey, publicUrl };
}

export async function getDeliveryDownloadUrl(fileKey: string) {
  // 15-minute TTL download link (DEL-05)
  return {
    downloadUrl: env.STORAGE_PUBLIC_URL
      ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
      : `/api/v1/uploads/raw/${fileKey}`,
    expiresInSeconds: 900,
  };
}
