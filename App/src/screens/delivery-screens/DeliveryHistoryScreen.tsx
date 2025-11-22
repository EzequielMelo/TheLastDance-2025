import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  ChevronLeft,
  Package,
  MapPin,
  Clock,
  FileText,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";
import api from "../../api/axios";
import type { DeliveryWithOrder } from "../../types/Delivery";

/**
 * Pantalla de historial de deliveries del usuario
 */
const DeliveryHistoryScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [deliveries, setDeliveries] = useState<DeliveryWithOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const response = await api.get("/deliveries/history");
      if (response.data.success) {
        setDeliveries(response.data.deliveries);
      }
    } catch (error) {
      console.error("Error fetching delivery history:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Recargar historial cuando la pantalla recibe el foco
  useFocusEffect(
    React.useCallback(() => {
      fetchHistory();
    }, []),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "text-green-600 bg-green-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "Entregado";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] items-center justify-center">
        <ActivityIndicator size="large" color="#d4af37" />
        <Text className="text-gray-50 mt-4">Cargando historial...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#1a1a1a]">
      {/* Header */}
      <View className="bg-[#1a1a1a] border-b border-black px-4 py-3">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-3"
          >
            <ChevronLeft size={24} color="#d4af37" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-50">
              Historial de Deliveries
            </Text>
            <Text className="text-sm text-gray-50">
              {deliveries.length} pedido{deliveries.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#d4af37"
          />
        }
      >
        <View className="p-4">
          {deliveries.length === 0 ? (
            <View className="bg-[#1a1a1a] rounded-2xl p-8 items-center">
              <Package size={64} color="#d1d5db" />
              <Text className="text-gray-50 mt-4 text-center">
                No tienes deliveries anteriores
              </Text>
            </View>
          ) : (
            deliveries.map(delivery => (
              <View
                key={delivery.id}
                className="bg-[#1a1a1a] rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
              >
                {/* Header del delivery */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Package size={20} color="#d4af37" />
                    <Text className="text-sm font-semibold text-gray-50 ml-2">
                      {formatDate(delivery.created_at)}
                    </Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${getStatusColor(
                      delivery.status,
                    )}`}
                  >
                    <Text className="text-xs font-semibold">
                      {getStatusText(delivery.status)}
                    </Text>
                  </View>
                </View>

                {/* Dirección */}
                <View className="flex-row items-start mb-3">
                  <MapPin size={16} color="#6b7280" />
                  <Text className="flex-1 text-sm text-gray-50 ml-2">
                    {delivery.delivery_address}
                  </Text>
                </View>

                {/* Información adicional */}
                <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
                  {delivery.delivery_order && (
                    <Text className="text-lg font-bold text-[#d4af37]">
                      ${delivery.delivery_order.total_amount.toFixed(2)}
                    </Text>
                  )}
                  {delivery.delivered_at && (
                    <View className="flex-row items-center">
                      <Clock size={14} color="#d4af37" />
                      <Text className="text-xs text-gray-50 ml-1">
                        {new Date(delivery.delivered_at).toLocaleTimeString(
                          "es-AR",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Botón de encuesta - solo para deliveries entregados */}
                {delivery.status === "delivered" && (
                  <View className="mt-3 pt-3 border-t border-gray-100">
                    {delivery.survey_completed ? (
                      <View className="bg-green-50 rounded-lg p-3 flex-row items-center justify-center">
                        <FileText size={16} color="#16a34a" />
                        <Text className="text-green-600 font-semibold ml-2 text-sm">
                          Encuesta completada
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() =>
                          navigation.navigate("DeliverySurvey", {
                            deliveryId: delivery.id,
                          })
                        }
                        className="bg-[#d4af37] rounded-lg p-3 flex-row items-center justify-center"
                      >
                        <FileText size={18} color="#1a1a1a" />
                        <Text className="text-[#1a1a1a] font-bold ml-2">
                          Responder encuesta
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DeliveryHistoryScreen;
