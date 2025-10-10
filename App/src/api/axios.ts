import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./config";
import { emitSessionExpired, emitTokenRefreshed } from "../utils/eventEmitter";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  async config => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn("Error obteniendo token:", error);
    }

    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  error => Promise.reject(error),
);

// Variable para evitar múltiples intentos de refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Si es un 401 y no hemos intentado renovar todavía
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Si ya estamos renovando, agregar la petición a la cola
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Obtener refresh token
        const refreshToken = await SecureStore.getItemAsync("refreshToken");
        const currentToken = await SecureStore.getItemAsync("authToken");

        // Si es token anónimo, no intentar renovar
        if (currentToken?.startsWith("anon_")) {
          console.log("👤 Token anónimo no requiere renovación");
          processQueue(error, null);
          return Promise.reject(error);
        }

        if (!refreshToken) {
          console.log("❌ No hay refresh token - logout necesario");
          processQueue(error, null);
          return Promise.reject(error);
        }

        // Intentar renovar token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } = response.data;

        // Guardar nuevos tokens
        await SecureStore.setItemAsync("authToken", access_token);
        if (newRefreshToken) {
          await SecureStore.setItemAsync("refreshToken", newRefreshToken);
        }

        // Actualizar header de la petición original
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        // Procesar cola de peticiones pendientes
        processQueue(null, access_token);

        console.log("✅ Token renovado automáticamente");

        // Emitir evento de token renovado
        emitTokenRefreshed(access_token);

        // Reintentar petición original
        return api(originalRequest);
      } catch (refreshError) {
        console.error("❌ Error renovando token:", refreshError);

        // Limpiar tokens inválidos
        await SecureStore.deleteItemAsync("authToken");
        await SecureStore.deleteItemAsync("refreshToken");

        // Emitir evento de sesión expirada para forzar logout
        emitSessionExpired();

        processQueue(refreshError, null);

        // Rechazar con un error específico para que la app pueda manejar el logout
        const logoutError = new Error("SESSION_EXPIRED");
        return Promise.reject(logoutError);
      } finally {
        isRefreshing = false;
      }
    }

    // Solo mostrar errores en desarrollo si son críticos
    if (__DEV__ && error.response?.status >= 500) {
      console.error(
        `Server Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`,
      );
    }
    return Promise.reject(error);
  },
);

export const setAuthToken = async (token: string) => {
  try {
    await SecureStore.setItemAsync("authToken", token);
  } catch (error) {
    console.error("Error guardando token:", error);
  }
};

export const clearAuthToken = async () => {
  try {
    await SecureStore.deleteItemAsync("authToken");
  } catch (error) {
    console.error("Error limpiando token:", error);
  }
};

export default api;
