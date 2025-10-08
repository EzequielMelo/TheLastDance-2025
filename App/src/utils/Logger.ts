/**
 * Utilidades para logging que respetan el ambiente de desarrollo/producción
 */

export const Logger = {
  /**
   * Log de error que solo aparece en desarrollo
   */
  error: (message: string, error?: any) => {
    if (__DEV__) {
      console.error(message, error);
    }
  },

  /**
   * Log de información que solo aparece en desarrollo
   */
  info: (message: string, data?: any) => {
    if (__DEV__) {
      console.log(message, data);
    }
  },

  /**
   * Log de advertencia que solo aparece en desarrollo
   */
  warn: (message: string, data?: any) => {
    if (__DEV__) {
      console.warn(message, data);
    }
  },

  /**
   * Log de debug que solo aparece en desarrollo
   */
  debug: (message: string, data?: any) => {
    if (__DEV__) {
      console.log(`🔍 DEBUG: ${message}`, data);
    }
  },
};
