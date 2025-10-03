import { supabase, supabaseAdmin } from "../../config/supabase";
import { sendApprovedEmail, sendRejectedEmail } from "../../lib/emails";
import { uploadAvatar } from "../../lib/storage/avatarUpload";
import {
  uploadTablePhoto,
  uploadTableQR,
} from "../../lib/storage/tableImageUpload";
import {
  Actor,
  CreateStaffBody,
  CreateTableBody,
  Table,
} from "../../types/adminTypes";

// Tipos para los servicios
export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  profile_code: string;
  profile_image?: string;
  state: string;
  created_at: string;
}

export interface ClientApprovalData {
  id: string;
  first_name: string;
  last_name: string;
}

// Obtener el email REAL de Supabase Auth (no lo guardamos en users)
export async function getAuthEmailById(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
  if (error || !data?.user) return null;
  return data.user.email ?? null;
}

// Obtener lista de clientes por estado
export async function getClientsByState(
  state: string = "pendiente",
): Promise<Client[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, first_name, last_name, profile_code, profile_image, state, created_at",
    )
    .eq("profile_code", "cliente_registrado")
    .eq("state", state)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error al obtener clientes: ${error.message}`);
  }

  return data ?? [];
}

// Aprobar un cliente
export async function approveClientById(
  id: string,
): Promise<ClientApprovalData> {
  // Actualizar estado a 'aprobado'
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ state: "aprobado" })
    .eq("id", id)
    .eq("profile_code", "cliente_registrado")
    .select("id, first_name, last_name")
    .single();

  if (error || !data) {
    throw new Error("Usuario no encontrado o no se pudo actualizar");
  }

  return data;
}

// Rechazar un cliente
export async function rejectClientById(
  id: string,
): Promise<ClientApprovalData> {
  // Actualizar estado a 'rechazado'
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ state: "rechazado" })
    .eq("id", id)
    .eq("profile_code", "cliente_registrado")
    .select("id, first_name, last_name")
    .single();

  if (error || !data) {
    throw new Error("Usuario no encontrado o no se pudo actualizar");
  }

  return data;
}

// Enviar email de aprobación
export async function sendClientApprovalEmail(
  id: string,
  firstName: string,
): Promise<void> {
  const email = await getAuthEmailById(id);
  if (!email) {
    throw new Error("Email no encontrado en Auth");
  }

  await sendApprovedEmail(email, firstName);
}

// Enviar email de rechazo
export async function sendClientRejectionEmail(
  id: string,
  firstName: string,
  reason: string = "",
): Promise<void> {
  const email = await getAuthEmailById(id);
  if (!email) {
    throw new Error("Email no encontrado en Auth");
  }

  await sendRejectedEmail(email, firstName, reason);
}

// Servicio completo para aprobar cliente (actualizar estado + enviar email)
export async function processClientApproval(id: string): Promise<void> {
  const clientData = await approveClientById(id);
  await sendClientApprovalEmail(id, clientData.first_name);
}

// Servicio completo para rechazar cliente (actualizar estado + enviar email)
export async function processClientRejection(
  id: string,
  reason: string = "",
): Promise<void> {
  const clientData = await rejectClientById(id);
  await sendClientRejectionEmail(id, clientData.first_name, reason);
}

export async function createStaff(
  actor: Actor,
  body: CreateStaffBody,
  file?: Express.Multer.File,
) {
  // Permisos
  if (body.profile_code === "supervisor" && actor.profile_code !== "dueno") {
    throw new Error("Solo el dueÃ±o puede crear supervisores");
  }
  if (
    body.profile_code === "empleado" &&
    !["dueno", "supervisor"].includes(actor.profile_code)
  ) {
    throw new Error("Permisos insuficientes");
  }

  // Validaciones
  const required: Array<keyof CreateStaffBody> = [
    "first_name",
    "last_name",
    "email",
    "password",
    "cuil",
    "profile_code",
  ];
  for (const k of required) {
    if (!body[k]) throw new Error(`Campo obligatorio: ${k}`);
  }
  if (body.profile_code === "empleado" && !body.position_code) {
    throw new Error("position_code es obligatorio para empleados");
  }
  if (!file) throw new Error("Foto obligatoria");

  // Crear en Auth con email confirmado
  const { data: authData, error: authErr } =
    await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });
  if (authErr || !authData?.user) {
    throw new Error(
      `No se pudo crear el usuario en Auth: ${authErr?.message || "desconocido"}`,
    );
  }
  const userId = authData.user.id;

  try {
    // Subir avatar
    const profile_image = await uploadAvatar(userId, file);

    // Insert en 'users' aprobado
    const row: any = {
      id: userId,
      first_name: body.first_name,
      last_name: body.last_name,
      profile_code: body.profile_code, // 'empleado' | 'supervisor'
      state: "aprobado",
      profile_image,
      dni: body.dni ?? null,
      cuil: body.cuil,
    };
    if (body.profile_code === "empleado") {
      row.position_code = body.position_code!;
    }

    const { error: dbErr } = await supabaseAdmin.from("users").insert(row);
    if (dbErr) throw new Error("Error al guardar perfil: " + dbErr.message);

    return {
      message: "Staff creado correctamente.",
      user: {
        id: userId,
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        profile_code: body.profile_code,
        position_code: row.position_code ?? null,
        photo_url: profile_image,
      },
    };
  } catch (e) {
    // rollback best-effort
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw e;
  }
}

// ========== SERVICIOS PARA MESAS ==========

// Función helper para subir imágenes de mesa
async function uploadTableImage(
  tableId: string,
  file: Express.Multer.File,
  type: "photo" | "qr",
): Promise<string> {
  try {
    if (type === "photo") {
      return await uploadTablePhoto(tableId, file);
    } else {
      return await uploadTableQR(tableId, file);
    }
  } catch (error) {
    throw new Error(
      `Error subiendo ${type}: ${error instanceof Error ? error.message : "Error desconocido"}`,
    );
  }
}

// Obtener todas las mesas
export async function getAllTables(): Promise<Table[]> {
  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("*")
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`Error al obtener mesas: ${error.message}`);
  }

  return data ?? [];
}

// Obtener mesa por ID
export async function getTableById(id: string): Promise<Table | null> {
  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // No encontrado
    throw new Error(`Error al obtener mesa: ${error.message}`);
  }

  return data;
}

// Verificar que el número de mesa no esté en uso
export async function checkTableNumberExists(number: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("id")
    .eq("number", number)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Error verificando número de mesa: ${error.message}`);
  }

  return !!data;
}

