export function translateSupabaseError(message: string): string {
  if (message.includes("User already registered")) {
    return "El usuario ya está registrado.";
  }

  if (message.includes("Invalid login credentials")) {
    return "Correo electrónico o contraseña incorrectos.";
  }

  if (message.includes("Email not confirmed")) {
    return "Debes confirmar tu correo electrónico antes de iniciar sesión.";
  }

  if (message.includes("Password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  // Otros errores genéricos
  return "Ocurrió un error. Intenta de nuevo.";
}
