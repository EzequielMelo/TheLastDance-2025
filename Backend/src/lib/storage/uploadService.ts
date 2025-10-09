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

// Función para extraer el path de una URL pública de Supabase Storage
export function extractPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    
    // Formato típico: /storage/v1/object/public/[bucket]/[path]
    // Encontrar el índice donde está el bucket
    const bucketIndex = pathParts.findIndex((part, index) => 
      part === 'public' && pathParts[index + 1] // 'public' seguido del bucket
    );
    
    if (bucketIndex !== -1 && bucketIndex + 2 < pathParts.length) {
      // Tomar todo lo que viene después del bucket
      const pathAfterBucket = pathParts.slice(bucketIndex + 2);
      return pathAfterBucket.join("/");
    }
    
    // Fallback: tomar todo después de 'public/'
    const publicIndex = pathParts.indexOf('public');
    if (publicIndex !== -1 && publicIndex + 2 < pathParts.length) {
      return pathParts.slice(publicIndex + 2).join("/");
    }
    
    return null;
  } catch (error) {
    console.error('Error extrayendo path de URL:', error);
    return null;
  }
}
