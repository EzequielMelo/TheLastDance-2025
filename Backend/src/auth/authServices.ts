import { supabase, supabaseAdmin } from "../config/supabase";
import { CreateUserBody, LoginResult, AuthUser } from "./auth.types";


const PROFILE_MAP: Record<string, string> = {
  "dueño": "dueno",
  "dueno": "dueno",
  "supervisor": "supervisor",
  "empleado": "empleado",
  "cliente": "cliente_registrado",
  "cliente_registrado": "cliente_registrado",
  "cliente_anonimo": "cliente_anonimo",
};

const POSITION_MAP: Record<string, string> = {
  "maître": "maitre",
  "maitre": "maitre",
  "mozo": "mozo",
  "cocinero": "cocinero",
  "bartender": "bartender",
};

function normalizeBody(body: CreateUserBody) {
  const profile_code = PROFILE_MAP[body.profile_code] ?? body.profile_code;
  // si no es empleado → position_code debe ser null
  const position_code =
    profile_code === "empleado"
      ? (POSITION_MAP[(body as any).position_code] ??
         ((body as any).position_code || null))
      : null;

  return { ...body, profile_code, position_code };
}

export async function registerUser(
  body: CreateUserBody,
  file?: Express.Multer.File,
) {
  const norm = normalizeBody(body);
  const { password: _omit, ...safeLog } = norm as any;
  console.log("payload normalizado:", safeLog);

  const { profile_code } = norm;

  let userId: string | null = null;
  let email: string | undefined;
  let avatarUrl: string | null = null;

  // Supabase Auth (excepto cliente_anonimo)
  if (profile_code !== "cliente_anonimo") {
    const { email: userEmail, password } = norm as {
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
    userId = crypto.randomUUID();
  }

  if (file) {
    avatarUrl = await uploadAvatar(userId!, file);
  }

  const insertBase: any = {
    id: userId,
    first_name: norm.first_name,
    last_name: norm.last_name,
    profile_code: norm.profile_code,
    profile_image: avatarUrl,
  };

  const needsDocs =
    profile_code === "empleado" ||
    profile_code === "supervisor" ||
    profile_code === "dueno" ||
    profile_code === "cliente_registrado";

  if (needsDocs) {
    insertBase.dni = (norm as any).dni;
    insertBase.cuil = (norm as any).cuil;
  }

  if (profile_code === "empleado") {
    insertBase.position_code = (norm as any).position_code;
  } else {
    insertBase.position_code = null;
  }

  const { error: dbError } = await supabaseAdmin.from("users").insert(insertBase);

  if (dbError) {
    throw new Error("Error al crear perfil en DB: " + dbError.message);
  }

  return {
    message: "Usuario creado exitosamente.",
    user: {
      id: userId,
      email,
      first_name: norm.first_name,
      last_name: norm.last_name,
      profile_code: norm.profile_code,
      position_code: profile_code === "empleado" ? (norm as any).position_code : null,
      photo_url: avatarUrl,
    },
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

  if (error) {
    throw new Error(`Error Supabase Auth: ${error.message}`);
  }
  if (!data.session || !data.user) {
    throw new Error("No se generó sesión de usuario.");
  }

  console.log("Buscando perfil para user ID:", data.user.id);

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
  const authUser: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    first_name: profile.first_name,
    last_name: profile.last_name,
    profile_code: profile.profile_code,
    position_code: profile.position_code ?? null,
    photo_url: profile.profile_image ?? null,
  };

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
  const fileExt = (file.originalname.split(".").pop() || "jpg").toLowerCase();
  const fileName = `userPhoto.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("Profile Images")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype || `image/${fileExt}`,
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabaseAdmin.storage
    .from("Profile Images")
    .getPublicUrl(filePath);
  return data.publicUrl ?? null;
}
