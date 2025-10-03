import { uploadFile } from "./uploadService";
import { STORAGE_BUCKETS } from "./storageConfig";

type MulterFile = Express.Multer.File;

export async function uploadAvatar(
  userId: string,
  file: MulterFile,
): Promise<string> {
  return uploadFile(file, {
    bucket: STORAGE_BUCKETS.PROFILE_IMAGES,
    prefix: "avatars",
    userId,
  });
}
