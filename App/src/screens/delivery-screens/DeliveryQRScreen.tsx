/**
 * DeliveryQRScreen - Muestra QR para que el cliente escanee y pague
 */

import React, { useEffect, useState, useRef } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import QRCode from "react-native-qrcode-svg";
import { CheckCircle, ArrowLeft } from "lucide-react-native";
import { io, Socket } from "socket.io-client";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { useAuth } from "../../auth/useAuth";
import { SERVER_BASE_URL } from "../../api/config";

type DeliveryQRScreenRouteProp = RouteProp<
  RootStackParamList,
  "DeliveryPaymentQR"
>;
type DeliveryQRScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "DeliveryPaymentQR"
>;

const DeliveryQRScreen: React.FC = () => {
  const navigation = useNavigation<DeliveryQRScreenNavigationProp>();
  const route = useRoute<DeliveryQRScreenRouteProp>();
  const { deliveryId, paymentData } = route.params;
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const [isPaid, setIsPaid] = useState(false);

  // Generar JSON para el QR
  const qrData = JSON.stringify({
    type: "delivery_payment",
    deliveryId,
    amount: paymentData.totalAmount,
    tipAmount: paymentData.tipAmount,
    tipPercentage: paymentData.tipPercentage,
    satisfactionLevel: paymentData.satisfactionLevel,
  });

  useEffect(() => {
    if (!user?.id || !token) return;

    // Crear conexión Socket.IO
    const socket = io(SERVER_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Socket conectado para QR payment");
      socket.emit("join_user_room", user.id);
    });

    // Escuchar confirmación de pago
    socket.on("delivery_payment_confirmed", (data: { deliveryId: string }) => {
      console.log("💰 Pago confirmado:", data);
      if (data.deliveryId === deliveryId) {
        setIsPaid(true);
        // Navegar al Home después de 2 segundos, reseteando el stack
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: "Home" }],
          });
        }, 2000);
      }
    });

    return () => {
      socket.off("delivery_payment_confirmed");
      socket.disconnect();
    };
  }, [user?.id, token, deliveryId, navigation]);

  if (isPaid) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] items-center justify-center">
        <CheckCircle size={80} color="#10b981" />
        <Text className="text-[#10b981] text-3xl font-bold mt-6 mb-3">
          ¡Pago Confirmado!
        </Text>
        <Text className="text-gray-400 text-base text-center px-5">
          El delivery ha sido completado exitosamente
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#1a1a1a]">
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-gray-800">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="#d4af37" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Pago con QR</Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-5 py-6">
        <View
          className="rounded-xl p-4 mb-6 border-l-4"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderLeftColor: "#d4af37",
          }}
        >
          <Text className="text-white text-base font-semibold mb-2">
            Muestra este código al cliente
          </Text>
          <Text className="text-gray-400 text-sm leading-5">
            El cliente debe escanearlo con la app para confirmar el pago
          </Text>
        </View>

        {/* QR Code */}
        <View className="items-center mb-6">
          <View className="p-5 bg-white rounded-2xl shadow-xl">
            <QRCode value={qrData} size={250} backgroundColor="#ffffff" />
          </View>
        </View>

        {/* Payment Details */}
        <View
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-400 text-sm">Subtotal</Text>
            <Text className="text-white text-base font-semibold">
              ${paymentData.totalAmount.toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-400 text-sm">
              Propina ({paymentData.tipPercentage}%)
            </Text>
            <Text className="text-white text-base font-semibold">
              ${paymentData.tipAmount.toFixed(2)}
            </Text>
          </View>
          <View className="h-px bg-gray-700 my-2" />
          <View className="flex-row justify-between items-center mt-2">
            <Text className="text-white text-lg font-bold">Total</Text>
            <Text className="text-[#d4af37] text-2xl font-bold">
              ${(paymentData.totalAmount + paymentData.tipAmount).toFixed(2)}
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

        {/* Waiting Indicator */}
        <View className="items-center mt-5">
          <ActivityIndicator size="large" color="#d4af37" />
          <Text className="text-gray-400 text-sm mt-3">
            Esperando confirmación del cliente...
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DeliveryQRScreen;
