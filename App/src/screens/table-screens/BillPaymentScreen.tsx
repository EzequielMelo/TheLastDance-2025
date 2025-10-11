import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { RootStackNavigationProp, RootStackParamList } from "../../navigation/RootStackParamList";
import {
  Receipt,
  DollarSign,
  CheckCircle,
  Gift,
  Star,
} from "lucide-react-native";
import { useAuth } from "../../auth/useAuth";
import api from "../../api/axios";

interface BillItem {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

interface GameDiscount {
  gameType: string;
  discount: number;
  wonFirstTry: boolean;
}

interface BillData {
  tableNumber: number;
  tableId: string;
  items: BillItem[];
  subtotal: number;
  gameDiscounts: GameDiscount[];
  totalDiscounts: number;
  finalTotal: number;
  orderCount: number;
  currency: string;
}

interface SatisfactionLevel {
  percentage: number;
  label: string;
  tipPercentage: number;
}

const satisfactionLevels: SatisfactionLevel[] = [
  { percentage: 100, label: "Excelente", tipPercentage: 15 },
  { percentage: 80, label: "Muy Buena", tipPercentage: 10 },
  { percentage: 50, label: "Regular", tipPercentage: 8 },
  { percentage: 30, label: "Mala", tipPercentage: 5 },
  { percentage: 0, label: "Muy Mala", tipPercentage: 3 },
];

const BillPaymentScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'BillPayment'>>();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { user } = useAuth();
  
  const [billData, setBillData] = useState<BillData | null>(null);
  const [selectedSatisfaction, setSelectedSatisfaction] = useState<SatisfactionLevel>(satisfactionLevels[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillData();
  }, []);

