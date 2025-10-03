import { supabaseAdmin } from "../config/supabase";
import { randomUUID } from "crypto";

type MulterFile = Express.Multer.File;

export async function uploadAvatar(
  userId: string,
  file: MulterFile,
  opts?: { bucket?: string; prefix?: string },
): Promise<string | null> {
  const bucket = opts?.bucket ?? "profile-images";
  const prefix = opts?.prefix ?? "avatars";

  const ext = (file.mimetype?.split("/")?.[1] || "jpg").toLowerCase();
  const path = `${userId}/${prefix}_${randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
  if (error) throw new Error("No se pudo subir avatar: " + error.message);

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl ?? null;
}
