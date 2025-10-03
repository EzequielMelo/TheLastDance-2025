import { supabase, supabaseAdmin } from "../config/supabase";
import { CreateUserBody, LoginResult, AuthUser } from "./auth.types";
import { sendPendingEmail } from "../lib/emails";
import { uploadAvatar as uploadAvatarService } from "../lib/storage/avatarUpload";

export async function registerUser(
  body: CreateUserBody,
  file?: Express.Multer.File,
) {
  console.log("paso", body);

  const { profile_code } = body;

  let userId: string | null = null;
  let email: string | undefined;
  let avatarUrl: string | null = null;

  // Auth: todo menos cliente_anonimo se crea en Supabase Auth
  if (profile_code !== "cliente_anonimo") {
    const { email: userEmail, password } = body as Extract<
      CreateUserBody,
      { email: string; password: string }
    >;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userEmail,
      password,
    });

    if (authError || !authData.user) {
      throw new Error("Error al crear usuario en Auth");
    }

    userId = authData.user.id;
    email = userEmail;
  } else {
    // anónimo => uuid local
    userId = crypto.randomUUID();
  }

  // Foto de perfil opcional
  if (file) {
    avatarUrl = await uploadAvatarService(userId!, file);
  }

  // ---------- Estado inicial ----------
  // cliente_registrado => 'pendiente'
  // Resto              => 'aprobado'
  const initialState: "pendiente" | "aprobado" =
    profile_code === "cliente_registrado" ? "pendiente" : "aprobado";

  // ---------- INSERT en users ----------
  const insertPayload: any = {
    id: userId,
    first_name: body.first_name,
    last_name: body.last_name,
    profile_code: body.profile_code,
    profile_image: avatarUrl,
    state: initialState,
  };

  if (profile_code === "empleado") {
    insertPayload.position_code = (body as any).position_code;
    insertPayload.dni = (body as any).dni;
    insertPayload.cuil = (body as any).cuil;
  } else if (profile_code === "supervisor" || profile_code === "dueno") {
    insertPayload.dni = (body as any).dni;
    insertPayload.cuil = (body as any).cuil;
  } else if (profile_code === "cliente_registrado" && email) {
    sendPendingEmail(email, body.first_name).catch(err =>
      console.error("No se pudo enviar tplPending:", err?.message || err),
    );
    // dni/cuil vienen en el DTO de cliente
    insertPayload.dni = (body as any).dni;
    insertPayload.cuil = (body as any).cuil;
  }
  // cliente_anonimo: sin dni/cuil/position_code

  const { error: dbError } = await supabaseAdmin
    .from("users")
    .insert(insertPayload);
  if (dbError) {
    throw new Error("Error al crear perfil en DB: " + dbError.message);
  }

  return {
    message: "Usuario creado exitosamente.",
    user: {
      id: userId,
      email,
      first_name: body.first_name,
      last_name: body.last_name,
      profile_code: body.profile_code,
      position_code:
        profile_code === "empleado" ? (body as any).position_code : undefined,
      photo_url: avatarUrl,
    },
  };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResult> {
  // 1) Login en Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Error Supabase Auth: ${error.message}`);
  }
  if (!data.session || !data.user) {
    throw new Error("No se generó sesión de usuario.");
  }

  // 2) Perfil en users
  const { data: profiles, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id);

  if (profileError) {
    throw new Error(`Error buscando perfil: ${profileError.message}`);
  }
  if (!profiles || profiles.length === 0) {
    throw new Error(`Perfil no encontrado para id=${data.user.id}`);
  }

  const profile = profiles[0];

  // ✅ Bloqueo por estado (solo cliente_registrado)
  if (
    profile.profile_code === "cliente_registrado" &&
    profile.state !== "aprobado"
  ) {
    if (profile.state === "pendiente") {
      throw new Error("Tu registro está pendiente de aprobación.");
    } else {
      throw new Error("Tu registro fue rechazado.");
    }
  }

  // 3) AuthUser
  const authUser: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    first_name: profile.first_name,
    last_name: profile.last_name,
    profile_code: profile.profile_code,
    position_code: profile.position_code ?? null,
    photo_url: profile.profile_image ?? null,
  };

  // 4) Resultado
  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
    },
    user: authUser,
  };
}

export async function registerAnonymousUser(
  body: { first_name: string; last_name: string },
  file?: Express.Multer.File,
) {
  // Generar UUID para usuario anónimo
  const userId = crypto.randomUUID();
  let avatarUrl: string | null = null;

  // Subir foto si se proporciona
  if (file) {
    avatarUrl = await uploadAvatarService(userId, file);
  }

  // Insertar directamente en la tabla users
  const insertPayload = {
    id: userId,
    first_name: body.first_name,
    last_name: body.last_name,
    profile_code: "cliente_anonimo",
    profile_image: avatarUrl,
    state: "aprobado", // Los usuarios anónimos se aprueban automáticamente
  };

  const { error: dbError } = await supabaseAdmin
    .from("users")
    .insert(insertPayload);

  if (dbError) {
    throw new Error("Error al crear perfil anónimo: " + dbError.message);
  }

  // Generar un token personalizado para el usuario anónimo
  // Como no usa Supabase Auth, generamos un token simple
  const token = `anon_${userId}_${Date.now()}`;

  return {
    message: "Usuario anónimo creado exitosamente.",
    token,
    user: {
      id: userId,
      email: null,
      first_name: body.first_name,
      last_name: body.last_name,
      profile_code: "cliente_anonimo",
      position_code: null,
      photo_url: avatarUrl,
    },
  };
}

export async function verifyToken(accessToken: string) {
  // Verificar si es un token anónimo
  if (accessToken.startsWith("anon_")) {
    const parts = accessToken.split("_");
    if (parts.length >= 3) {
      const userId = parts[1];
      
      // Verificar que el usuario existe en la tabla
      const { data: profile, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .eq("profile_code", "cliente_anonimo")
        .single();

      if (error || !profile) {
        throw new Error("Usuario anónimo no encontrado.");
      }

      return {
        id: userId,
        email: null,
      };
    }
    throw new Error("Token anónimo inválido.");
  }

  // Token normal de Supabase Auth
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw new Error("Token inválido o expirado.");
  }

  return data.user;
}
