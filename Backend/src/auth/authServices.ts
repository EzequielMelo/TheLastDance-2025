import { supabase, supabaseAdmin } from "../config/supabase";
import { translateSupabaseError } from "../utils/supabaseErrorTranslator";
import { CreateUserBody, LoginResult, AuthUser } from "./auth.types";

export async function registerUser(
  body: CreateUserBody,
  file?: Express.Multer.File,
) {
  const { profile_code } = body;

  let userId: string | null = null;
  let email: string | undefined;
  let avatarUrl: string | null = null;

  // Si es CLIENT, EMPLOYEE, SUPERVISOR u OWNER → usar Supabase Auth
  if (profile_code !== "cliente_anonimo") {
    const { email: userEmail, password } = body as {
      email: string;
      password: string;
    };

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
    // Si es CLIENT_ANONYMOUS → generar UUID local
    userId = crypto.randomUUID();
  }

  // Foto de perfil opcional
  if (file) {
    avatarUrl = await uploadAvatar(userId!, file);
  }

  // Insertar en tabla users
  const { error: dbError } = await supabaseAdmin.from("users").insert({
    id: userId,
    first_name: body.first_name,
    last_name: body.last_name,
    profile_code: body.profile_code,
    profile_image: avatarUrl,
    // opcionales según el tipo
    ...(profile_code === "empleado"
      ? {
          position_code: body.position_code,
          dni: body.dni,
          cuil: body.cuil,
        }
      : {}),
    ...(profile_code === "supervisor" || profile_code === "dueno"
      ? { dni: body.dni, cuil: body.cuil }
      : {}),
  });

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
        profile_code === "empleado" ? body.position_code : undefined,
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

  if (error || !data.session || !data.user) {
    throw new Error(
      translateSupabaseError(error?.message || "Error al iniciar sesión"),
    );
  }

  // 2. Buscar perfil en la tabla users
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Perfil no encontrado.");
  }

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
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
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
    .from("Profile Images")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabaseAdmin.storage
    .from("Profile Images")
    .getPublicUrl(filePath);
  return data.publicUrl ?? null;
}
