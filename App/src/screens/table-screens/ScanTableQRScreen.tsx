import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ToastAndroid,
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
  TableProperties,
  CheckCircle,
  Clock,
} from "lucide-react-native";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/axios";
import CustomAlert from "../../components/common/CustomAlert";
import { useDeliveryState } from "../../Hooks/useDeliveryState";
import { confirmDeliveryPayment } from "../../api/deliveries";

const { width, height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ScanTableQRScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { hasActiveDelivery, delivery: activeDelivery, state: deliveryState } = useDeliveryState();

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

  // Verificar que el usuario pueda confirmar mesa
  const canConfirm =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

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
      // 🚚 Validar si es un QR de delivery payment (JSON)
      try {
        const parsedData = JSON.parse(data);
        if (parsedData.type === "delivery_payment") {
          // Verificar si el cliente tiene un delivery activo con pago pendiente
          if (
            hasActiveDelivery &&
            deliveryState === "on_the_way" &&
            activeDelivery?.payment_method === "qr" &&
            activeDelivery?.payment_status === "pending"
          ) {
            // Confirmar el pago
            try {
              ToastAndroid.show("💰 Procesando pago...", ToastAndroid.SHORT);

              await confirmDeliveryPayment(parsedData.deliveryId, {
                payment_method: "qr",
                tip_amount: parsedData.tipAmount || 0,
                tip_percentage: parsedData.tipPercentage || 0,
                satisfaction_level: parsedData.satisfactionLevel || 5,
              });

              ToastAndroid.show(
                "✅ Pago confirmado exitosamente",
                ToastAndroid.LONG,
              );

              // Volver al home después de un delay
              setTimeout(() => {
                navigation.navigate("Home");
              }, 1500);
            } catch (error: any) {
              console.error("Error al confirmar pago:", error);
              ToastAndroid.show(
                error.response?.data?.error ||
                  error.message ||
                  "❌ Error al confirmar el pago",
                ToastAndroid.LONG,
              );
              setScanned(false);
            }
          } else {
            ToastAndroid.show(
              "❌ Este es un QR de pago de delivery. Úsalo cuando tengas un delivery activo con pago pendiente.",
              ToastAndroid.LONG,
            );
            setScanned(false);
          }
          setProcessing(false);
          return;
        }
      } catch (e) {
        // No es JSON, continuar con flujo normal de mesa
      }

      // Por ahora, vamos a simular que el QR contiene el ID de la mesa
      // En el futuro, esto será un deeplink como: thelastdance://table/{tableId}
      let tableId: string;

      if (data.includes("thelastdance://table/")) {
        // Si es un deeplink estructurado
        const url = new URL(data);
        tableId = url.pathname.split("/").pop() || "";
      } else {
        // Por ahora, asumimos que el QR contiene directamente el ID de la mesa
        tableId = data.trim();
      }

      if (!tableId) {
        ToastAndroid.show(
          "❌ QR Inválido - No contiene información válida de mesa",
          ToastAndroid.SHORT,
        );
        setScanned(false);
        return;
      }

      // Llamar al endpoint para activar la mesa
      const response = await api.post(`/tables/${tableId}/activate`);

      if (response.data.success) {
        // Mostrar éxito con CustomAlert
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
      console.error("❌ Error activating table:", error);
      console.error("❌ Error response:", error.response?.data);

      let errorMessage = "No se pudo confirmar tu llegada a la mesa.";
      let alertTitle = "Error";
      let alertType: "error" | "warning" | "info" = "error";

      // Manejar caso especial: llegada temprana
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

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;

        // Personalizar título basado en el tipo de error
        if (errorMessage.includes("Ya tienes la mesa")) {
          alertTitle = "Mesa ya ocupada";
        } else if (errorMessage.includes("no está asignada a tu usuario")) {
          alertTitle = "Mesa no asignada";
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

  if (!canConfirm) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <XCircle size={64} color="#ef4444" />
        <Text
          style={{
            color: "white",
            fontSize: 18,
            marginTop: 16,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Acceso denegado
        </Text>
        <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
          Solo los clientes pueden confirmar su llegada a una mesa
        </Text>
        <TouchableOpacity
          onPress={() => {
            try {
              navigation.goBack();
            } catch (error) {
              console.error("Navigation goBack error:", error);
            }
          }}
          style={{
            backgroundColor: "#d4af37",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            marginTop: 24,
          }}
        >
          <Text style={{ color: "black", fontWeight: "600" }}>Volver</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (!permission) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Camera size={64} color="#d4af37" />
        <Text style={{ color: "white", fontSize: 18, marginTop: 16 }}>
          Solicitando permisos de cámara...
        </Text>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <XCircle size={64} color="#ef4444" />
        <Text
          style={{
            color: "white",
            fontSize: 18,
            marginTop: 16,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Acceso a cámara denegado
        </Text>
        <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
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
          style={{
            backgroundColor: "#d4af37",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            marginTop: 24,
          }}
        >
          <Text style={{ color: "black", fontWeight: "600" }}>Volver</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={{ flex: 1 }}>
        {/* Top overlay */}
        <LinearGradient
          colors={["rgba(0,0,0,0.8)", "transparent"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: 48,
            paddingBottom: 32,
          }}
        >
          <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <TableProperties size={24} color="#d4af37" />
              <Text
                style={{
                  color: "white",
                  fontSize: 20,
                  fontWeight: "600",
                  marginLeft: 8,
                }}
              >
                Confirmar Mesa
              </Text>
            </View>
            <Text style={{ color: "#d1d5db", textAlign: "center" }}>
              Escanea el código QR de tu mesa para confirmar tu llegada y
              activar la ocupación
            </Text>
          </View>
        </LinearGradient>

        {/* Scanning frame */}
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: width * 0.7,
              height: width * 0.7,
              position: "relative",
              borderWidth: 2,
              borderColor: "#d4af37",
              borderRadius: 16,
              backgroundColor: "transparent",
            }}
          >
            {/* Corner indicators */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 32,
                height: 32,
                borderLeftWidth: 4,
                borderTopWidth: 4,
                borderColor: "#d4af37",
                borderTopLeftRadius: 16,
              }}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 32,
                height: 32,
                borderRightWidth: 4,
                borderTopWidth: 4,
                borderColor: "#d4af37",
                borderTopRightRadius: 16,
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: 32,
                height: 32,
                borderLeftWidth: 4,
                borderBottomWidth: 4,
                borderColor: "#d4af37",
                borderBottomLeftRadius: 16,
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 32,
                height: 32,
                borderRightWidth: 4,
                borderBottomWidth: 4,
                borderColor: "#d4af37",
                borderBottomRightRadius: 16,
              }}
            />

            {processing && (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  borderRadius: 16,
                }}
              >
                <Clock size={48} color="#d4af37" />
                <Text
                  style={{ color: "white", marginTop: 8, fontWeight: "500" }}
                >
                  Confirmando mesa...
                </Text>
              </View>
            )}
          </View>

          <Text
            style={{
              color: "#9ca3af",
              textAlign: "center",
              marginTop: 24,
              paddingHorizontal: 32,
            }}
          >
            Centra el código QR de tu mesa dentro del marco para confirmar tu
            llegada
          </Text>
        </View>

        {/* Bottom overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: 48,
            paddingBottom: 48,
          }}
        >
          <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
            {scanned && !processing && (
              <TouchableOpacity
                onPress={() => setScanned(false)}
                style={{
                  backgroundColor: "#d4af37",
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <RefreshCw size={18} color="#1a1a1a" />
                <Text
                  style={{ color: "black", fontWeight: "600", marginLeft: 8 }}
                >
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
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
              }}
            >
              <Text style={{ color: "white", fontWeight: "500" }}>
                Cancelar
              </Text>
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
