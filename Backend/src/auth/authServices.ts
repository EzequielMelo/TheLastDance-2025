import { supabase, supabaseAdmin } from "../config/supabase";
import { CreateUserBody, LoginResult, AuthUser } from "./auth.types";

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
    avatarUrl = await uploadAvatar(userId!, file);
  }

  // ---------- INSERT EN public.users ----------
  // Armamos el payload de forma explícita según el perfil
  const insertPayload: any = {
    id: userId,
    first_name: body.first_name,
    last_name: body.last_name,
    profile_code: body.profile_code,
    profile_image: avatarUrl,
  };

  if (profile_code === "empleado") {
    // empleado: SIEMPRE position_code + dni/cuil
    insertPayload.position_code = body.position_code;
    insertPayload.dni = body.dni;
    insertPayload.cuil = body.cuil;
  } else if (profile_code === "supervisor" || profile_code === "dueno") {
    // supervisor/dueno: dni/cuil
    insertPayload.dni = body.dni;
    insertPayload.cuil = body.cuil;
  } else if (profile_code === "cliente_registrado") {
    // ✅ cliente_registrado: agregar dni/cuil si vienen (en tu DTO son requeridos)
    insertPayload.dni = (body as any).dni;
    insertPayload.cuil = (body as any).cuil;
  }
  // cliente_anonimo: no agregamos dni/cuil/position_code

  const { error: dbError } = await supabaseAdmin.from("users").insert(insertPayload);
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
      position_code: profile_code === "empleado" ? (body as any).position_code : undefined,
      photo_url: avatarUrl,
    },
  };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResult> {
  // 1. Login en Supabase Auth
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

  console.log("Buscando perfil para user ID:", data.user.id);

  // 2. Buscar perfil en la tabla users
  const { data: profiles, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id);

  console.log("Perfiles encontrados:", profiles?.length);
  console.log("Datos de perfiles:", profiles);

  if (profileError) {
    throw new Error(`Error buscando perfil: ${profileError.message}`);
  }
  if (!profiles || profiles.length === 0) {
    throw new Error(`Perfil no encontrado para id=${data.user.id}`);
  }

  const profile = profiles[0];
  // 3. Construir el AuthUser en base a las interfaces nuevas
  const authUser: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    first_name: profile.first_name,
    last_name: profile.last_name,
    profile_code: profile.profile_code,
    position_code: profile.position_code ?? null,
    photo_url: profile.profile_image ?? null,
  };

  // 4. Retornar el LoginResult
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

export async function verifyToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw new Error("Token inválido o expirado.");
  }

  return data.user;
}

async function uploadAvatar(
  userId: string,
  file: Express.Multer.File,
): Promise<string | null> {
  const fileExt = file.originalname.split(".").pop();
  const fileName = `userPhoto.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("profile-images")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabaseAdmin.storage
    .from("profile-images")
    .getPublicUrl(filePath);
  return data.publicUrl ?? null;
}