import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import api from "../../api/axios";
import { API_BASE_URL } from "../../api/config";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// Necesario para cerrar correctamente el navegador después del OAuth
WebBrowser.maybeCompleteAuthSession();

interface SocialAuthResult {
  success: boolean;
  user?: any;
  needsAdditionalInfo?: boolean;
  error?: string;
}

type SocialProvider = "google";

export const useSocialAuth = () => {
  const [loading, setLoading] = useState(false);

  /**
   * Inicia sesión con un proveedor social (Google, Facebook, Apple)
   */
  const signInWithProvider = async (
    provider: SocialProvider,
  ): Promise<SocialAuthResult> => {
    try {
      setLoading(true);

      // Detectar si estamos en Expo Go
      const isExpoGo = Constants.appOwnership === "expo";

      // Configurar URL de redirección para tu app
      const appRedirectUrl = makeRedirectUri({
        scheme: isExpoGo ? undefined : "thelastdance", // undefined usa 'exp://' en Expo Go
        path: "auth/callback",
      });

      console.log("🔑 Iniciando OAuth con:", provider);
      console.log("📱 Modo:", isExpoGo ? "Expo Go" : "Standalone");
      console.log("🔗 App Redirect URL:", appRedirectUrl);

      // Paso 1: Solicitar al backend la URL de autenticación
      // El backend pasará el appRedirectUrl a Supabase para el redirect final
      const initResponse = await api.post(`${API_BASE_URL}/auth/social/init`, {
        provider,
        redirectUrl: appRedirectUrl, // Tu app recibirá el callback final
      });

      if (!initResponse.data.success || !initResponse.data.url) {
        throw new Error("No se recibió URL de autenticación del backend");
      }

      const authUrl = initResponse.data.url;
      console.log("🌐 Abriendo navegador para OAuth...");
      console.log("🔗 URL de OAuth:", authUrl);

      // Paso 2: Abrir navegador para autenticación
      // Supabase manejará el callback de Google y luego redirigirá a tu app
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        appRedirectUrl, // Tu app espera el callback aquí
      );

      console.log("📱 Resultado del navegador:", result.type);

      if (result.type === "success") {
        const url = result.url;
        console.log("🔗 URL completa recibida:", url);

        // Extraer tokens del callback URL
        const fragment = url.split("#")[1];
        const query = url.split("?")[1];

        console.log("📝 Fragment (#):", fragment);
        console.log("📝 Query (?):", query);

        const params = new URLSearchParams(fragment || query);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        console.log(
          "🔑 Access Token extraído:",
          accessToken ? "✓ Presente" : "✗ Faltante",
        );
        console.log(
          "🔑 Refresh Token extraído:",
          refreshToken ? "✓ Presente" : "✗ Faltante",
        );

        if (!accessToken || !refreshToken) {
          throw new Error("No se recibieron tokens de autenticación");
        }

        console.log("✅ Tokens recibidos, enviando al backend...");

        // Paso 3: Enviar tokens al backend para procesar
        const callbackResponse = await api.post(
          `${API_BASE_URL}/auth/social/callback`,
          {
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        );

        if (!callbackResponse.data.success) {
          throw new Error(
            callbackResponse.data.error || "Error procesando autenticación",
          );
        }

        const { user, session, needsAdditionalInfo } = callbackResponse.data;

        // Guardar tokens en SecureStore
        if (session?.access_token) {
          await SecureStore.setItemAsync("authToken", session.access_token);
          console.log("💾 Token guardado en SecureStore");
        }

        if (session?.refresh_token) {
          await SecureStore.setItemAsync("refreshToken", session.refresh_token);
        }

        console.log("✅ Autenticación completada");
        console.log("📋 Necesita información adicional:", needsAdditionalInfo);

        return {
          success: true,
          user,
          needsAdditionalInfo,
        };
      } else if (result.type === "cancel") {
        console.log("⚠️ Usuario canceló la autenticación");
        return {
          success: false,
          error: "Autenticación cancelada por el usuario",
        };
      } else if (result.type === "dismiss") {
        console.log("⚠️ Navegador cerrado sin completar");
        return {
          success: false,
          error: "Ventana de autenticación cerrada",
        };
      } else {
        console.log("❌ Tipo de resultado desconocido:", result.type);
        return {
          success: false,
          error: `Error en la autenticación: ${result.type}`,
        };
      }
    } catch (error: any) {
      console.error("❌ Error en autenticación social:", error);
      console.error("❌ Stack trace:", error.stack);
      return {
        success: false,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error desconocido en la autenticación",
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Completa el perfil del usuario con DNI, CUIL y teléfono
   */
  const completeUserProfile = async (data: {
    dni: string;
    cuil: string;
    phone?: string;
  }) => {
    try {
      setLoading(true);

      const response = await api.put(
        `${API_BASE_URL}/auth/social/complete-profile`,
        data,
      );

      if (!response.data.success) {
        throw new Error(response.data.error || "Error completando el perfil");
      }

      return {
        success: true,
        user: response.data.user,
      };
    } catch (error: any) {
      console.error("❌ Error completando perfil:", error);
      return {
        success: false,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error completando el perfil",
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    signInWithGoogle: () => signInWithProvider("google"),
    completeUserProfile,
    loading,
  };
};
