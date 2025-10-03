import { supabaseAdmin } from "../../config/supabase";
import { randomUUID } from "crypto";
import { getFileExtension } from "./storageConfig";

type MulterFile = Express.Multer.File;

export interface UploadOptions {
  bucket: string;
  prefix: string;
  userId?: string;
  filename?: string;
}

export async function uploadFile(
  file: MulterFile,
  options: UploadOptions,
): Promise<string> {
  const { bucket, prefix, userId, filename } = options;

  const ext = getFileExtension(file.mimetype);
  const uniqueId = randomUUID();

  // Construir el path del archivo
  let path: string;
  if (userId) {
    path = `${userId}/${prefix}_${filename || uniqueId}.${ext}`;
  } else {
    path = `${prefix}/${filename || uniqueId}.${ext}`;
  }

  // Subir archivo
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    throw new Error(`Error subiendo archivo: ${error.message}`);
  }

  // Obtener URL pública
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

  if (!data.publicUrl) {
    throw new Error("No se pudo obtener la URL pública del archivo");
  }

  return data.publicUrl;
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`Error eliminando archivo: ${error.message}`);
  }
}

// Función para extraer el path de una URL pública
export function extractPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    // Remover los primeros elementos que son parte de la estructura de Supabase
    const relevantParts = pathParts.slice(-2); // Tomar los últimos 2 elementos
    return relevantParts.join("/");
  } catch {
    return null;
  }
}