// Crear una nueva mesa
export async function createTable(
  actor: Actor,
  body: CreateTableBody,
  photoFile: Express.Multer.File,
  qrFile: Express.Multer.File,
  createdBy: string,
): Promise<Table> {
  // Verificar permisos
  if (!["dueno", "supervisor"].includes(actor.profile_code)) {
    throw new Error("Permisos insuficientes para crear mesas");
  }

  // Validaciones
  if (!body.number || !body.capacity || !body.type) {
    throw new Error(
      "Todos los campos son obligatorios: número, capacidad y tipo",
    );
  }

  if (body.number <= 0) {
    throw new Error("El número de mesa debe ser mayor a 0");
  }

  if (body.capacity <= 0) {
    throw new Error("La capacidad debe ser mayor a 0");
  }

  if (!photoFile || !qrFile) {
    throw new Error("Se requieren ambas imágenes: foto de la mesa y código QR");
  }

  // Verificar que el número de mesa no esté en uso
  const numberExists = await checkTableNumberExists(body.number);
  if (numberExists) {
    throw new Error(`Ya existe una mesa con el número ${body.number}`);
  }

  // Crear el registro de mesa primero para obtener el ID
  const { data: tableData, error: insertError } = await supabaseAdmin
    .from("tables")
    .insert({
      number: body.number,
      capacity: body.capacity,
      type: body.type,
      created_by: createdBy,
      photo_url: "", // Temporal
      qr_url: "", // Temporal
    })
    .select()
    .single();

  if (insertError || !tableData) {
    throw new Error(`Error creando mesa: ${insertError?.message}`);
  }

  try {
    // Subir las imágenes
    const [photoUrl, qrUrl] = await Promise.all([
      uploadTableImage(tableData.id, photoFile, "photo"),
      uploadTableImage(tableData.id, qrFile, "qr"),
    ]);

    // Actualizar las URLs de las imágenes
    const { data: updatedTable, error: updateError } = await supabaseAdmin
      .from("tables")
      .update({
        photo_url: photoUrl,
        qr_url: qrUrl,
      })
      .eq("id", tableData.id)
      .select()
      .single();

    if (updateError || !updatedTable) {
      throw new Error(
        `Error actualizando URLs de imágenes: ${updateError?.message}`,
      );
    }

    return updatedTable;
  } catch (error) {
    // Si hay error subiendo imágenes, eliminar el registro de mesa
    await supabaseAdmin.from("tables").delete().eq("id", tableData.id);
    throw error;
  }
}

