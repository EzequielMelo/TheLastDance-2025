import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  Package,
  MapPin,
  Clock,
  DollarSign,
  User,
  CheckCircle,
} from "lucide-react-native";
import { useAuth } from "../../auth/useAuth";
import api from "../../api/axios";
import type { DeliveryWithOrder } from "../../types/Delivery";
import ChefLoading from "../../components/common/ChefLoading";
import CustomAlert from "../../components/common/CustomAlert";

export default function DriverDeliveriesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [readyDeliveries, setReadyDeliveries] = useState<DeliveryWithOrder[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [takingDeliveryId, setTakingDeliveryId] = useState<string | null>(null);

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

  // Fetch deliveries listos para tomar
  const fetchReadyDeliveries = useCallback(async () => {
    try {
      const response = await api.get("/deliveries/ready");

      if (response.data.success) {
        setReadyDeliveries(response.data.deliveries || []);
      }
    } catch (error: any) {
      console.error("❌ Error obteniendo deliveries listos:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReadyDeliveries();
  }, [fetchReadyDeliveries]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchReadyDeliveries();
  };

  const handleTakeDelivery = async (deliveryId: string) => {
    showCustomAlert(
      "Tomar Pedido",
      "¿Deseas tomar este pedido? Se cambiará automáticamente al estado 'En camino'.",
      "warning",
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => setAlertVisible(false),
        },
        {
          text: "Tomar Pedido",
          style: "default",
          onPress: async () => {
            setAlertVisible(false);
            try {
              setTakingDeliveryId(deliveryId);

              const response = await api.post(`/deliveries/${deliveryId}/take`);

              if (response.data.success) {
                showCustomAlert(
                  "¡Éxito!",
                  "Has tomado el pedido exitosamente. Ahora está en estado 'En camino'.",
                  "success",
                  [
                    {
                      text: "OK",
                      onPress: () => {
                        setAlertVisible(false);
                        fetchReadyDeliveries();
                      },
                    },
                  ],
                );
              }
            } catch (error: any) {
              console.error("❌ Error tomando delivery:", error);
              showCustomAlert(
                "Error",
                error.response?.data?.error || "No se pudo tomar el pedido",
                "error",
                [{ text: "OK", onPress: () => setAlertVisible(false) }],
              );
            } finally {
              setTakingDeliveryId(null);
            }
          },
        },
      ],
    );
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getItemsCount = (delivery: DeliveryWithOrder) => {
    return delivery.delivery_order?.items?.length || 0;
  };

  const getTotalItems = (delivery: DeliveryWithOrder) => {
    const items = delivery.delivery_order?.items || [];
    return items.reduce(
      (sum: number, item: any) => sum + (item.quantity || 1),
      0,
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] justify-center items-center">
        <ChefLoading size="large" text="Cargando pedidos disponibles..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#1a1a1a]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#d4af37"
            colors={["#d4af37"]}
          />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-white text-2xl font-bold mb-2">
            Pedidos Disponibles
          </Text>
          <Text className="text-gray-400 text-base">
            Toma un pedido para comenzar a entregar
          </Text>
        </View>

        {/* Lista de deliveries listos */}
        {readyDeliveries.length === 0 ? (
          <View
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: 12,
              padding: 32,
              alignItems: "center",
            }}
          >
            <Package size={48} color="#6b7280" />
            <Text className="text-gray-400 text-base mt-4 text-center">
              No hay pedidos disponibles en este momento
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">
              Los pedidos aparecerán aquí cuando estén listos para entregar
            </Text>
          </View>
        ) : (
          <View className="space-y-4">
            {readyDeliveries.map(delivery => (
              <View
                key={delivery.id}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1.5,
                  borderColor: "#22c55e",
                }}
              >
                {/* Badge de estado */}
                <View className="flex-row items-center mb-3">
                  <View
                    style={{
                      backgroundColor: "#22c55e",
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <CheckCircle size={16} color="#ffffff" />
                    <Text className="text-white text-sm font-semibold ml-2">
                      LISTO PARA ENTREGAR
                    </Text>
                  </View>
                </View>

                {/* Info del cliente */}
                <View className="flex-row items-center mb-4 pb-4 border-b border-gray-700">
                  <User size={22} color="#d4af37" />
                  <Text className="text-white text-lg font-semibold ml-3">
                    {delivery.user?.first_name} {delivery.user?.last_name}
                  </Text>
                </View>

                {/* Dirección */}
                <View className="flex-row items-start mb-4">
                  <MapPin size={22} color="#d4af37" className="mt-1" />
                  <View className="flex-1 ml-3">
                    <Text className="text-gray-400 text-sm mb-2">
                      Dirección de entrega
                    </Text>
                    <Text className="text-white text-base leading-6">
                      {delivery.delivery_address}
                    </Text>
                    {delivery.delivery_notes && (
                      <Text className="text-gray-400 text-sm mt-2 italic">
                        Nota: {delivery.delivery_notes}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Items y monto */}
                <View className="flex-row justify-between mb-4 pb-4 border-b border-gray-700">
                  <View className="flex-row items-center">
                    <Package size={20} color="#d4af37" />
                    <Text className="text-gray-400 text-base ml-2">
                      {getTotalItems(delivery)} items ({getItemsCount(delivery)}{" "}
                      productos)
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <DollarSign size={20} color="#22c55e" />
                    <Text className="text-white text-lg font-bold ml-1">
                      {formatCurrency(
                        delivery.delivery_order?.total_amount || 0,
                      )}
                    </Text>
                  </View>
                </View>

                {/* Tiempo estimado */}
                {delivery.estimated_time_minutes && (
                  <View className="flex-row items-center mb-4">
                    <Clock size={20} color="#d4af37" />
                    <Text className="text-gray-400 text-base ml-2">
                      Tiempo estimado: {delivery.estimated_time_minutes} min
                    </Text>
                  </View>
                )}

                {/* Botón Tomar Pedido */}
                <TouchableOpacity
                  onPress={() => handleTakeDelivery(delivery.id)}
                  disabled={takingDeliveryId === delivery.id}
                  style={{
                    backgroundColor:
                      takingDeliveryId === delivery.id ? "#6b7280" : "#22c55e",
                    paddingVertical: 16,
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  {takingDeliveryId === delivery.id ? (
                    <Text className="text-white text-lg font-bold">
                      Tomando pedido...
                    </Text>
                  ) : (
                    <Text className="text-white text-lg font-bold">
                      Tomar Pedido
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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
}
