import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
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

const { width, height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ScanTableQRScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  console.log("ScanTableQRScreen - navigation available:", !!navigation);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hasOccupiedTable, setHasOccupiedTable] = useState<boolean | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // Verificar que el usuario pueda confirmar mesa
  const canConfirm =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Verificar si el usuario ya tiene una mesa ocupada
  useEffect(() => {
    const checkOccupiedTable = async () => {
      if (!canConfirm) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/api/tables/status");
        const myOccupiedTables = response.data.tables?.filter(
          (table: any) => table.id_client === user?.id && table.is_occupied,
        );

        setHasOccupiedTable(myOccupiedTables && myOccupiedTables.length > 0);
      } catch (error) {
        console.error("Error checking occupied table:", error);
        setHasOccupiedTable(false);
      } finally {
        setLoading(false);
      }
    };

    checkOccupiedTable();
  }, [canConfirm, user?.id]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      console.log("Scanned QR data:", data);

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
        Alert.alert(
          "QR Inválido",
          "Este código QR no contiene información válida de mesa.",
          [{ text: "OK", onPress: () => setScanned(false) }],
        );
        return;
      }

      console.log("Extracted table ID:", tableId);

      // Llamar al endpoint para activar la mesa
      const response = await api.post(`/api/tables/${tableId}/activate`);

      if (response.data.success) {
        // Mostrar éxito
        Alert.alert(
          "¡Mesa Confirmada!",
          `Has confirmado tu llegada a la mesa ${response.data.table.table_number}. ¡Disfruta tu experiencia!`,
          [
            {
              text: "Continuar",
              onPress: () => {
                ToastAndroid.show(
                  "Mesa activada correctamente",
                  ToastAndroid.SHORT,
                );
                navigation.navigate("Home");
              },
            },
          ],
        );
      } else {
        throw new Error(response.data.message || "Error al activar la mesa");
      }
    } catch (error: any) {
      console.error("Error activating table:", error);

      let errorMessage = "No se pudo confirmar tu llegada a la mesa.";
      let alertTitle = "Error";

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;

        // Personalizar título basado en el tipo de error
        if (errorMessage.includes("Ya tienes la mesa")) {
          alertTitle = "Mesa ya ocupada";
        } else if (errorMessage.includes("no está asignada a tu usuario")) {
          alertTitle = "Mesa no asignada";
        } else if (errorMessage.includes("ya está activa")) {
          alertTitle = "Mesa ya activa";
        }
      } else if (error.response?.status === 404) {
        alertTitle = "Mesa no encontrada";
        errorMessage = "Esta mesa no existe o ha sido eliminada.";
      } else if (error.response?.status === 403) {
        alertTitle = "Sin permisos";
        errorMessage = "No tienes permisos para activar esta mesa.";
      } else if (error.response?.status === 400) {
        alertTitle = "Solicitud inválida";
        errorMessage =
          error.response?.data?.error ||
          "Esta mesa no puede ser activada en este momento.";
      }

      Alert.alert(alertTitle, errorMessage, [
        { text: "OK", onPress: () => setScanned(false) },
      ]);
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
          Verificando estado de mesa...
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

  if (hasOccupiedTable) {
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
        <CheckCircle size={64} color="#22c55e" />
        <Text
          style={{
            color: "white",
            fontSize: 18,
            marginTop: 16,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Ya tienes una mesa activa
        </Text>
        <Text
          style={{
            color: "#9ca3af",
            textAlign: "center",
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          Solo puedes tener una mesa ocupada a la vez. Si necesitas cambiar de
          mesa, contacta al maitre.
        </Text>
        <TouchableOpacity
          onPress={() => {
            try {
              navigation.navigate("Home");
            } catch (error) {
              console.error("Navigation error:", error);
            }
          }}
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
          onPress={() => {
            try {
              navigation.goBack();
            } catch (error) {
              console.error("Navigation goBack error:", error);
            }
          }}
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
            paddingTop: 32,
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
    </View>
  );
}
