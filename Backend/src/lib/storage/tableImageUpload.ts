import { uploadFile, deleteFile, extractPathFromUrl } from "./uploadService";
import { STORAGE_BUCKETS } from "./storageConfig";

type MulterFile = Express.Multer.File;

export async function uploadTablePhoto(
  tableId: string,
  file: MulterFile,
): Promise<string> {
  return uploadFile(file, {
    bucket: STORAGE_BUCKETS.TABLE_IMAGES,
    prefix: "photos",
    userId: tableId,
    filename: "table_photo",
  });
}

export async function uploadTableQR(
  tableId: string,
  file: MulterFile,
): Promise<string> {
  return uploadFile(file, {
    bucket: STORAGE_BUCKETS.QR_CODES,
    prefix: "qr",
    userId: tableId,
    filename: "table_qr",
  });
}

export async function deleteTablePhoto(photoUrl: string): Promise<void> {
  const path = extractPathFromUrl(photoUrl);
  if (path) {
    await deleteFile(STORAGE_BUCKETS.TABLE_IMAGES, path);
  }
}

export async function deleteTableQR(qrUrl: string): Promise<void> {
  const path = extractPathFromUrl(qrUrl);
  if (path) {
    await deleteFile(STORAGE_BUCKETS.QR_CODES, path);
  }
}
