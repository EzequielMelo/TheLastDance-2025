import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import api from "../../api/axios";
import { API_BASE_URL } from "../../api/config";
import * as SecureStore from "expo-secure-store";

// Necesario para cerrar correctamente el navegador después del OAuth
WebBrowser.maybeCompleteAuthSession();

interface SocialAuthResult {
  success: boolean;
  user?: any;
  needsAdditionalInfo?: boolean;
  error?: string;
}

type SocialProvider = "facebook";

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

      // Configurar URL de redirección
      const redirectUrl = makeRedirectUri({
        scheme: "thelastdance", // Debe coincidir con el scheme en app.json
        path: "auth/callback",
      });

      console.log("🔑 Iniciando OAuth con:", provider);
      console.log("🔗 Redirect URL:", redirectUrl);

      // Paso 1: Solicitar al backend la URL de autenticación
      const initResponse = await api.post(`${API_BASE_URL}/auth/social/init`, {
        provider,
        redirectUrl,
      });

      if (!initResponse.data.success || !initResponse.data.url) {
        throw new Error("No se recibió URL de autenticación del backend");
      }

      const authUrl = initResponse.data.url;
      console.log("🌐 Abriendo navegador para OAuth...");

      // Paso 2: Abrir navegador para autenticación
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
      );

      console.log("📱 Resultado del navegador:", result.type);

      if (result.type === "success") {
        const url = result.url;

        // Extraer tokens del callback URL
        const params = new URLSearchParams(
          url.split("#")[1] || url.split("?")[1],
        );
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

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
        return {
          success: false,
          error: "Autenticación cancelada por el usuario",
        };
      } else {
        return {
          success: false,
          error: "Error en la autenticación",
        };
      }
    } catch (error: any) {
      console.error("❌ Error en autenticación social:", error);
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
    signInWithFacebook: () => signInWithProvider("facebook"),
    signInWithInstagram: () => signInWithProvider("facebook"), // Instagram usa Facebook OAuth
    completeUserProfile,
    loading,
  };
};
