import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import { useAuth } from "../../auth/AuthContext";
import QRCode from "react-native-qrcode-svg";

const { width } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GenerateWaitingListQRScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [qrData, setQrData] = useState<string>("");
  const [isActive, setIsActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // Verificar permisos
  const canGenerate =
    user?.position_code === "maitre" ||
    user?.profile_code === "dueno" ||
    user?.profile_code === "supervisor";

  // Función para obtener tiempo restante (sin expiración)
  const getTimeLeft = () => {
    if (!expiresAt) return "Sin expiración";

    const now = new Date().getTime();
    const expiry = expiresAt.getTime();
    const difference = expiry - now;

    if (difference <= 0) {
      return "00:00";
    }

    const minutes = Math.floor(difference / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const generateQR = () => {
    try {
      if (!canGenerate) {
        Alert.alert(
          "Sin permisos",
          "Solo el maitre, dueño o supervisor pueden generar códigos QR",
        );
        return;
      }

      // ✅ Datos estructurados para el QR
      const qrPayload = {
        action: "join_waiting_list",
        restaurant_id: "thelastdance_main",
        generated_by: user?.id,
        generated_at: Date.now(),
        version: "1.0",
      };

      // ✅ Crear deeplink navegable (sin expiración)
      const encodedData = btoa(JSON.stringify(qrPayload));
      const deeplink = `thelastdance://join-waiting-list?data=${encodedData}`;

      setQrData(deeplink);
      setExpiresAt(null); // Sin expiración
      setIsActive(true);
    } catch (error) {
      console.error(
        "GenerateWaitingListQRScreen - Error en generateQR:",
        error,
      );
      Alert.alert("Error", "No se pudo generar el código QR");
    }
  };

  const shareQR = async () => {
    try {
      await Share.share({
        message: `¡Únete a nuestra lista de espera!\n\nEscanea este código QR o usa este enlace:\n${qrData}\n\n🍽️ The Last Dance Restaurant`,
        title: "Lista de Espera - The Last Dance",
      });
    } catch (error) {
      console.error("Error sharing QR:", error);
    }
  };

  const deactivateQR = () => {
    Alert.alert(
      "Desactivar QR",
      "¿Estás seguro de que quieres desactivar el código QR?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desactivar",
          style: "destructive",
          onPress: () => {
            setIsActive(false);
            setQrData("");
            setExpiresAt(null);
          },
        },
      ],
    );
  };

  const regenerateQR = () => {
    generateQR();
  };

  return (
    <LinearGradient
      colors={["#1a1a2e", "#16213e", "#0f3460"]}
      style={{ flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <Text style={{ color: "#d4af37", fontSize: 30, marginRight: 12 }}>
            🔲
          </Text>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "bold" }}>
            QR Lista de Espera
          </Text>
        </View>

        {isActive ? (
          <>
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <QRCode
                value={qrData}
                size={width * 0.6}
                backgroundColor="white"
                color="black"
              />
            </View>

            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{ color: "#22c55e", fontSize: 18, marginRight: 8 }}
                >
                  🟢
                </Text>
                <Text
                  style={{ color: "white", fontSize: 18, fontWeight: "600" }}
                >
                  QR Activo
                </Text>
              </View>

              <Text
                style={{ color: "#d4af37", fontSize: 16, fontWeight: "500" }}
              >
                Expira en: {getTimeLeft()}
              </Text>

              <Text
                style={{ color: "#9ca3af", textAlign: "center", marginTop: 8 }}
              >
                Los clientes pueden escanear este código para unirse a la lista
                de espera
              </Text>
            </View>

            <View style={{ width: "100%", gap: 12 }}>
              <TouchableOpacity
                onPress={shareQR}
                style={{
                  backgroundColor: "#2563eb",
                  borderRadius: 12,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontSize: 18, marginRight: 8 }}>
                  📤
                </Text>
                <Text style={{ color: "white", fontWeight: "600" }}>
                  Compartir
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={deactivateQR}
                style={{
                  backgroundColor: "#dc2626",
                  borderRadius: 12,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontSize: 18, marginRight: 8 }}>
                  🛑
                </Text>
                <Text style={{ color: "white", fontWeight: "600" }}>
                  Desactivar
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={regenerateQR}
              style={{
                backgroundColor: "#d4af37",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <Text style={{ color: "black", fontSize: 18, marginRight: 8 }}>
                🔄
              </Text>
              <Text style={{ color: "black", fontWeight: "600" }}>
                Regenerar QR
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: 50,
                  padding: 24,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#d4af37", fontSize: 60 }}>🔲</Text>
              </View>

              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  textAlign: "center",
                  fontWeight: "500",
                  marginBottom: 8,
                }}
              >
                Genera un código QR para que los clientes
              </Text>
              <Text style={{ color: "#9ca3af", textAlign: "center" }}>
                puedan unirse a la lista de espera
              </Text>
            </View>

            <TouchableOpacity
              onPress={generateQR}
              style={{
                backgroundColor: "#d4af37",
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 32,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "black", fontSize: 20, marginRight: 8 }}>
                ✨
              </Text>
              <Text style={{ color: "black", fontWeight: "600", fontSize: 18 }}>
                Generar Código QR
              </Text>
            </TouchableOpacity>

            <Text
              style={{
                color: "#9ca3af",
                textAlign: "center",
                marginTop: 16,
                fontSize: 14,
              }}
            >
              El código QR estará activo hasta que lo desactives manualmente
            </Text>
          </>
        )}
      </View>
    </LinearGradient>
  );
}
