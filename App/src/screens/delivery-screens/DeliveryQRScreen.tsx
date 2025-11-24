/**
 * DeliveryQRScreen - Muestra QR para que el cliente escanee y pague
 */

import React, { useEffect, useState, useRef } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import QRCode from "react-native-qrcode-svg";
import { CheckCircle, ArrowLeft } from "lucide-react-native";
import { io, Socket } from "socket.io-client";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { useAuth } from "../../auth/useAuth";
import { SERVER_BASE_URL } from "../../api/config";
import CustomAlert from "../../components/common/CustomAlert";
import { confirmDeliveryPaymentReceived } from "../../api/deliveries";

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
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [paymentConfirmData, setPaymentConfirmData] = useState<{
    deliveryId: string;
    totalAmount: number;
  } | null>(null);

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
    socket.on(
      "delivery_payment_confirmed",
      (data: { deliveryId: string }) => {
        if (data.deliveryId === deliveryId) {
          // Mostrar CustomAlert para que el repartidor confirme que recibió el pago
          setPaymentConfirmData({
            deliveryId: data.deliveryId,
            totalAmount: paymentData.totalAmount,
          });
          setShowConfirmAlert(true);
        }
      },
    );

    return () => {
      socket.off("delivery_payment_confirmed");
      socket.disconnect();
    };
  }, [user?.id, token, deliveryId, navigation, paymentData.totalAmount]);

  const handleConfirmPaymentReceived = async () => {
    setShowConfirmAlert(false);
    try {
      // Llamar al endpoint para confirmar recepción del pago
      await confirmDeliveryPaymentReceived(deliveryId);
      setIsPaid(true);
      // Volver al Home después de mostrar confirmación
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "Home" }],
        });
      }, 2000);
    } catch (error: any) {
      console.error("Error confirmando recepción del pago:", error);
      // Mostrar error pero permitir cerrar el alert
      setIsPaid(true);
    }
  };

  // Interceptar botón de atrás cuando el pago ha sido confirmado
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (isPaid) {
          // Si el pago fue confirmado, ir al Home en lugar de volver atrás
          navigation.reset({
            index: 0,
            routes: [{ name: "Home" }],
          });
          return true; // Prevenir comportamiento por defecto
        }
        return false; // Permitir comportamiento por defecto
      };

      const backHandler = BackHandler.addEventListener("hardwareBackPress", onBackPress);

      return () => backHandler.remove();
    }, [isPaid, navigation])
  );

  if (isPaid) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] items-center justify-center">
        <CheckCircle size={80} color="#10b981" />
        <Text className="text-[#10b981] text-3xl font-bold mt-6 mb-3">
          ¡Pago Recibido!
        </Text>
        <Text className="text-gray-400 text-base text-center px-5">
          El delivery ha sido completado exitosamente.
          {"\n"}La factura fue enviada al cliente.
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

      {/* CustomAlert para confirmar recepción del pago */}
      <CustomAlert
        visible={showConfirmAlert}
        title="Pago Confirmado"
        message={`El cliente ha abonado el pago de $${paymentConfirmData ? (paymentConfirmData.totalAmount + paymentData.tipAmount).toFixed(2) : paymentData.totalAmount.toFixed(2)}.\n\n¿Confirmas que recibiste el pago?`}
        type="success"
        onClose={() => setShowConfirmAlert(false)}
        buttons={[
          {
            text: "No recibí el pago",
            onPress: () => setShowConfirmAlert(false),
            style: "cancel",
          },
          {
            text: "Sí, recibí el pago",
            onPress: handleConfirmPaymentReceived,
          },
        ]}
      />
    </SafeAreaView>
  );
};

export default DeliveryQRScreen;
