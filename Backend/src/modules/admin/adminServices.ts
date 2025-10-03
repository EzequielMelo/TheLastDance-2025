import { supabase, supabaseAdmin } from "../../config/supabase";
import { sendApprovedEmail, sendRejectedEmail } from "../../lib/emails";
import { uploadAvatar } from "../../lib/uploadAvatar";
import { Actor, CreateStaffBody } from "../../types/adminTypes";

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
