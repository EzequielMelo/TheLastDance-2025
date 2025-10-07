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

const { width, height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ScanQRScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  // Debug: verificar que la navegación esté disponible
  console.log("ScanQRScreen - navigation available:", !!navigation);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Verificar que el usuario pueda unirse a la lista
  const canJoin =
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
      // Validar que es nuestro QR
      if (!data.includes("thelastdance://join-waiting-list")) {
        Alert.alert(
          "QR Inválido",
          "Este no es un código QR válido del restaurante The Last Dance.",
          [{ text: "OK", onPress: () => setScanned(false) }],
        );
        return;
      }

      // Extraer y validar datos del QR
      const url = new URL(data);
      const encodedData = url.searchParams.get("data");

      if (!encodedData) {
        throw new Error("Datos del QR no válidos");
      }

      const qrData = JSON.parse(atob(encodedData));

      console.log("QR Data parsed:", qrData);

      // Verificar la acción
      if (qrData.action !== "join_waiting_list") {
        Alert.alert(
          "QR Incorrecto",
          "Este código QR no es para unirse a la lista de espera.",
          [{ text: "OK", onPress: () => setScanned(false) }],
        );
        return;
      }

      // Navegar al formulario con los datos del QR
      try {
        navigation.navigate("JoinWaitingList", { qrData });
      } catch (navError) {
        console.error("Navigation error:", navError);
        Alert.alert(
          "Error de navegación",
          "No se pudo navegar al formulario. Intenta de nuevo.",
          [{ text: "OK", onPress: () => setScanned(false) }],
        );
      }
    } catch (error) {
      console.error("Error processing QR:", error);
      Alert.alert(
        "Error",
        "No se pudo procesar el código QR. Intenta escanearlo nuevamente.",
        [{ text: "OK", onPress: () => setScanned(false) }],
      );
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
              Escanea el código QR que te proporcione el maitre para unirte a la
              lista de espera
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
    </View>
  );
}
