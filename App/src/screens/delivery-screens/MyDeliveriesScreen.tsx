import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import {
  Package,
  MapPin,
  Clock,
  DollarSign,
  User,
  Navigation,
  Phone,
  MessageCircle,
} from "lucide-react-native";
import { useAuth } from "../../auth/useAuth";
import api from "../../api/axios";
import type { DeliveryWithOrder } from "../../types/Delivery";
import ChefLoading from "../../components/common/ChefLoading";
import CustomAlert from "../../components/common/CustomAlert";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyDeliveriesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryWithOrder[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Fetch deliveries activos del repartidor
  const fetchMyDeliveries = useCallback(async () => {
    try {
      const response = await api.get("/deliveries/driver");

      if (response.data.success) {
        setActiveDeliveries(response.data.deliveries || []);
      }
    } catch (error: any) {
      console.error("❌ Error obteniendo mis deliveries:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMyDeliveries();

    // Listener para refrescar cuando se vuelve a esta pantalla
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("🔄 MyDeliveries pantalla enfocada, refrescando lista...");
      fetchMyDeliveries();
    });

    return unsubscribe;
  }, [fetchMyDeliveries, navigation]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMyDeliveries();
  };

  const handleNavigateToMap = (delivery: DeliveryWithOrder) => {
    if (!delivery.delivery_latitude || !delivery.delivery_longitude) {
      showCustomAlert(
        "Error",
        "Este pedido no tiene coordenadas de entrega válidas",
        "error",
        [{ text: "OK", onPress: () => setAlertVisible(false) }],
      );
      return;
    }

    navigation.navigate("DeliveryTracking", {
      deliveryId: delivery.id,
    });
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

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return "Hace un momento";

    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] justify-center items-center">
        <ChefLoading size="large" text="Cargando mis entregas..." />
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
            Mis Entregas Activas
          </Text>
          <Text className="text-gray-400 text-base">
            Pedidos que estás entregando ahora
          </Text>
        </View>

        {/* Lista de deliveries activos */}
        {activeDeliveries.length === 0 ? (
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
              No tienes entregas activas
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">
              Toma un pedido desde la pantalla principal para comenzar
            </Text>
          </View>
        ) : (
          <View className="space-y-4">
            {activeDeliveries.map(delivery => (
              <View
                key={delivery.id}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#8b5cf6",
                }}
              >
                {/* Badge de estado y tiempo */}
                <View className="flex-row items-center justify-between mb-3">
                  <View
                    style={{
                      backgroundColor: "#8b5cf6",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Navigation size={14} color="#ffffff" />
                    <Text className="text-white text-xs font-semibold ml-2">
                      EN CAMINO
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-xs">
                    {formatTimeAgo(delivery.on_the_way_at)}
                  </Text>
                </View>

                {/* Info del cliente */}
                <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-gray-700">
                  <View className="flex-row items-center flex-1">
                    <User size={18} color="#d4af37" />
                    <Text className="text-white text-base font-semibold ml-2">
                      {delivery.user?.first_name} {delivery.user?.last_name}
                    </Text>
                  </View>
                  {delivery.user?.phone && (
                    <View className="flex-row items-center">
                      <Phone size={14} color="#22c55e" />
                      <Text className="text-gray-400 text-xs ml-1">
                        {delivery.user.phone}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Dirección */}
                <View className="flex-row items-start mb-3">
                  <MapPin size={18} color="#d4af37" className="mt-1" />
                  <View className="flex-1 ml-2">
                    <Text className="text-gray-400 text-xs mb-1">
                      Dirección de entrega
                    </Text>
                    <Text className="text-white text-sm">
                      {delivery.delivery_address}
                    </Text>
                    {delivery.delivery_notes && (
                      <Text className="text-gray-500 text-xs mt-1 italic">
                        Nota: {delivery.delivery_notes}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Items y monto */}
                <View className="flex-row justify-between mb-4 pb-3 border-b border-gray-700">
                  <View className="flex-row items-center">
                    <Package size={16} color="#d4af37" />
                    <Text className="text-gray-400 text-sm ml-2">
                      {getTotalItems(delivery)} items ({getItemsCount(delivery)}{" "}
                      productos)
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <DollarSign size={16} color="#22c55e" />
                    <Text className="text-white text-base font-bold ml-1">
                      {formatCurrency(
                        delivery.delivery_order?.total_amount || 0,
                      )}
                    </Text>
                  </View>
                </View>

                {/* Botones de acción */}
                <View className="flex-row gap-2">
                  {/* Botón Chat con Cliente */}
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("DeliveryChat", {
                        deliveryId: delivery.id,
                      })
                    }
                    style={{
                      backgroundColor: "#ef4444",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MessageCircle size={18} color="#ffffff" />
                    <Text className="text-white text-sm font-bold ml-2">
                      Chat
                    </Text>
                  </TouchableOpacity>

                  {/* Botón Ver en Mapa */}
                  <TouchableOpacity
                    onPress={() => handleNavigateToMap(delivery)}
                    style={{
                      flex: 1,
                      backgroundColor: "#8b5cf6",
                      paddingVertical: 12,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Navigation size={18} color="#ffffff" />
                    <Text className="text-white text-sm font-bold ml-2">
                      Ver en Mapa
                    </Text>
                  </TouchableOpacity>
                </View>
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
