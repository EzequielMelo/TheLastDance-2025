import { EventEmitter } from "events";

// Crear una instancia global del EventEmitter
export const authEventEmitter = new EventEmitter();

// Tipos de eventos
export const AUTH_EVENTS = {
  SESSION_EXPIRED: "SESSION_EXPIRED",
  TOKEN_REFRESHED: "TOKEN_REFRESHED",
} as const;

// Función helper para emitir evento de sesión expirada
export const emitSessionExpired = () => {
  console.log("🚨 Emitiendo evento SESSION_EXPIRED");
  authEventEmitter.emit(AUTH_EVENTS.SESSION_EXPIRED);
};

// Función helper para emitir evento de token renovado
export const emitTokenRefreshed = (newToken: string) => {
  console.log("✅ Emitiendo evento TOKEN_REFRESHED");
  authEventEmitter.emit(AUTH_EVENTS.TOKEN_REFRESHED, newToken);
};
