export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: "profile-images",
  TABLE_IMAGES: "table-images",
  QR_CODES: "qr-codes",
} as const;

export const STORAGE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ] as string[],
} as const;

export const getFileExtension = (mimetype: string): string => {
  return mimetype.split("/")[1]?.toLowerCase() || "jpg";
};
