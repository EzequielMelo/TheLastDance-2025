import { supabase, supabaseAdmin } from "../config/supabase";
import { translateSupabaseError } from "../utils/supabaseErrorTranslator";
import { CreateUserBody, LoginResult } from "./auth.types";

export async function registerUser(
  body: CreateUserBody,
  file?: Express.Multer.File,
) {
  const {
    email,
    password,
    name,
    last_name,
    age,
    gender_id,
    location,
    phone_number,
  } = body;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    throw new Error(
      translateSupabaseError(authError?.message || "Error al registrar"),
    );
  }

  const userId = authData.user.id;
  let avatarUrl: string | null = null;

  if (file) {
    avatarUrl = await uploadAvatar(userId, file);
  }

  const { error: dbError } = await supabaseAdmin.from("users").insert({
    user_id: userId,
    name,
    last_name,
    age,
    gender_id,
    location,
    photo_url: avatarUrl,
    phone_number,
  });

  if (dbError) {
    throw new Error(
      "Usuario creado en Auth, pero falló al crear el perfil: " +
        dbError.message,
    );
  }

  return {
    message: "Usuario creado exitosamente.",
    user: authData.user,
    avatar: avatarUrl,
  };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(
      translateSupabaseError(error?.message || "Error al iniciar sesión"),
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", data.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Perfil no encontrado.");
  }

  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id: data.user.id,
      email: data.user.email ?? "",
      name: profile.name ?? "",
      last_name: profile.last_name ?? "",
      photo_url: profile.photo_url ?? "",
      phone_number: profile.phone_number ?? "",
    },
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
  const fileName = `avatar.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("avatars")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);
  return data.publicUrl ?? null;
}
