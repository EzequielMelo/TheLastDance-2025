import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  Coffee,
  Users,
  RefreshCw,
  AlertCircle,
} from "lucide-react-native";
import {
  getWaiterActiveOrders,
  getWaiterPendingItems,
  waiterItemsAction,
} from "../../api/orders";
import type { Order } from "../../types/Order";

export default function WaiterOrdersScreen() {
  const [pendingItems, setPendingItems] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [pendingItemsResult, active] = await Promise.all([
        getWaiterPendingItems(),
        getWaiterActiveOrders(),
      ]);

      setPendingItems(pendingItemsResult);
      setActiveOrders(active);
    } catch (error: any) {
      console.error("Error obteniendo datos del mozo:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleItemAction = async (
    orderId: string,
    itemIds: string[],
    action: "accept" | "reject",
  ) => {
    try {
      setActionLoading(orderId);
      await waiterItemsAction(orderId, itemIds, action);

      Alert.alert(
        "Éxito",
        `Items ${action === "accept" ? "aceptados" : "rechazados"} correctamente`,
      );

      // Refrescar datos
      await fetchOrders();
    } catch (error: any) {
      console.error("Error procesando acción del mozo:", error);
      Alert.alert("Error", error.message || "Error procesando la acción");
    } finally {
      setActionLoading(null);
    }
  };

  const getTotalPendingItems = () => {
    return pendingItems.reduce((total, order) => {
      return (
        total +
        order.order_items.filter(item => item.status === "pending").length
      );
    }, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <RefreshCw size={32} color="#d4af37" />
        <Text style={{ color: "white", marginTop: 16, fontSize: 16 }}>
          Cargando pedidos...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={{ flex: 1 }}
    >
      <View
        style={{
          paddingTop: 48,
          paddingHorizontal: 24,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.1)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ChefHat size={24} color="#d4af37" />
            <Text
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: "bold",
                marginLeft: 12,
              }}
            >
              Panel del Mozo
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => fetchOrders(true)}
            disabled={refreshing}
            style={{
              backgroundColor: "rgba(212,175,55,0.2)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <RefreshCw
              size={20}
              color="#d4af37"
              style={{
                transform: refreshing ? [{ rotate: "360deg" }] : [],
              }}
            />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(212,175,55,0.1)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Users size={16} color="#d4af37" />
          <Text
            style={{
              color: "#d4af37",
              fontSize: 14,
              fontWeight: "500",
              marginLeft: 8,
            }}
          >
            {getTotalPendingItems()} items pendientes • {activeOrders.length}{" "}
            órdenes activas
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrders(true)}
            tintColor="#d4af37"
          />
        }
      >
        {getTotalPendingItems() === 0 && activeOrders.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 60,
            }}
          >
            <CheckCircle size={48} color="#22c55e" />
            <Text
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: "600",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              ¡Todo al día!
            </Text>
            <Text
              style={{
                color: "#6b7280",
                fontSize: 14,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              No hay items pendientes de aprobación
            </Text>
          </View>
        ) : (
          <>
            {/* Sección de Items Pendientes de Aprobación */}
            {pendingItems.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <AlertCircle size={20} color="#3b82f6" />
                  <Text
                    style={{
                      color: "#3b82f6",
                      fontSize: 18,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                  >
                    Items Pendientes de Aprobación ({getTotalPendingItems()})
                  </Text>
                </View>

                {pendingItems.map(order => {
                  const pendingOrderItems = order.order_items.filter(
                    item => item.status === "pending",
                  );

                  if (pendingOrderItems.length === 0) return null;

                  return (
                    <View
                      key={`pending-items-${order.id}`}
                      style={{
                        backgroundColor: "rgba(59, 130, 246, 0.05)",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: "rgba(59, 130, 246, 0.3)",
                      }}
                    >
                      {/* Header de la orden */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 16,
                          paddingBottom: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          {order.user?.profile_image ? (
                            <Image
                              source={{ uri: order.user.profile_image }}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 12,
                              }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: "#3b82f6",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 12,
                              }}
                            >
                              <Text
                                style={{
                                  color: "white",
                                  fontWeight: "600",
                                  fontSize: 16,
                                }}
                              >
                                {order.user?.first_name
                                  ?.charAt(0)
                                  .toUpperCase() || "U"}
                              </Text>
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: "white",
                                fontSize: 18,
                                fontWeight: "600",
                              }}
                            >
                              Mesa {order.table?.number || "Sin mesa"}
                            </Text>
                            <Text
                              style={{
                                color: "#d1d5db",
                                fontSize: 14,
                              }}
                            >
                              {order.user
                                ? `${order.user.first_name} ${order.user.last_name}`
                                : "Cliente"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={{
                              color: "#3b82f6",
                              fontSize: 16,
                              fontWeight: "600",
                            }}
                          >
                            {pendingOrderItems.length} item
                            {pendingOrderItems.length > 1 ? "s" : ""} pendiente
                            {pendingOrderItems.length > 1 ? "s" : ""}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Clock size={12} color="#d1d5db" />
                            <Text
                              style={{
                                color: "#d1d5db",
                                fontSize: 12,
                                marginLeft: 4,
                              }}
                            >
                              {new Date(order.created_at).toLocaleTimeString(
                                "es-AR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Items pendientes */}
                      <View style={{ marginBottom: 16 }}>
                        <Text
                          style={{
                            color: "#3b82f6",
                            fontSize: 14,
                            marginBottom: 12,
                            fontWeight: "600",
                          }}
                        >
                          Items esperando tu aprobación:
                        </Text>

                        {pendingOrderItems.map((item, index) => (
                          <View
                            key={`${item.id}-${index}`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: "rgba(59, 130, 246, 0.1)",
                              borderRadius: 8,
                              padding: 12,
                              marginBottom: 8,
                            }}
                          >
                            <View
                              style={{
                                backgroundColor:
                                  item.menu_item?.category === "plato"
                                    ? "#ef4444"
                                    : "#3b82f6",
                                borderRadius: 4,
                                padding: 4,
                                marginRight: 8,
                              }}
                            >
                              {item.menu_item?.category === "plato" ? (
                                <ChefHat size={12} color="white" />
                              ) : (
                                <Coffee size={12} color="white" />
                              )}
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: "white",
                                  fontSize: 16,
                                  fontWeight: "500",
                                }}
                              >
                                {item.menu_item?.name}
                              </Text>
                              <Text
                                style={{
                                  color: "#9ca3af",
                                  fontSize: 12,
                                }}
                              >
                                Cantidad: {item.quantity}
                              </Text>
                            </View>

                            <Text
                              style={{
                                color: "#3b82f6",
                                fontSize: 16,
                                fontWeight: "600",
                              }}
                            >
                              {formatPrice(item.subtotal)}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Botones de acción para los items pendientes */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            handleItemAction(
                              order.id,
                              pendingOrderItems.map(item => item.id),
                              "accept",
                            )
                          }
                          disabled={actionLoading === order.id}
                          style={{
                            flex: 1,
                            backgroundColor: "#22c55e",
                            borderRadius: 10,
                            padding: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: actionLoading === order.id ? 0.7 : 1,
                          }}
                        >
                          <CheckCircle size={18} color="white" />
                          <Text
                            style={{
                              color: "white",
                              fontSize: 14,
                              fontWeight: "600",
                              marginLeft: 6,
                            }}
                          >
                            Aceptar Todos
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            handleItemAction(
                              order.id,
                              pendingOrderItems.map(item => item.id),
                              "reject",
                            )
                          }
                          disabled={actionLoading === order.id}
                          style={{
                            flex: 1,
                            backgroundColor: "#ef4444",
                            borderRadius: 10,
                            padding: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: actionLoading === order.id ? 0.7 : 1,
                          }}
                        >
                          <XCircle size={18} color="white" />
                          <Text
                            style={{
                              color: "white",
                              fontSize: 14,
                              fontWeight: "600",
                              marginLeft: 6,
                            }}
                          >
                            Rechazar Todos
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Sección de Órdenes Activas (solo para información) */}
            {activeOrders.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                    marginTop: pendingItems.length > 0 ? 32 : 0,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(34, 197, 94, 0.3)",
                  }}
                >
                  <CheckCircle size={20} color="#22c55e" />
                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 18,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                  >
                    Órdenes Activas ({activeOrders.length})
                  </Text>
                </View>

                {activeOrders.map(order => (
                  <View
                    key={`active-${order.id}`}
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 20,
                      borderWidth: 1,
                      borderColor: "rgba(34, 197, 94, 0.3)",
                    }}
                  >
                    {/* Header de la orden activa */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 16,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "white",
                            fontSize: 18,
                            fontWeight: "600",
                          }}
                        >
                          Mesa {order.table?.number || "Sin mesa"}
                        </Text>
                        <Text
                          style={{
                            color: "#22c55e",
                            fontSize: 14,
                          }}
                        >
                          {order.is_paid ? "Pagado" : "Por pagar"}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            color: "#22c55e",
                            fontSize: 18,
                            fontWeight: "600",
                          }}
                        >
                          {formatPrice(order.total_amount)}
                        </Text>
                        <Text
                          style={{
                            color: "#d1d5db",
                            fontSize: 12,
                          }}
                        >
                          {order.order_items.length} item
                          {order.order_items.length > 1 ? "s" : ""}
                        </Text>
                      </View>
                    </View>

                    {/* Info adicional */}
                    <View
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.1)",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: "#22c55e",
                          fontSize: 12,
                          textAlign: "center",
                        }}
                      >
                        ℹ️ Esta orden está en proceso. Los cambios de estado se
                        manejan desde la cocina.
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}
