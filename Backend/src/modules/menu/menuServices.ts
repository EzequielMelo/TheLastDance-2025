import type {
  CreateMenuItemDTO,
  CreateMenuItemWithImagesDTO,
  MenuItem,
} from "./menu.types";
// import { supabase, supabaseAdmin } from "../../config/supabase";
import { supabaseAdmin } from "../../config/supabase";

async function createMenuItem(
  dto: CreateMenuItemDTO,
  createdBy: string
): Promise<MenuItem> {
  if (!["plato", "bebida"].includes(dto.category)) throw new Error("Categoría inválida");
  if (dto.name.trim().length < 3) throw new Error("Nombre muy corto");
  if (dto.prepMinutes < 1) throw new Error("Tiempo inválido");
  if (dto.price <= 0) throw new Error("Precio inválido");

  // Si querés bypassear RLS desde backend, usá supabaseAdmin aquí en lugar de supabase
  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .insert({
      category: dto.category,
      name: dto.name.trim(),
      description: dto.description.trim(),
      prep_minutes: dto.prepMinutes,
      price: dto.price,
      created_by: createdBy,
      is_active: false,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToMenuItem(data);
}

type UploadImage = { filename: string; contentType: string; buffer: Buffer };

async function uploadThreeImages(itemId: string, images: UploadImage[]) {
  if (images.length !== 3) throw new Error("Se requieren exactamente 3 imágenes");

  for (const [i, img] of images.entries()) {
    const pos = i + 1;
    const path = `menu-images/${itemId}/${pos}-${img.filename}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("menu-images")
      .upload(path, img.buffer, {
        contentType: img.contentType,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error } = await supabaseAdmin.from("menu_item_images").insert({
      item_id: itemId,
      position: pos,
      storage_path: path,
    });
    if (error) throw error;
  }
}

async function activateItem(itemId: string) {
  const { error } = await supabaseAdmin
    .from("menu_items")
    .update({ is_active: true })
    .eq("id", itemId);
  if (error) throw error;
}

export async function createMenuItemWithImages(
  dto: CreateMenuItemWithImagesDTO,
  createdBy: string
) {
  const item = await createMenuItem(dto, createdBy);
  await uploadThreeImages(item.id, dto.images);
  await activateItem(item.id);
  return item;
}

export async function listMenuItems(category?: "plato" | "bebida") {
  let q = supabaseAdmin // para lecturas podés usar el público
    .from("menu_items")
    .select("*, menu_item_images(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRowToMenuItem);
}

function mapRowToMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    prepMinutes: row.prep_minutes,
    price: Number(row.price),
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
