import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  Wine,
  Truck,
  Package,
} from "lucide-react-native";
import { useAuth } from "../../auth/useAuth";
import axios from "axios";
import { API_BASE_URL } from "../../api/config";
import CustomAlert from "../../components/common/CustomAlert";

interface DeliveryOrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status: "pending" | "preparing" | "ready";
  batch_id: string | null;
  menu_item?: {
    name: string;
    category: string;
  };
}

interface DeliveryWithOrder {
  id: string;
  user_id: string;
  delivery_address: string;
  status: string;
  created_at: string;
  delivery_order?: {
    id: string;
    total_amount: number;
    estimated_time: number | null;
    is_paid: boolean;
    delivery_order_items?: DeliveryOrderItem[];
  };
}

const DeliveryOrdersManagementScreen = () => {
  const { token } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<DeliveryWithOrder[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<DeliveryWithOrder[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchOrders = async () => {
    try {
      // Obtener pedidos pendientes de confirmación
      const pendingResponse = await axios.get(
        `${API_BASE_URL}/deliveries/pending`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log(
        "📦 Pedidos pendientes:",
        JSON.stringify(pendingResponse.data.deliveries, null, 2),
      );

      // Verificar items de cada pedido pendiente
      pendingResponse.data.deliveries?.forEach((delivery: any) => {
        const itemCount =
          delivery.delivery_order?.delivery_order_items?.length || 0;
        console.log(`📦 Delivery pendiente ${delivery.id}: ${itemCount} items`);
        if (itemCount > 0) {
          console.log("Items:", delivery.delivery_order.delivery_order_items);
        }
      });

      setPendingOrders(pendingResponse.data.deliveries || []);

      // Obtener pedidos confirmados (para distribuir items)
      const confirmedResponse = await axios.get(
        `${API_BASE_URL}/deliveries/confirmed`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log(
        "✅ Pedidos confirmados:",
        JSON.stringify(confirmedResponse.data.deliveries, null, 2),
      );

      // Verificar items de cada pedido confirmado
      confirmedResponse.data.deliveries?.forEach((delivery: any) => {
        const itemCount =
          delivery.delivery_order?.delivery_order_items?.length || 0;
        console.log(
          `✅ Delivery confirmado ${delivery.id}: ${itemCount} items`,
        );
        if (itemCount > 0) {
          console.log("Items:", delivery.delivery_order.delivery_order_items);
        }
      });

      setConfirmedOrders(confirmedResponse.data.deliveries || []);
    } catch (error: any) {
      console.error("Error fetching delivery orders:", error);
      showCustomAlert("Error", "No se pudieron cargar los pedidos", "error", [
        { text: "OK", onPress: () => setAlertVisible(false) },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleAcceptOrder = async (deliveryId: string) => {
    showCustomAlert(
      "Confirmar Pedido",
      "¿Aceptar este pedido de delivery?",
      "warning",
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => setAlertVisible(false),
        },
        {
          text: "Aceptar",
          onPress: async () => {
            setAlertVisible(false);
            try {
              await axios.put(
                `${API_BASE_URL}/deliveries/${deliveryId}/status`,
                { status: "confirmed" },
                { headers: { Authorization: `Bearer ${token}` } },
              );
              showCustomAlert("Éxito", "Pedido confirmado", "success", [
                {
                  text: "OK",
                  onPress: () => {
                    setAlertVisible(false);
                    fetchOrders();
                  },
                },
              ]);
            } catch (error: any) {
              console.error("Error accepting order:", error);
              showCustomAlert(
                "Error",
                error.response?.data?.error || "No se pudo confirmar el pedido",
                "error",
                [{ text: "OK", onPress: () => setAlertVisible(false) }],
              );
            }
          },
        },
      ],
    );
  };

  const handleRejectOrder = async (deliveryId: string) => {
    showCustomAlert(
      "Rechazar Pedido",
      "¿Está seguro de rechazar este pedido?",
      "warning",
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => setAlertVisible(false),
        },
        {
          text: "Rechazar",
          style: "destructive",
          onPress: async () => {
            setAlertVisible(false);
            try {
              await axios.put(
                `${API_BASE_URL}/deliveries/${deliveryId}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${token}` } },
              );
              showCustomAlert(
                "Pedido Rechazado",
                "El pedido ha sido cancelado",
                "success",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      setAlertVisible(false);
                      fetchOrders();
                    },
                  },
                ],
              );
            } catch (error: any) {
              console.error("Error rejecting order:", error);
              showCustomAlert(
                "Error",
                "No se pudo rechazar el pedido",
                "error",
                [{ text: "OK", onPress: () => setAlertVisible(false) }],
              );
            }
          },
        },
      ],
    );
  };

  const renderPendingOrder = (delivery: DeliveryWithOrder) => (
    <View
      key={delivery.id}
      className="rounded-lg p-4 mb-4 border-2 border-yellow-500"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Clock size={24} color="#f59e0b" />
          <Text className="text-white text-lg font-bold ml-2">
            Pedido Pendiente
          </Text>
        </View>
        <Text className="text-yellow-500 font-semibold">
          $
          {delivery.delivery_order?.total_amount
            ? delivery.delivery_order.total_amount.toFixed(2)
            : "0.00"}
        </Text>
      </View>

      <Text className="text-gray-300 mb-2">
        Dirección: {delivery.delivery_address}
      </Text>

      {delivery.delivery_order?.delivery_order_items &&
        delivery.delivery_order.delivery_order_items.length > 0 && (
          <View className="mb-3">
            <Text className="text-gray-400 text-sm font-semibold mb-1">
              Items ({delivery.delivery_order.delivery_order_items.length}):
            </Text>
            {delivery.delivery_order.delivery_order_items.map((item, index) => {
              console.log(`Renderizando item ${index + 1}:`, item);
              return (
                <View
                  key={`${delivery.id}-${item.id}-${index}`}
                  className="ml-2 mb-2 p-2 rounded"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                >
                  <Text className="text-gray-300 text-sm font-semibold">
                    • {item.quantity}x {item.menu_item?.name || "Item"}
                  </Text>
                  <Text className="text-gray-500 text-xs ml-4">
                    ${(item.unit_price / 100).toFixed(2)} | Categoría:{" "}
                    {item.menu_item?.category}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => handleAcceptOrder(delivery.id)}
          className="flex-1 bg-green-600 py-3 rounded-lg flex-row items-center justify-center"
        >
          <CheckCircle size={20} color="white" />
          <Text className="text-white font-bold ml-2">Aceptar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleRejectOrder(delivery.id)}
          className="flex-1 bg-red-600 py-3 rounded-lg flex-row items-center justify-center"
        >
          <XCircle size={20} color="white" />
          <Text className="text-white font-bold ml-2">Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmedOrder = (delivery: DeliveryWithOrder) => {
    const items = delivery.delivery_order?.delivery_order_items || [];
    const kitchenItems = items.filter(
      item => item.menu_item?.category === "comida",
    );
    const barItems = items.filter(
      item => item.menu_item?.category === "bebida",
    );
    const pendingKitchen = kitchenItems.filter(
      item => item.status === "pending",
    ).length;
    const pendingBar = barItems.filter(
      item => item.status === "pending",
    ).length;

    console.log(`📦 Renderizando delivery confirmado ${delivery.id}:`, {
      totalItems: items.length,
      kitchenItems: kitchenItems.length,
      barItems: barItems.length,
      items: items.map(i => ({
        name: i.menu_item?.name,
        category: i.menu_item?.category,
        status: i.status,
      })),
    });

    return (
      <View
        key={delivery.id}
        className="rounded-lg p-4 mb-4 border-2 border-green-500"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <CheckCircle size={24} color="#10b981" />
            <Text className="text-white text-lg font-bold ml-2">
              Confirmado
            </Text>
          </View>
          <Text className="text-green-500 font-semibold">
            $
            {delivery.delivery_order?.total_amount
              ? delivery.delivery_order.total_amount.toFixed(2)
              : "0.00"}
          </Text>
        </View>

        <Text className="text-gray-300 mb-3">
          Dirección: {delivery.delivery_address}
        </Text>

        {/* Mostrar todos los items si no hay categorías o no hay items separados */}
        {items.length > 0 &&
        kitchenItems.length === 0 &&
        barItems.length === 0 ? (
          <View
            className="mb-3 rounded-lg p-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          >
            <View className="flex-row items-center mb-2">
              <Package size={20} color="#d4af37" />
              <Text className="text-white font-semibold ml-2">
                Items del Pedido ({items.length})
              </Text>
            </View>
            {items.map((item, index) => (
              <View
                key={`all-${delivery.id}-${item.id}-${index}`}
                className="flex-row justify-between items-center ml-2 mb-2"
              >
                <Text className="text-gray-300 text-sm flex-1">
                  • {item.quantity}x {item.menu_item?.name || "Item"}
                </Text>
                <View
                  className={`px-2 py-1 rounded ${
                    item.status === "pending"
                      ? "bg-yellow-900"
                      : item.status === "preparing"
                        ? "bg-blue-900"
                        : "bg-green-900"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      item.status === "pending"
                        ? "text-yellow-500"
                        : item.status === "preparing"
                          ? "text-blue-400"
                          : "text-green-500"
                    }`}
                  >
                    {item.status === "pending"
                      ? "Pendiente"
                      : item.status === "preparing"
                        ? "Preparando"
                        : "Listo"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Sección de Cocina */}
        {kitchenItems.length > 0 && (
          <View
            className="mb-3 rounded-lg p-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <ChefHat size={20} color="#d4af37" />
                <Text className="text-white font-semibold ml-2">Cocina</Text>
              </View>
              {pendingKitchen === 0 ? (
                <View className="flex-row items-center">
                  <CheckCircle size={16} color="#10b981" />
                  <Text className="text-green-500 text-xs ml-1 font-semibold">
                    Todos preparando
                  </Text>
                </View>
              ) : (
                <View className="bg-blue-600 px-2 py-1 rounded">
                  <Text className="text-white text-xs font-semibold">
                    Auto-enviado
                  </Text>
                </View>
              )}
            </View>
            {kitchenItems.map((item, index) => {
              console.log(`🍳 Renderizando item cocina ${index + 1}:`, item);
              return (
                <View
                  key={`kitchen-${delivery.id}-${item.id}-${index}`}
                  className="flex-row justify-between items-center ml-2 mb-1"
                >
                  <Text className="text-gray-300 text-sm flex-1">
                    • {item.quantity}x {item.menu_item?.name}
                  </Text>
                  <View
                    className={`px-2 py-1 rounded ${
                      item.status === "pending"
                        ? "bg-yellow-900"
                        : item.status === "preparing"
                          ? "bg-blue-900"
                          : "bg-green-900"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        item.status === "pending"
                          ? "text-yellow-500"
                          : item.status === "preparing"
                            ? "text-blue-400"
                            : "text-green-500"
                      }`}
                    >
                      {item.status === "pending"
                        ? "Pendiente"
                        : item.status === "preparing"
                          ? "Preparando"
                          : "Listo"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Sección de Bar */}
        {barItems.length > 0 && (
          <View
            className="mb-3 rounded-lg p-3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Wine size={20} color="#d4af37" />
                <Text className="text-white font-semibold ml-2">Bar</Text>
              </View>
              {pendingBar === 0 ? (
                <View className="flex-row items-center">
                  <CheckCircle size={16} color="#10b981" />
                  <Text className="text-green-500 text-xs ml-1 font-semibold">
                    Todos preparando
                  </Text>
                </View>
              ) : (
                <View className="bg-purple-600 px-2 py-1 rounded">
                  <Text className="text-white text-xs font-semibold">
                    Auto-enviado
                  </Text>
                </View>
              )}
            </View>
            {barItems.map((item, index) => {
              console.log(`🍷 Renderizando item bar ${index + 1}:`, item);
              return (
                <View
                  key={`bar-${delivery.id}-${item.id}-${index}`}
                  className="flex-row justify-between items-center ml-2 mb-1"
                >
                  <Text className="text-gray-300 text-sm flex-1">
                    • {item.quantity}x {item.menu_item?.name}
                  </Text>
                  <View
                    className={`px-2 py-1 rounded ${
                      item.status === "pending"
                        ? "bg-yellow-900"
                        : item.status === "preparing"
                          ? "bg-blue-900"
                          : "bg-green-900"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        item.status === "pending"
                          ? "text-yellow-500"
                          : item.status === "preparing"
                            ? "text-blue-400"
                            : "text-green-500"
                      }`}
                    >
                      {item.status === "pending"
                        ? "Pendiente"
                        : item.status === "preparing"
                          ? "Preparando"
                          : "Listo"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] items-center justify-center">
        <Truck size={48} color="#d4af37" />
        <Text className="text-white text-lg mt-4">Cargando pedidos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#1a1a1a]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#d4af37"
            colors={["#d4af37"]}
          />
        }
      >
        <View className="p-4">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-white text-2xl font-bold mb-2">
              Gestión de Deliveries
            </Text>
            <Text className="text-gray-400 mb-2">
              Al aceptar un pedido, los items se envían automáticamente a cocina
              y bar
            </Text>
          </View>

          {/* Pedidos Pendientes */}
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Clock size={24} color="#f59e0b" />
              <Text className="text-white text-xl font-bold ml-2">
                Pendientes ({pendingOrders.length})
              </Text>
            </View>
            {pendingOrders.length === 0 ? (
              <View
                className="rounded-lg p-6 items-center"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <Text className="text-gray-400">No hay pedidos pendientes</Text>
              </View>
            ) : (
              pendingOrders.map(renderPendingOrder)
            )}
          </View>

          {/* Pedidos Confirmados */}
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Truck size={24} color="#10b981" />
              <Text className="text-white text-xl font-bold ml-2">
                Confirmados ({confirmedOrders.length})
              </Text>
            </View>
            {confirmedOrders.length === 0 ? (
              <View
                className="rounded-lg p-6 items-center"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <Text className="text-gray-400">
                  No hay pedidos confirmados
                </Text>
              </View>
            ) : (
              confirmedOrders.map(renderConfirmedOrder)
            )}
          </View>
        </View>
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
};

export default DeliveryOrdersManagementScreen;
