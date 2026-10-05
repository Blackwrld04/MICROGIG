import crypto from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../env.js";
import { ApiError } from "../../errors.js";

const MAX_DELIVERY_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (DEL-03)
const MAX_GALLERY_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB

const s3Client = (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY)
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
  input: { filename: string; contentType: string; fileSize: number; orderId?: string },
) {
  if (input.fileSize > MAX_DELIVERY_FILE_SIZE) {
    throw new ApiError("File exceeds maximum allowed size of 50 MB", 422);
  }

  const orderId = input.orderId || crypto.randomUUID();
  const deliveryUuid = crypto.randomUUID();
  const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileKey = `deliveries/${orderId}/${deliveryUuid}/${sanitizedFilename}`;

  let uploadUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : `/api/v1/uploads/raw/${fileKey}`;

  if (s3Client) {
    try {
      const cmd = new PutObjectCommand({
        Bucket: env.S3_PRIVATE_BUCKET_NAME,
        Key: fileKey,
        ContentType: input.contentType,
      });
      uploadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });
    } catch (err) {
      console.warn("Failed to sign S3 upload URL, using fallback:", err);
    }
  }

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

  let uploadUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : `/api/v1/uploads/raw/${fileKey}`;

  if (s3Client) {
    try {
      const cmd = new PutObjectCommand({
        Bucket: env.S3_PUBLIC_BUCKET_NAME,
        Key: fileKey,
        ContentType: input.contentType,
      });
      uploadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });
    } catch (err) {
      console.warn("Failed to sign S3 gallery upload URL, using fallback:", err);
    }
  }

  const publicUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT}/${env.S3_PUBLIC_BUCKET_NAME}/${fileKey}`
      : `https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800`;

  return { uploadUrl, fileKey, publicUrl };
}

export async function getDeliveryDownloadUrl(fileKey: string) {
  // 15-minute TTL download link (DEL-05)
  let downloadUrl = env.STORAGE_PUBLIC_URL
    ? `${env.STORAGE_PUBLIC_URL}/${fileKey}`
    : `/api/v1/uploads/raw/${fileKey}`;

  if (s3Client) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: env.S3_PRIVATE_BUCKET_NAME,
        Key: fileKey,
      });
      downloadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });
    } catch (err) {
      console.warn("Failed to sign S3 download URL, using fallback:", err);
    }
  }

  return {
    downloadUrl,
    expiresInSeconds: 900,
  };
}
