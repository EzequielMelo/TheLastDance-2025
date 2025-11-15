/**
 * PaymentQRScanner - Scanner de QR para cliente confirmar pago de delivery
 */

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, Camera } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { X, ScanLine } from "lucide-react-native";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { confirmDeliveryPayment } from "../../api/deliveries";
import CustomAlert from "../../components/common/CustomAlert";

type PaymentQRScannerNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Home"
>;

const PaymentQRScanner: React.FC = () => {
  const navigation = useNavigation<PaymentQRScannerNavigationProp>();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as "success" | "error" | "warning" | "info",
    buttons: [] as Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info",
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  ) => {
    setAlertConfig({ title, message, type, buttons: buttons || [] });
    setAlertVisible(true);
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      // Parsear el QR
      const qrData = JSON.parse(data);

      // Validar que sea un QR de pago de delivery
      if (qrData.type !== "delivery_payment") {
        showCustomAlert(
          "QR Inválido",
          "Este QR no corresponde a un pago de delivery",
          "error",
          [
            {
              text: "OK",
              onPress: () => {
                setAlertVisible(false);
                setScanned(false);
              },
            },
          ],
        );
        setIsProcessing(false);
        return;
      }

      // Confirmar el pago
      await confirmDeliveryPayment(qrData.deliveryId, {
        payment_method: "qr",
        tip_amount: qrData.tipAmount,
        tip_percentage: qrData.tipPercentage,
        satisfaction_level: qrData.satisfactionLevel,
      });

      showCustomAlert(
        "¡Pago Confirmado!",
        `Has confirmado el pago de $${(qrData.amount + qrData.tipAmount).toFixed(2)}\nGracias por tu compra`,
        "success",
        [
          {
            text: "OK",
            onPress: () => {
              setAlertVisible(false);
              navigation.navigate("Home");
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Error al confirmar pago:", error);

      // Si el error es de parsing del JSON
      if (error instanceof SyntaxError) {
        showCustomAlert(
          "QR Inválido",
          "El código QR no tiene el formato correcto",
          "error",
          [
            {
              text: "OK",
              onPress: () => {
                setAlertVisible(false);
                setScanned(false);
              },
            },
          ],
        );
      } else {
        showCustomAlert(
          "Error",
          error.message || "No se pudo confirmar el pago. Intenta de nuevo.",
          "error",
          [
            {
              text: "OK",
              onPress: () => {
                setAlertVisible(false);
                setScanned(false);
              },
            },
          ],
        );
      }

      setIsProcessing(false);
    }
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] items-center justify-center">
        <ActivityIndicator size="large" color="#d4af37" />
        <Text className="text-gray-400 text-base mt-4">
          Solicitando permisos de cámara...
        </Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] items-center justify-center px-5">
        <Text className="text-red-500 text-base text-center mb-5">
          No se otorgó permiso para la cámara
        </Text>
        <TouchableOpacity
          className="rounded-xl px-6 py-3"
          style={{ backgroundColor: "#d4af37" }}
          onPress={() => navigation.goBack()}
        >
          <Text className="text-white text-base font-semibold">Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <SafeAreaView edges={["top"]} className="bg-black">
        <View className="flex-row items-center px-5 py-3 border-b border-gray-800">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={isProcessing}
            className="mr-4"
          >
            <X size={28} color="#d4af37" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">
            Escanear QR de Pago
          </Text>
        </View>
      </SafeAreaView>

      {/* Camera */}
      <View className="flex-1 relative">
        <CameraView
          className="flex-1"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />

        {/* Overlay */}
        <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
          <View
            className="w-64 h-64 rounded-2xl items-center justify-center border-4"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              borderColor: "#d4af37",
            }}
          >
            <ScanLine size={40} color="#d4af37" />
          </View>
        </View>

        {/* Instructions */}
        <View
          className="absolute bottom-10 left-5 right-5 rounded-xl p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.9)" }}
        >
          <Text className="text-white text-base text-center leading-6">
            Apunta la cámara al código QR del repartidor
          </Text>
        </View>

        {/* Processing Indicator */}
        {isProcessing && (
          <View
            className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
          >
            <View
              className="rounded-2xl p-6 items-center min-w-[200px]"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            >
              <ActivityIndicator size="large" color="#d4af37" />
              <Text className="text-white text-base mt-4">
                Confirmando pago...
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* CustomAlert */}
      <CustomAlert
        visible={alertVisible}
        onClose={() => setAlertVisible(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
    </View>
  );
};

export default PaymentQRScanner;