  const loadBillData = async () => {
    try {
      setLoading(true);
      setError(null);

      const tableId = route.params?.tableId;
      
      if (!tableId) {
        setError("ID de mesa no proporcionado");
        return;
      }

      const response = await api.get(`/tables/${tableId}/bill`);
      
      if (response.data.success) {
        setBillData(response.data.data);
      } else {
        setError(response.data.message || "Error al cargar los datos de la cuenta");
      }
    } catch (err: any) {
      console.error("Error loading bill data:", err);
      console.error("Error response:", err.response?.data);
      setError(err.response?.data?.message || "Error al cargar los datos de la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const calculateTipAmount = (): number => {
    if (!billData) return 0;
    return Math.round((billData.finalTotal * selectedSatisfaction.tipPercentage) / 100);
  };

  const getTotalWithTip = (): number => {
    if (!billData) return 0;
    return billData.finalTotal + calculateTipAmount();
  };

  const handlePayment = async () => {
    try {
      if (!billData) return;

      const tipAmount = calculateTipAmount();
      const totalAmount = getTotalWithTip();

      Alert.alert(
        "Confirmar Pago",
        `Total a pagar: $${totalAmount.toLocaleString()}\n` +
        `Propina: $${tipAmount.toLocaleString()}\n\n` +
        `¿Proceder con el pago?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Confirmar",
            onPress: () => processPay(totalAmount, tipAmount),
          },
        ]
      );
    } catch (err) {
      console.error("Error handling payment:", err);
      Alert.alert("Error", "Error al procesar el pago");
    }
  };

  const processPay = async (totalAmount: number, tipAmount: number) => {
    try {
      // TODO: Implementar llamada a la API para procesar el pago
      
      Alert.alert(
        "Pago Procesado",
        "¡Gracias por tu visita! El pago ha sido procesado exitosamente.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("Home"),
          },
        ]
      );
    } catch (err) {
      console.error("Error processing payment:", err);
      Alert.alert("Error", "Error al procesar el pago");
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-white text-lg">Cargando cuenta...</Text>
      </View>
    );
  }

  if (error || !billData) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center p-4">
        <Text className="text-red-400 text-lg mb-4 text-center">{error}</Text>
        <TouchableOpacity
          onPress={loadBillData}
          className="bg-blue-600 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-900">
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="items-center mb-6">
          <Receipt size={48} color="#10b981" />
          <Text className="text-white text-2xl font-bold mt-2">
            Detalle de la Cuenta
          </Text>
          <Text className="text-gray-400 text-center">
            Mesa {billData?.tableNumber || route.params?.tableNumber || "N/A"}
          </Text>
        </View>

        {/* Items del Pedido */}
        <View className="bg-gray-800 rounded-lg p-4 mb-4">
          <Text className="text-white text-lg font-semibold mb-3">
            Pedidos Realizados
          </Text>
          {billData.items.map((item) => (
            <View key={item.id} className="flex-row justify-between items-center py-2">
              <View className="flex-1">
                <Text className="text-white font-medium">{item.name}</Text>
                <Text className="text-gray-400 text-sm">
                  ${item.unitPrice.toLocaleString()} x {item.quantity}
                </Text>
              </View>
              <Text className="text-green-400 font-semibold">
                ${item.totalPrice.toLocaleString()}
              </Text>
            </View>
          ))}
          
          {/* Subtotal */}
          <View className="border-t border-gray-700 mt-3 pt-3">
            <View className="flex-row justify-between">
              <Text className="text-gray-300 font-medium">Subtotal</Text>
              <Text className="text-white font-semibold">
                ${billData.subtotal.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Descuentos de Juegos */}
        {billData.gameDiscounts.length > 0 && (
          <View className="bg-gray-800 rounded-lg p-4 mb-4">
            <Text className="text-white text-lg font-semibold mb-3 flex-row items-center">
              <Gift size={20} color="#10b981" className="mr-2" />
              Descuentos por Juegos
            </Text>
            {billData.gameDiscounts.map((discount: GameDiscount, index: number) => (
              <View key={index} className="flex-row justify-between items-center py-2">
                <View className="flex-1">
                  <Text className="text-green-400 font-medium">{discount.gameType}</Text>
                  <Text className="text-gray-400 text-sm">
                    {discount.wonFirstTry ? "¡Ganaste en el primer intento!" : "Descuento aplicado"}
                  </Text>
                </View>
                <Text className="text-green-400 font-semibold">
                  -${discount.discount.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Total Parcial */}
        <View className="bg-gray-800 rounded-lg p-4 mb-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-lg font-semibold">Total Parcial</Text>
            <Text className="text-white text-lg font-bold">
              ${billData.finalTotal.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Sección de Satisfacción y Propina */}
        <View className="bg-gray-800 rounded-lg p-4 mb-4">
          <Text className="text-white text-lg font-semibold mb-3 flex-row items-center">
            <Star size={20} color="#fbbf24" className="mr-2" />
            Grado de Satisfacción
          </Text>
          
          <Text className="text-gray-300 mb-3">
            Selecciona tu nivel de satisfacción con el servicio:
          </Text>
          
          {/* Opciones de satisfacción */}
          <View className="space-y-2 mb-4">
            {satisfactionLevels.map((level) => (
              <TouchableOpacity
                key={level.percentage}
                onPress={() => setSelectedSatisfaction(level)}
                className={`p-3 rounded-lg border ${
                  selectedSatisfaction.percentage === level.percentage
                    ? "bg-yellow-600 border-yellow-500"
                    : "bg-gray-700 border-gray-600"
                }`}
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-white font-medium">
                      {level.percentage}% - {level.label}
                    </Text>
                    <Text className="text-gray-300 text-sm">
                      Propina: {level.tipPercentage}%
                    </Text>
                  </View>
                  {selectedSatisfaction.percentage === level.percentage && (
                    <Star size={20} color="#fbbf24" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Mostrar cálculo de propina */}
          <View className="p-3 bg-gray-700 rounded-lg">
            <Text className="text-gray-300">
              Propina calculada ({selectedSatisfaction.tipPercentage}%): ${calculateTipAmount().toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Total Final */}
        <View className="bg-green-900 border border-green-600 rounded-lg p-4 mb-6">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-xl font-bold">TOTAL A ABONAR</Text>
            <Text className="text-green-400 text-2xl font-bold">
              ${getTotalWithTip().toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Botón de Pago */}
      <View className="p-4 bg-gray-800 border-t border-gray-700">
        <TouchableOpacity
          onPress={handlePayment}
          className="bg-green-600 py-4 rounded-lg flex-row justify-center items-center"
        >
          <CheckCircle size={20} color="white" className="mr-2" />
          <Text className="text-white text-lg font-bold ml-2">
            Pagar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BillPaymentScreen;