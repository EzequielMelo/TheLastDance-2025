// Simple EventEmitter implementation for React Native
class SimpleEventEmitter {
  private listeners: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(...args));
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

// Crear una instancia global del EventEmitter
export const authEventEmitter = new SimpleEventEmitter();

// Tipos de eventos
export const AUTH_EVENTS = {
  SESSION_EXPIRED: "SESSION_EXPIRED",
  TOKEN_REFRESHED: "TOKEN_REFRESHED",
} as const;

// Función helper para emitir evento de sesión expirada
export const emitSessionExpired = () => {
  authEventEmitter.emit(AUTH_EVENTS.SESSION_EXPIRED);
};

// Función helper para emitir evento de token renovado
export const emitTokenRefreshed = (newToken: string) => {
  console.log("✅ Emitiendo evento TOKEN_REFRESHED");
  authEventEmitter.emit(AUTH_EVENTS.TOKEN_REFRESHED, newToken);
};
