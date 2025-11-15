/**
 * DeliveryCashConfirmScreen - Repartidor confirma recepción de efectivo
 */

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banknote, ArrowLeft, CheckCircle } from "lucide-react-native";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { confirmDeliveryPayment } from "../../api/deliveries";
import CustomAlert from "../../components/common/CustomAlert";

type DeliveryCashConfirmScreenRouteProp = RouteProp<
  RootStackParamList,
  "DeliveryCashConfirm"
>;
type DeliveryCashConfirmScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "DeliveryCashConfirm"
>;

const DeliveryCashConfirmScreen: React.FC = () => {
  const navigation = useNavigation<DeliveryCashConfirmScreenNavigationProp>();
  const route = useRoute<DeliveryCashConfirmScreenRouteProp>();
  const { deliveryId, paymentData } = route.params;

  const [isConfirming, setIsConfirming] = useState(false);

  // Estados para CustomAlert
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
    type: "success" | "error" | "warning" | "info" = "info",
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  ) => {
    setAlertConfig({
      title,
      message,
      type,
      buttons: buttons || [
        { text: "OK", onPress: () => setAlertVisible(false) },
      ],
    });
    setAlertVisible(true);
  };

  const handleConfirmPayment = async () => {
    try {
      setIsConfirming(true);

      await confirmDeliveryPayment(deliveryId, {
        payment_method: "cash",
        tip_amount: paymentData.tipAmount,
        tip_percentage: paymentData.tipPercentage,
        satisfaction_level: paymentData.satisfactionLevel,
      });

      showCustomAlert(
        "¡Pago Confirmado!",
        "El delivery ha sido completado exitosamente",
        "success",
        [
          {
            text: "OK",
            onPress: () => {
              setAlertVisible(false);
              navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
              });
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Error al confirmar pago:", error);
      showCustomAlert(
        "Error",
        error.message || "No se pudo confirmar el pago. Intenta de nuevo.",
        "error",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const totalAmount = paymentData.totalAmount;
  const tipAmount = paymentData.tipAmount;
  const finalTotal = totalAmount + tipAmount;

  return (
    <SafeAreaView className="flex-1 bg-[#1a1a1a]">
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-gray-800">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mr-4"
          disabled={isConfirming}
        >
          <ArrowLeft size={24} color="#d4af37" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Pago en Efectivo</Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-5 py-4">
        {/* Icon */}
        <View className="items-center my-6">
          <View
            className="w-28 h-28 rounded-full items-center justify-center border-4"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              borderColor: "#10b981",
            }}
          >
            <Banknote size={64} color="#10b981" />
          </View>
        </View>

        {/* Instructions */}
        <View
          className="rounded-xl p-4 mb-6 border-l-4"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderLeftColor: "#10b981",
          }}
        >
          <Text className="text-white text-base font-semibold mb-2">
            Confirma la recepción
          </Text>
          <Text className="text-gray-400 text-sm leading-5">
            Verifica que el cliente te haya entregado el monto correcto en
            efectivo antes de confirmar
          </Text>
        </View>

        {/* Payment Details */}
        <View
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-400 text-sm">Subtotal del Pedido</Text>
            <Text className="text-white text-base font-semibold">
              ${totalAmount.toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-400 text-sm">
              Propina ({paymentData.tipPercentage}%)
            </Text>
            <Text className="text-white text-base font-semibold">
              ${tipAmount.toFixed(2)}
            </Text>
          </View>
          <View className="h-px bg-gray-700 my-2" />
          <View className="flex-row justify-between items-center mt-2">
            <Text className="text-white text-lg font-bold">
              Total a Recibir
            </Text>
            <Text className="text-[#d4af37] text-2xl font-bold">
              ${finalTotal.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Satisfaction Level */}
        {paymentData.satisfactionLevel && (
          <View
            className="rounded-xl p-4 mb-6 items-center"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
          >
            <Text className="text-gray-400 text-xs mb-1">
              Nivel de Satisfacción
            </Text>
            <Text className="text-[#fbbf24] text-base font-semibold">
              {paymentData.satisfactionLevel}
            </Text>
          </View>
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          className={`flex-row items-center justify-center rounded-xl p-5 mb-4 ${
            isConfirming ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: "#d4af37" }}
          onPress={handleConfirmPayment}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <CheckCircle size={24} color="#fff" />
              <Text className="text-white text-lg font-bold ml-2">
                Confirmar Recepción de ${finalTotal.toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Warning */}
        <View
          className="rounded-lg p-3 border-l-4"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderLeftColor: "#fbbf24",
          }}
        >
          <Text className="text-gray-400 text-xs leading-5 text-center">
            ⚠️ Al confirmar, el pedido se marcará como entregado y el pago como
            completado
          </Text>
        </View>
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
    </SafeAreaView>
  );
};

export default DeliveryCashConfirmScreen;
