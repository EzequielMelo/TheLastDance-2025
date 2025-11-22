import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import {
  Camera,
  XCircle,
  RefreshCw,
  QrCode,
  CheckCircle,
} from "lucide-react-native";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/axios";
import CustomAlert from "../../components/common/CustomAlert";

const { width, height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ScanQRScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Estados para CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<
    "success" | "error" | "warning" | "info"
  >("info");

  // Verificar que el usuario pueda unirse a la lista
  const canJoin =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

  const showCustomAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "info",
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      // Caso 1: QR de lista de espera (waiting list)
      if (data.includes("thelastdance://join-waiting-list")) {
        // Extraer y validar datos del QR
        const url = new URL(data);
        const encodedData = url.searchParams.get("data");

        if (!encodedData) {
          throw new Error("Datos del QR no válidos");
        }

        const qrData = JSON.parse(atob(encodedData));

        // Verificar la acción
        if (qrData.action !== "join_waiting_list") {
          showCustomAlert(
            "QR Incorrecto",
            "Este código QR no es para unirse a la lista de espera.",
            "error",
          );
          setScanned(false);
          setProcessing(false);
          return;
        }

        // Navegar al formulario con los datos del QR
        try {
          navigation.navigate("JoinWaitingList", { qrData });
        } catch (navError) {
          console.error("Navigation error:", navError);
          showCustomAlert(
            "Error de navegación",
            "No se pudo navegar al formulario. Intenta de nuevo.",
            "error",
          );
          setScanned(false);
        }
        setProcessing(false);
        return;
      }
      // Caso 2: QR de mesa (table QR)
      // 🚚 Validar si es un QR de delivery payment (JSON)
      try {
        const parsedData = JSON.parse(data);
        if (parsedData.type === "delivery_payment") {
          showCustomAlert(
            "QR Incorrecto",
            "Este es un QR de pago de delivery. Úsalo desde el botón QR cuando tengas un delivery activo.",
            "warning",
          );
          setScanned(false);
          setProcessing(false);
          return;
        }
      } catch (e) {
        // No es JSON, continuar con flujo normal de mesa
      }

      let tableId: string;

      if (data.includes("thelastdance://table/")) {
        // Si es un deeplink estructurado
        const url = new URL(data);
        tableId = url.pathname.split("/").pop() || "";
      } else {
        // Asumir que el QR contiene directamente el ID de la mesa
        tableId = data.trim();
      }

      if (!tableId) {
        showCustomAlert(
          "QR Inválido",
          "No se pudo leer la información de la mesa.",
          "error",
        );
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Intentar activar la mesa (el backend validará si tiene reserva)
      const response = await api.post(`/tables/${tableId}/activate`);

      if (response.data.success) {
        // Mostrar éxito
        showCustomAlert(
          "¡Mesa Confirmada!",
          `Mesa ${response.data.table.table_number} confirmada. ¡Disfruta tu experiencia en The Last Dance!`,
          "success",
        );

        // Navegar después de un breve delay
        setTimeout(() => {
          navigation.navigate("Home");
        }, 2500);
      } else {
        throw new Error(response.data.message || "Error al activar la mesa");
      }
    } catch (error: any) {
      console.error("❌ Error processing QR:", error);
      console.error("❌ Error response:", error.response?.data);

      let errorMessage = "No se pudo procesar el código QR.";
      let alertTitle = "Error";
      let alertType: "error" | "warning" | "info" = "error";

      // Manejar caso especial: llegada temprana con reserva
      if (error.response?.data?.earlyArrival) {
        alertTitle = "Llegaste Temprano";
        errorMessage = error.response.data.message;
        alertType = "warning";
        showCustomAlert(alertTitle, errorMessage, alertType);
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Manejar caso especial: mesa reservada a nombre de otro
      if (error.response?.status === 403 && error.response?.data?.reservedFor) {
        alertTitle = "🔒 Mesa Reservada";
        errorMessage = error.response.data.error;
        alertType = "warning";
        showCustomAlert(alertTitle, errorMessage, alertType);
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Otros errores
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;

        if (errorMessage.includes("Ya tienes la mesa")) {
          alertTitle = "Mesa ya ocupada";
        } else if (errorMessage.includes("no está asignada a tu usuario")) {
          alertTitle = "Mesa no asignada";
          alertType = "info";
        } else if (errorMessage.includes("ya está activa")) {
          alertTitle = "Mesa ya activa";
        } else if (errorMessage.includes("reservada a nombre de")) {
          alertTitle = "🔒 Mesa Reservada";
          alertType = "warning";
        } else if (errorMessage.includes("tiempo límite de llegada expiró")) {
          alertTitle = "Llegada Tardía";
          alertType = "warning";
        }
      } else if (error.response?.status === 404) {
        alertTitle = "Mesa no encontrada";
        errorMessage = "Esta mesa no existe o ha sido eliminada.";
      } else if (error.response?.status === 403) {
        alertTitle = "Sin permisos";
        errorMessage =
          error.response?.data?.error ||
          "No tienes permisos para activar esta mesa.";
      } else if (error.response?.status === 400) {
        alertTitle = "Solicitud inválida";
        errorMessage =
          error.response?.data?.error ||
          "Esta mesa no puede ser activada en este momento.";
      }

      showCustomAlert(alertTitle, errorMessage, alertType);
      setScanned(false);
    } finally {
      setProcessing(false);
    }
  };

  if (!canJoin) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1 items-center justify-center px-6"
      >
        <XCircle size={64} color="#ef4444" />
        <Text className="text-white text-lg mt-4 font-semibold text-center">
          Acceso denegado
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          Solo los clientes pueden unirse a la lista de espera
        </Text>
        <TouchableOpacity
          onPress={() => {
            try {
              navigation.goBack();
            } catch (error) {
              console.error("Navigation goBack error:", error);
            }
          }}
          className="bg-[#d4af37] px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-black font-semibold">Volver</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (!permission) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1 items-center justify-center px-6"
      >
        <Camera size={64} color="#d4af37" />
        <Text className="text-white text-lg mt-4">
          Solicitando permisos de cámara...
        </Text>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1 items-center justify-center px-6"
      >
        <XCircle size={64} color="#ef4444" />
        <Text className="text-white text-lg mt-4 font-semibold text-center">
          Acceso a cámara denegado
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          Necesitamos acceso a la cámara para escanear códigos QR
        </Text>
        <TouchableOpacity
          onPress={() => {
            try {
              navigation.goBack();
            } catch (error) {
              console.error("Navigation goBack error:", error);
            }
          }}
          className="bg-[#d4af37] px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-black font-semibold">Volver</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View className="flex-1">
        {/* Top overlay */}
        <LinearGradient
          colors={["rgba(0,0,0,0.8)", "transparent"]}
          className="absolute top-0 left-0 right-0 z-10 pt-12 pb-8"
        >
          <View className="items-center px-6">
            <View className="flex-row items-center mb-4">
              <QrCode size={24} color="#d4af37" />
              <Text className="text-white text-xl font-semibold ml-2">
                Escanear QR
              </Text>
            </View>
            <Text className="text-gray-300 text-center">
              Escanea el código QR del maitre (lista de espera) o el QR de tu
              mesa (si tienes reserva)
            </Text>
          </View>
        </LinearGradient>

        {/* Scanning frame */}
        <View className="flex-1 items-center justify-center">
          <View
            className="border-2 border-[#d4af37] rounded-2xl bg-transparent"
            style={{
              width: width * 0.7,
              height: width * 0.7,
              position: "relative",
            }}
          >
            {/* Corner indicators */}
            <View className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-[#d4af37] rounded-tl-2xl" />
            <View className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-[#d4af37] rounded-tr-2xl" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-[#d4af37] rounded-bl-2xl" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-[#d4af37] rounded-br-2xl" />

            {processing && (
              <View className="flex-1 items-center justify-center bg-black/50 rounded-2xl">
                <CheckCircle size={48} color="#22c55e" />
                <Text className="text-white mt-2 font-medium">
                  Procesando...
                </Text>
              </View>
            )}
          </View>

          <Text className="text-gray-400 text-center mt-6 px-8">
            Centra el código QR dentro del marco para escanearlo
          </Text>
        </View>

        {/* Bottom overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          className="absolute bottom-0 left-0 right-0 z-10 pt-8 pb-12"
        >
          <View className="items-center px-6">
            {scanned && !processing && (
              <TouchableOpacity
                onPress={() => setScanned(false)}
                className="bg-[#d4af37] rounded-xl py-3 px-6 flex-row items-center mb-4"
              >
                <RefreshCw size={18} color="#1a1a1a" />
                <Text className="text-black font-semibold ml-2">
                  Escanear de nuevo
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                try {
                  navigation.goBack();
                } catch (error) {
                  console.error("Navigation goBack error:", error);
                }
              }}
              className="bg-white/20 rounded-xl py-3 px-6"
            >
              <Text className="text-white font-medium">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* CustomAlert */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => {
          setAlertVisible(false);
          setScanned(false);
        }}
      />
    </View>
  );
}
