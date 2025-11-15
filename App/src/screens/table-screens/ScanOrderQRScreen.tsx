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
  Package,
  CheckCircle,
  Clock,
  Gamepad2,
  FileText,
  Receipt,
} from "lucide-react-native";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/axios";

const { width, height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ScanOrderQRScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myTableId, setMyTableId] = useState<string | null>(null);

  // Verificar que el usuario pueda confirmar pedidos
  const canConfirm =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Verificar si el usuario tiene una mesa asignada
  useEffect(() => {
    const checkMyTable = async () => {
      if (!canConfirm) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/tables/my-table");
        if (response.data.hasOccupiedTable && response.data.table) {
          setMyTableId(response.data.table.id);
        }
      } catch (error) {
        console.error("Error checking my table:", error);
      } finally {
        setLoading(false);
      }
    };

    checkMyTable();
  }, [canConfirm, user?.id]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      // El QR puede ser:
      // 1. Un deeplink de mesa: thelastdance://table/{tableId}
      // 2. El ID directo de la mesa (como en ScanTableQR)
      // 3. Un deeplink específico de entrega: thelastdance://order-delivery/{tableId}
      let tableId: string;

      if (data.includes("thelastdance://table/")) {
        // QR de mesa normal (reutilizar la misma lógica que ScanTableQRScreen)
        const url = new URL(data);
        tableId = url.pathname.split("/").pop() || "";
      } else if (data.includes("thelastdance://order-delivery/")) {
        // QR específico para entrega
        const url = new URL(data);
        tableId = url.pathname.split("/").pop() || "";
      } else {
        // Por ahora, asumimos que el QR contiene directamente el ID de la mesa
        tableId = data.trim();
      }

      if (!tableId) {
        ToastAndroid.show(
          "❌ QR Inválido: No contiene información válida de mesa",
          ToastAndroid.SHORT,
        );
        setTimeout(() => setScanned(false), 1500);
        return;
      }

      // Usar el número de mesa extraído del QR para identificar la mesa
      const targetTableId = tableId; // Número extraído del QR

      // Primero verificar el estado actual de la mesa
      const statusResponse = await api.get("/tables/my-status");
      const currentTableStatus = statusResponse.data.table_status;

      if (currentTableStatus === "bill_requested") {
        // Obtener el tableId real desde el estado del usuario
        const realTableId = statusResponse.data.table?.id || myTableId;

        if (!realTableId) {
          ToastAndroid.show(
            "❌ Mesa no identificada. Escanea tu mesa primero",
            ToastAndroid.SHORT,
          );
          setTimeout(() => setScanned(false), 1500);
          return;
        }

        navigation.navigate("BillPayment", {
          tableId: realTableId,
          tableNumber: statusResponse.data.table?.number,
        });
        return;
      }

      // Si no es bill_requested, confirmar la entrega del pedido
      if (!myTableId) {
        ToastAndroid.show(
          "❌ Mesa no identificada. Escanea tu mesa primero",
          ToastAndroid.SHORT,
        );
        setTimeout(() => setScanned(false), 1500);
        return;
      }

      const confirmResponse = await api.post(
        `/tables/${myTableId}/confirm-delivery`,
      );

      if (!confirmResponse.data.success) {
        throw new Error(
          confirmResponse.data.error || "Error confirmando entrega",
        );
      }

      // Entrega confirmada exitosamente
      ToastAndroid.show(
        "🎉 ¡Entrega Confirmada! Ahora puedes jugar, llenar encuesta o pedir la cuenta",
        ToastAndroid.LONG,
      );

      // Navegar al home donde podrá acceder a todas las opciones
      setTimeout(() => {
        navigation.navigate("Home", { refresh: Date.now() });
      }, 2500);
    } catch (error: any) {
      console.error("Error processing QR scan:", error);

      let errorMessage = "No se pudo procesar la solicitud.";
      let alertTitle = "Error";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 404) {
        alertTitle = "Mesa no encontrada";
        errorMessage = "Esta mesa no existe o no tienes pedidos en ella.";
      } else if (error.response?.status === 403) {
        alertTitle = "Sin permisos";
        errorMessage =
          "No tienes permisos para realizar esta acción en esta mesa.";
      }

      ToastAndroid.show(`❌ ${alertTitle}: ${errorMessage}`, ToastAndroid.LONG);
      setTimeout(() => setScanned(false), 2000);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
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
        <Clock size={64} color="#d4af37" />
        <Text style={{ color: "white", fontSize: 18, marginTop: 16 }}>
          Verificando mesa asignada...
        </Text>
      </LinearGradient>
    );
  }

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
          Solo los clientes pueden confirmar entrega de pedidos
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
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

  if (!myTableId) {
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
        <Package size={64} color="#f59e0b" />
        <Text
          style={{
            color: "white",
            fontSize: 18,
            marginTop: 16,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Sin mesa asignada
        </Text>
        <Text
          style={{
            color: "#9ca3af",
            textAlign: "center",
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          Necesitas tener una mesa asignada para confirmar entregas de pedidos.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          style={{
            backgroundColor: "#d4af37",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "black", fontWeight: "600" }}>
            Ir al inicio
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            backgroundColor: "rgba(255,255,255,0.2)",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontWeight: "500" }}>Volver</Text>
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
          onPress={() => navigation.goBack()}
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
        ></LinearGradient>

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
                  Verificando pedido...
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
            Centra el código QR de tu mesa dentro del marco
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
              onPress={() => navigation.goBack()}
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
    </View>
  );
}
