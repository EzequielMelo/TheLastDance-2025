import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ToastAndroid,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type {
  RootStackNavigationProp,
  RootStackParamList,
} from "../../navigation/RootStackParamList";
import {
  DollarSign,
  CheckCircle,
  Star,
  Heart,
  Smile,
  Meh,
  Frown,
  ArrowLeft,
  Gift,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { confirmDeliveryPayment } from "../../api/deliveries";
import CustomAlert from "../../components/common/CustomAlert";
import {
  getDiscount,
  clearDiscount,
  Discount,
} from "../../storage/discountStorage";
import { useAuth } from "../../auth/useAuth";

interface SatisfactionLevel {
  value: string;
  label: string;
  icon: any;
  color: string;
  tipPercentage: number;
}

const satisfactionLevels: SatisfactionLevel[] = [
  {
    value: "excellent",
    label: "Excelente",
    icon: Heart,
    color: "#22c55e",
    tipPercentage: 15,
  },
  {
    value: "good",
    label: "Bueno",
    icon: Smile,
    color: "#3b82f6",
    tipPercentage: 10,
  },
  {
    value: "regular",
    label: "Regular",
    icon: Meh,
    color: "#f59e0b",
    tipPercentage: 5,
  },
  {
    value: "bad",
    label: "Malo",
    icon: Frown,
    color: "#ef4444",
    tipPercentage: 0,
  },
];

const DeliveryPaymentConfirmScreen: React.FC = () => {
  const route =
    useRoute<RouteProp<RootStackParamList, "DeliveryPaymentConfirm">>();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { user } = useAuth();

  const { deliveryId, totalAmount } = route.params;

  const [selectedSatisfaction, setSelectedSatisfaction] =
    useState<SatisfactionLevel>(satisfactionLevels[0]);
  const [customTipPercentage, setCustomTipPercentage] = useState<string>("");
  const [isCustomTip, setIsCustomTip] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [currentDiscount, setCurrentDiscount] = useState<Discount | null>(null);

  useEffect(() => {
    loadCurrentDiscount();
  }, []);

  const loadCurrentDiscount = async () => {
    try {
      // Solo cargar descuentos para usuarios registrados
      if (user?.profile_code === "cliente_registrado") {
        const discount = await getDiscount();
        if (discount && discount.received) {
          setCurrentDiscount(discount);
        }
      }
    } catch (error) {
      console.error("Error loading current discount:", error);
    }
  };

  const calculateGameDiscountAmount = (): number => {
    if (!currentDiscount || user?.profile_code === "cliente_anonimo") return 0;
    return Math.round((totalAmount * currentDiscount.amount) / 100);
  };

  const tipPercentage = isCustomTip
    ? parseFloat(customTipPercentage) || 0
    : selectedSatisfaction.tipPercentage;

  const gameDiscountAmount = calculateGameDiscountAmount();
  const subtotalAfterDiscount = totalAmount - gameDiscountAmount;
  const tipAmount = (subtotalAfterDiscount * tipPercentage) / 100;
  const finalTotal = subtotalAfterDiscount + tipAmount;

  const handleConfirmPayment = async () => {
    if (processing) return;

    try {
      setProcessing(true);
      ToastAndroid.show("💰 Procesando pago...", ToastAndroid.SHORT);

      await confirmDeliveryPayment(deliveryId, {
        payment_method: "qr",
        tip_amount: tipAmount,
        tip_percentage: tipPercentage,
        satisfaction_level: selectedSatisfaction.value,
      });

      // Limpiar descuento después de usarlo
      if (currentDiscount && currentDiscount.received) {
        await clearDiscount();
      }

      setAlertMessage(
        `Has confirmado el pago del delivery.\nGracias por tu compra y tu propina de $${tipAmount.toFixed(2)}`,
      );
      setShowSuccessAlert(true);

      // Volver al home después de un delay
      setTimeout(() => {
        navigation.navigate("Home");
      }, 2000);
    } catch (error: any) {
      console.error("Error al confirmar pago:", error);
      setAlertMessage(
        error.response?.data?.error ||
          error.message ||
          "No se pudo confirmar el pago",
      );
      setShowErrorAlert(true);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-900">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-neutral-800">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-2 rounded-full"
        >
          <ArrowLeft size={24} color="#d4af37" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Confirmar Pago</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Total del Pedido */}
        <View className="mt-6 bg-neutral-800 rounded-2xl p-6 border border-neutral-700">
          <View className="flex-row items-center mb-4">
            <DollarSign size={24} color="#d4af37" />
            <Text className="text-white text-lg font-bold ml-2">
              Total del Pedido
            </Text>
          </View>
          <Text className="text-white text-3xl font-bold text-center">
            ${totalAmount.toFixed(2)}
          </Text>
        </View>

        {/* Nivel de Satisfacción */}
        <View className="mt-6">
          <View className="flex-row items-center mb-4">
            <Star size={24} color="#d4af37" />
            <Text className="text-white text-lg font-bold ml-2">
              ¿Cómo fue tu experiencia?
            </Text>
          </View>

          <View className="space-y-3">
            {satisfactionLevels.map(level => {
              const Icon = level.icon;
              const isSelected = selectedSatisfaction.value === level.value;

              return (
                <TouchableOpacity
                  key={level.value}
                  onPress={() => {
                    setSelectedSatisfaction(level);
                    setIsCustomTip(false);
                    setCustomTipPercentage("");
                  }}
                  className={`flex-row items-center justify-between p-4 rounded-xl border-2 ${
                    isSelected
                      ? "bg-neutral-700 border-[#d4af37]"
                      : "bg-neutral-800 border-neutral-700"
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    <Icon size={24} color={level.color} />
                    <View className="ml-3 flex-1">
                      <Text className="text-white text-base font-semibold">
                        {level.label}
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        Propina sugerida: {level.tipPercentage}%
                      </Text>
                    </View>
                  </View>
                  {isSelected && <CheckCircle size={24} color="#d4af37" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Propina Personalizada */}
        <View className="mt-6">
          <TouchableOpacity
            onPress={() => setIsCustomTip(!isCustomTip)}
            className={`flex-row items-center justify-between p-4 rounded-xl border-2 ${
              isCustomTip
                ? "bg-neutral-700 border-[#d4af37]"
                : "bg-neutral-800 border-neutral-700"
            }`}
          >
            <View className="flex-row items-center flex-1">
              <DollarSign size={24} color="#d4af37" />
              <Text className="text-white text-base font-semibold ml-3">
                Propina Personalizada
              </Text>
            </View>
            {isCustomTip && <CheckCircle size={24} color="#d4af37" />}
          </TouchableOpacity>

          {isCustomTip && (
            <View className="mt-3 bg-neutral-800 rounded-xl p-4 border border-neutral-700">
              <Text className="text-gray-400 text-sm mb-2">
                Ingresa el porcentaje de propina
              </Text>
              <TextInput
                value={customTipPercentage}
                onChangeText={setCustomTipPercentage}
                placeholder="Ej: 12"
                placeholderTextColor="#6b7280"
                keyboardType="decimal-pad"
                className="bg-neutral-900 text-white text-lg p-3 rounded-lg border border-neutral-700"
              />
            </View>
          )}
        </View>

        {/* Resumen */}
        <View className="mt-6 bg-neutral-800 rounded-2xl p-6 border border-neutral-700">
          <Text className="text-white text-lg font-bold mb-4">Resumen</Text>

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Subtotal</Text>
            <Text className="text-white font-semibold">
              ${totalAmount.toFixed(2)}
            </Text>
          </View>

          {/* Descuento por juegos */}
          {currentDiscount && currentDiscount.received && (
            <View className="flex-row justify-between mb-2">
              <View className="flex-row items-center">
                <Gift size={16} color="#22c55e" />
                <Text className="text-green-500 ml-1">
                  Descuento por juego ({currentDiscount.amount}%)
                </Text>
              </View>
              <Text className="text-green-500 font-semibold">
                -${gameDiscountAmount.toFixed(2)}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400">Propina ({tipPercentage}%)</Text>
            <Text className="text-white font-semibold">
              ${tipAmount.toFixed(2)}
            </Text>
          </View>

          <View className="border-t border-neutral-700 mt-4 pt-4">
            <View className="flex-row justify-between">
              <Text className="text-white text-lg font-bold">Total</Text>
              <Text className="text-[#d4af37] text-xl font-bold">
                ${finalTotal.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Botón Confirmar */}
        <TouchableOpacity
          onPress={handleConfirmPayment}
          disabled={processing}
          className="mt-6 mb-8 bg-[#d4af37] rounded-xl p-4 flex-row items-center justify-center"
          style={{
            opacity: processing ? 0.6 : 1,
          }}
        >
          <CheckCircle size={24} color="#1a1a1a" />
          <Text className="text-neutral-900 text-lg font-bold ml-2">
            {processing ? "Procesando..." : "Confirmar Pago"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Alert de Éxito */}
      <CustomAlert
        visible={showSuccessAlert}
        onClose={() => {
          setShowSuccessAlert(false);
          navigation.navigate("Home");
        }}
        title="¡Pago Confirmado!"
        message={alertMessage}
        type="success"
      />

      {/* Alert de Error */}
      <CustomAlert
        visible={showErrorAlert}
        onClose={() => setShowErrorAlert(false)}
        title="Error"
        message={alertMessage}
        type="error"
      />
    </SafeAreaView>
  );
};

export default DeliveryPaymentConfirmScreen;
