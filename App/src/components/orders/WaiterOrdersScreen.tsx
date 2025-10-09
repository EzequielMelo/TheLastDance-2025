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
  Minus,
} from "lucide-react-native";
import {
  getWaiterPendingOrders,
  getWaiterActiveOrders,
  waiterOrderAction,
} from "../../api/orders";
import type { Order } from "../../types/Order";
import PartialRejectModal from "./PartialRejectModal";

export default function WaiterOrdersScreen() {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [partialRejectModal, setPartialRejectModal] = useState<{
    visible: boolean;
    order: Order | null;
  }>({ visible: false, order: null });

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

      const [pending, active] = await Promise.all([
        getWaiterPendingOrders(),
        getWaiterActiveOrders(),
      ]);

      setPendingOrders(pending);
      setActiveOrders(active);
    } catch (error: any) {
      console.error("Error obteniendo órdenes pendientes:", error);
      Alert.alert("Error", "No se pudieron cargar las órdenes pendientes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleOrderAction = async (
    orderId: string,
    action: "accept" | "reject",
  ) => {
    try {
      setActionLoading(orderId);
      const response = await waiterOrderAction(orderId, { action });

      if (response.success) {
        // Remover la orden de la lista de pendientes después de aceptar/rechazar
        setPendingOrders(prevOrders =>
          prevOrders.filter(order => order.id !== orderId),
        );

        // Refrescar las órdenes para actualizar la lista de activas
        await fetchOrders();

        const actionText = action === "accept" ? "aceptada" : "rechazada";
        Alert.alert("Éxito", `Orden ${actionText} correctamente`);
      }
    } catch (error: any) {
      console.error(`Error al ${action} orden:`, error);
      Alert.alert("Error", error.message || `No se pudo ${action} la orden`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePartialReject = async (rejectedItemIds: string[]) => {
    if (!partialRejectModal.order) return;

    try {
      setActionLoading(partialRejectModal.order.id);
      const response = await waiterOrderAction(partialRejectModal.order.id, {
        action: "partial",
        rejectedItemIds: rejectedItemIds,
      });

      if (response.success) {
        // Remover la orden de la lista de pendientes (ahora está en estado partial)
        setPendingOrders(prevOrders =>
          prevOrders.filter(order => order.id !== partialRejectModal.order!.id),
        );

        setPartialRejectModal({ visible: false, order: null });
        Alert.alert("Éxito", "Productos rechazados correctamente");
      }
    } catch (error: any) {
      console.error("Error al rechazar productos:", error);
      Alert.alert(
        "Error",
        error.message || "No se pudieron rechazar los productos",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const openPartialRejectModal = (order: Order) => {
    console.log("🔍 Abriendo modal para orden:", {
      orderId: order.id,
      orderItemsCount: order.order_items?.length || 0,
      orderItems: order.order_items,
    });
    setPartialRejectModal({ visible: true, order });
  };

  const closePartialRejectModal = () => {
    setPartialRejectModal({ visible: false, order: null });
  };

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={{ flex: 1 }}
    >
      <View
        style={{
          paddingTop: 48,
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.1)",
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 24,
            fontWeight: "600",
          }}
        >
          Órdenes del Mozo
        </Text>
        <Text style={{ color: "#d1d5db", fontSize: 14, marginTop: 4 }}>
          {pendingOrders.length} pendientes • {activeOrders.length} activas
        </Text>
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
        {loading ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 48,
            }}
          >
            <RefreshCw size={48} color="#d4af37" />
            <Text style={{ color: "white", fontSize: 18, marginTop: 16 }}>
              Cargando órdenes...
            </Text>
          </View>
        ) : pendingOrders.length === 0 && activeOrders.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 48,
            }}
          >
            <CheckCircle size={64} color="#22c55e" />
            <Text
              style={{
                color: "#22c55e",
                fontSize: 20,
                fontWeight: "600",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              ¡Todas las órdenes procesadas!
            </Text>
            <Text
              style={{
                color: "#9ca3af",
                fontSize: 14,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              No hay órdenes pendientes por revisar
            </Text>
          </View>
        ) : (
          <>
            {/* Sección de Órdenes Pendientes */}
            {pendingOrders.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255, 165, 0, 0.3)",
                  }}
                >
                  <Clock size={20} color="#ffa500" />
                  <Text
                    style={{
                      color: "#ffa500",
                      fontSize: 18,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                  >
                    Órdenes Pendientes ({pendingOrders.length})
                  </Text>
                </View>

                {pendingOrders.map(order => (
                  <View
                    key={order.id}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 20,
                      borderWidth: 1,
                      borderColor: "rgba(212,175,55,0.3)",
                    }}
                  >
                    {/* Header de la orden */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
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
                              backgroundColor: "#d4af37",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <Text
                              style={{
                                color: "#1a1a1a",
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
                            color: "#d4af37",
                            fontSize: 18,
                            fontWeight: "600",
                          }}
                        >
                          ${order.total_amount.toFixed(2)}
                        </Text>
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
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

                    {/* Items del pedido */}
                    <View style={{ marginBottom: 16 }}>
                      <Text
                        style={{
                          color: "#d1d5db",
                          fontSize: 14,
                          marginBottom: 8,
                          fontWeight: "500",
                        }}
                      >
                        Items del pedido:
                      </Text>

                      {order.order_items.map((item, index) => (
                        <View
                          key={`${item.id}-${index}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "rgba(255,255,255,0.03)",
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 8,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 2,
                              }}
                            >
                              <View
                                style={{
                                  backgroundColor:
                                    item.menu_item?.category === "plato"
                                      ? "#ef4444"
                                      : "#3b82f6",
                                  borderRadius: 4,
                                  padding: 2,
                                  marginRight: 6,
                                }}
                              >
                                {item.menu_item?.category === "plato" ? (
                                  <ChefHat size={10} color="white" />
                                ) : (
                                  <Coffee size={10} color="white" />
                                )}
                              </View>
                              <Text
                                style={{
                                  color: "white",
                                  fontSize: 15,
                                  fontWeight: "500",
                                }}
                              >
                                {item.menu_item?.name || "Producto"}
                              </Text>
                            </View>

                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                                Cantidad: {item.quantity}
                              </Text>
                              <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                                {item.menu_item?.prep_minutes || 0} min
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={{
                              color: "#d4af37",
                              fontSize: 14,
                              fontWeight: "600",
                            }}
                          >
                            ${item.subtotal.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Tiempo estimado */}
                    <View
                      style={{
                        backgroundColor: "rgba(212,175,55,0.1)",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 16,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <AlertCircle size={16} color="#d4af37" />
                      <Text
                        style={{
                          color: "#d4af37",
                          fontSize: 14,
                          marginLeft: 8,
                          fontWeight: "500",
                        }}
                      >
                        Tiempo estimado: {order.estimated_time} minutos
                      </Text>
                    </View>

                    {/* Botones de acción */}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleOrderAction(order.id, "accept")}
                        disabled={actionLoading === order.id}
                        style={{
                          flex: 1,
                          backgroundColor:
                            actionLoading === order.id ? "#9ca3af" : "#22c55e",
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
                          Aceptar
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => openPartialRejectModal(order)}
                        disabled={actionLoading === order.id}
                        style={{
                          backgroundColor: "#f59e0b",
                          borderRadius: 10,
                          padding: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: actionLoading === order.id ? 0.7 : 1,
                          minWidth: 60,
                        }}
                      >
                        <Minus size={18} color="white" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleOrderAction(order.id, "reject")}
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
                          Rechazar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Sección de Órdenes Activas */}
            {activeOrders.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                    marginTop: pendingOrders.length > 0 ? 32 : 0,
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
                        <View
                          style={{
                            backgroundColor: "#22c55e",
                            borderRadius: 8,
                            padding: 8,
                            marginRight: 12,
                          }}
                        >
                          <Users size={20} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: "white",
                              fontSize: 18,
                              fontWeight: "600",
                            }}
                          >
                            Mesa {(order as any).table?.number || "N/A"}
                          </Text>
                          <Text
                            style={{
                              color: "#22c55e",
                              fontSize: 14,
                              textTransform: "capitalize",
                            }}
                          >
                            Estado: {order.status}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            color: "#22c55e",
                            fontSize: 18,
                            fontWeight: "600",
                          }}
                        >
                          ${order.total_amount?.toFixed(2)}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 4,
                          }}
                        >
                          <Clock size={14} color="#9ca3af" />
                          <Text
                            style={{
                              color: "#9ca3af",
                              fontSize: 12,
                              marginLeft: 4,
                            }}
                          >
                            {new Date(order.created_at).toLocaleTimeString(
                              "es",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Items de la orden activa */}
                    <View style={{ marginBottom: 16 }}>
                      {order.order_items.map((item: any, index: number) => (
                        <View
                          key={`${order.id}-item-${index}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            borderBottomWidth:
                              index < order.order_items.length - 1 ? 1 : 0,
                            borderBottomColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          {/* Removemos la imagen por ahora para evitar problemas */}

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
                                fontSize: 14,
                                fontWeight: "500",
                              }}
                            >
                              {item.menu_item?.name || "Producto"}
                            </Text>
                            <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                              ${item.unit_price?.toFixed(2)} x {item.quantity}
                            </Text>
                          </View>

                          <Text
                            style={{
                              color: "#22c55e",
                              fontSize: 14,
                              fontWeight: "600",
                            }}
                          >
                            ${item.subtotal?.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Información adicional para órdenes activas */}
                    <View
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                        borderRadius: 12,
                        padding: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckCircle size={16} color="#22c55e" />
                      <Text
                        style={{
                          color: "#22c55e",
                          fontSize: 14,
                          fontWeight: "600",
                          marginLeft: 8,
                        }}
                      >
                        Orden en proceso - Mesa asignada
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <PartialRejectModal
        visible={partialRejectModal.visible}
        orderItems={partialRejectModal.order?.order_items || []}
        onClose={closePartialRejectModal}
        onConfirm={handlePartialReject}
        loading={actionLoading === partialRejectModal.order?.id}
      />
    </LinearGradient>
  );
}