// Actualizar una mesa
export async function updateTable(
  actor: Actor,
  id: string,
  body: Partial<CreateTableBody>,
  photoFile?: Express.Multer.File,
  qrFile?: Express.Multer.File,
): Promise<Table> {
  // Verificar permisos
  if (!["dueno", "supervisor"].includes(actor.profile_code)) {
    throw new Error("Permisos insuficientes para actualizar mesas");
  }

  // Verificar que la mesa existe
  const existingTable = await getTableById(id);
  if (!existingTable) {
    throw new Error("Mesa no encontrada");
  }

  // Si se está actualizando el número, verificar que no esté en uso
  if (body.number && body.number !== existingTable.number) {
    const numberExists = await checkTableNumberExists(body.number);
    if (numberExists) {
      throw new Error(`Ya existe una mesa con el número ${body.number}`);
    }
  }

  // Validaciones
  if (body.number !== undefined && body.number <= 0) {
    throw new Error("El número de mesa debe ser mayor a 0");
  }

  if (body.capacity !== undefined && body.capacity <= 0) {
    throw new Error("La capacidad debe ser mayor a 0");
  }

  // Preparar datos para actualizar
  const updateData: any = {};
  if (body.number !== undefined) updateData.number = body.number;
  if (body.capacity !== undefined) updateData.capacity = body.capacity;
  if (body.type !== undefined) updateData.type = body.type;

  // Subir nuevas imágenes si se proporcionan
  if (photoFile) {
    updateData.photo_url = await uploadTableImage(id, photoFile, "photo");
  }

  if (qrFile) {
    updateData.qr_url = await uploadTableImage(id, qrFile, "qr");
  }

  // Actualizar la mesa
  const { data: updatedTable, error } = await supabaseAdmin
    .from("tables")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !updatedTable) {
    throw new Error(`Error actualizando mesa: ${error?.message}`);
  }

  return updatedTable;
}

// Eliminar una mesa
export async function deleteTable(actor: Actor, id: string): Promise<void> {
  // Verificar permisos
  if (!["dueno", "supervisor"].includes(actor.profile_code)) {
    throw new Error("Permisos insuficientes para eliminar mesas");
  }

  // Verificar que la mesa existe
  const existingTable = await getTableById(id);
  if (!existingTable) {
    throw new Error("Mesa no encontrada");
  }

  // Eliminar la mesa
  const { error } = await supabaseAdmin.from("tables").delete().eq("id", id);

  if (error) {
    throw new Error(`Error eliminando mesa: ${error.message}`);
  }

  // TODO: Opcional - eliminar imágenes del storage
  // Se podría implementar la limpieza de archivos del storage aquí
}
