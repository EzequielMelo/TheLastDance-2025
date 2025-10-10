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
  Package,
  Settings,
  Check,
  Square,
} from "lucide-react-native";
import {
  getWaiterActiveOrders,
  getWaiterPendingBatches,
  waiterItemsAction,
  rejectIndividualItems,
  approveIndividualItems,
} from "../../api/orders";
import type { Order } from "../../types/Order";

interface PendingBatch {
  order_id: string;
  batch_id: string;
  order: any;
  items: any[];
  created_at: string;
  total_items: number;
  total_amount: number;
  max_prep_time: number;
}

export default function WaiterOrdersScreen() {
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<{
    [batchKey: string]: string[];
  }>({});
  const [individualMode, setIndividualMode] = useState<{
    [batchKey: string]: boolean;
  }>({});

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

      const [pendingBatchesResult, active] = await Promise.all([
        getWaiterPendingBatches(),
        getWaiterActiveOrders(),
      ]);

      setPendingBatches(pendingBatchesResult);
      setActiveOrders(active);
    } catch (error: any) {
      console.error("Error obteniendo datos del mozo:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBatchAction = async (
    orderId: string,
    batchItems: any[],
    action: "accept" | "reject",
  ) => {
    try {
      const batchKey = `${orderId}_${batchItems[0]?.batch_id}`;
      setActionLoading(batchKey);

      // Obtener IDs de todos los items de la tanda
      const itemIds = batchItems.map(item => item.id);

      await waiterItemsAction(
        orderId,
        itemIds,
        action,
        action === "reject"
          ? "No disponemos de stock de algunos productos"
          : undefined,
      );

      Alert.alert(
        "Éxito",
        `Tanda ${action === "accept" ? "aceptada" : "rechazada"} correctamente`,
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

  const toggleIndividualMode = (batchKey: string) => {
    setIndividualMode(prev => ({
      ...prev,
      [batchKey]: !prev[batchKey],
    }));
    // Limpiar selección cuando cambiamos de modo
    setSelectedItems(prev => ({
      ...prev,
      [batchKey]: [],
    }));
  };

  const toggleItemSelection = (batchKey: string, itemId: string) => {
    setSelectedItems(prev => {
      const currentSelection = prev[batchKey] || [];
      const isSelected = currentSelection.includes(itemId);

      return {
        ...prev,
        [batchKey]: isSelected
          ? currentSelection.filter(id => id !== itemId)
          : [...currentSelection, itemId],
      };
    });
  };

  const handleIndividualAction = async (
    orderId: string,
    batchKey: string,
    action: "accept" | "reject",
  ) => {
    const selectedItemIds = selectedItems[batchKey] || [];

    if (selectedItemIds.length === 0) {
      Alert.alert("Error", "Selecciona al menos un item");
      return;
    }

    try {
      setActionLoading(batchKey);

      if (action === "accept") {
        await approveIndividualItems(orderId, selectedItemIds);
        Alert.alert("Éxito", `${selectedItemIds.length} items aprobados`);
      } else {
        await rejectIndividualItems(
          orderId,
          selectedItemIds,
          "Producto sin stock disponible",
        );
        Alert.alert(
          "Éxito",
          `${selectedItemIds.length} items rechazados. El cliente puede reemplazarlos.`,
        );
      }

      // Limpiar selección y modo individual
      setSelectedItems(prev => ({ ...prev, [batchKey]: [] }));
      setIndividualMode(prev => ({ ...prev, [batchKey]: false }));

      // Refrescar datos
      await fetchOrders();
    } catch (error: any) {
      console.error("Error procesando acción individual:", error);
      Alert.alert("Error", error.message || "Error procesando la acción");
    } finally {
      setActionLoading(null);
    }
  };

  const getTotalPendingItems = () => {
    return pendingBatches.reduce(
      (total, batch) => total + batch.total_items,
      0,
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  const getCategoryIcon = (category: string) => {
    return category === "plato" ? ChefHat : Coffee;
  };

  const getCategoryColor = (category: string) => {
    return category === "plato" ? "#ef4444" : "#3b82f6";
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <RefreshCw size={32} color="#d4af37" />
        <Text style={{ color: "white", marginTop: 16, fontSize: 16 }}>
          Cargando tandas...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={{ flex: 1 }}
    >
      {/* Header */}
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
          <Package size={16} color="#d4af37" />
          <Text
            style={{
              color: "#d4af37",
              fontSize: 14,
              fontWeight: "500",
              marginLeft: 8,
            }}
          >
            {pendingBatches.length} tandas pendientes • {getTotalPendingItems()}{" "}
            items • {activeOrders.length} órdenes activas
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
        {pendingBatches.length === 0 && activeOrders.length === 0 ? (
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
              No hay tandas pendientes de aprobación
            </Text>
          </View>
        ) : (
          <>
            {/* Sección de Tandas Pendientes */}
            {pendingBatches.length > 0 && (
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
                  <Package size={20} color="#3b82f6" />
                  <Text
                    style={{
                      color: "#3b82f6",
                      fontSize: 18,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                  >
                    Tandas Pendientes ({pendingBatches.length})
                  </Text>
                </View>

                {pendingBatches.map((batch, batchIndex) => {
                  const batchKey = `${batch.order_id}_${batch.batch_id}`;
                  const isProcessing = actionLoading === batchKey;

                  return (
                    <View
                      key={batchKey}
                      style={{
                        backgroundColor: "rgba(59, 130, 246, 0.05)",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: "rgba(59, 130, 246, 0.3)",
                      }}
                    >
                      {/* Header de la tanda */}
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
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 4,
                            }}
                          >
                            {batch.order.user?.profile_image ? (
                              <Image
                                source={{ uri: batch.order.user.profile_image }}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  marginRight: 8,
                                }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  backgroundColor: "#3b82f6",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  marginRight: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "white",
                                    fontWeight: "600",
                                    fontSize: 14,
                                  }}
                                >
                                  {batch.order.user?.first_name
                                    ?.charAt(0)
                                    .toUpperCase() || "U"}
                                </Text>
                              </View>
                            )}

                            <View>
                              <Text
                                style={{
                                  color: "white",
                                  fontSize: 16,
                                  fontWeight: "600",
                                }}
                              >
                                Mesa {batch.order.table?.number || "Sin mesa"}
                              </Text>
                              <Text
                                style={{
                                  color: "#d1d5db",
                                  fontSize: 12,
                                }}
                              >
                                {batch.order.user
                                  ? `${batch.order.user.first_name} ${batch.order.user.last_name}`
                                  : "Cliente"}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: "rgba(59, 130, 246, 0.1)",
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              alignSelf: "flex-start",
                            }}
                          >
                            <Package size={12} color="#3b82f6" />
                            <Text
                              style={{
                                color: "#3b82f6",
                                fontSize: 12,
                                fontWeight: "500",
                                marginLeft: 4,
                              }}
                            >
                              Tanda #{batchIndex + 1}
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
                            {formatPrice(batch.total_amount)}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 2,
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
                              {new Date(batch.created_at).toLocaleTimeString(
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

                      {/* Items de la tanda */}
                      <View style={{ marginBottom: 16 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: "#3b82f6",
                              fontSize: 14,
                              fontWeight: "600",
                            }}
                          >
                            Items de la tanda ({batch.total_items}):
                          </Text>

                          <TouchableOpacity
                            onPress={() => toggleIndividualMode(batchKey)}
                            style={{
                              backgroundColor: individualMode[batchKey]
                                ? "#d4af37"
                                : "rgba(212, 175, 55, 0.2)",
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Settings
                              size={12}
                              color={
                                individualMode[batchKey] ? "#1a1a1a" : "#d4af37"
                              }
                            />
                            <Text
                              style={{
                                color: individualMode[batchKey]
                                  ? "#1a1a1a"
                                  : "#d4af37",
                                fontSize: 12,
                                fontWeight: "500",
                                marginLeft: 4,
                              }}
                            >
                              Individual
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {batch.items.map((item, itemIndex) => {
                          const CategoryIcon = getCategoryIcon(
                            item.menu_item?.category,
                          );
                          const categoryColor = getCategoryColor(
                            item.menu_item?.category,
                          );
                          const isSelected = (
                            selectedItems[batchKey] || []
                          ).includes(item.id);
                          const isIndividualMode = individualMode[batchKey];

                          return (
                            <TouchableOpacity
                              key={`${item.id}-${itemIndex}`}
                              onPress={() =>
                                isIndividualMode &&
                                toggleItemSelection(batchKey, item.id)
                              }
                              disabled={!isIndividualMode}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: isSelected
                                  ? "rgba(212, 175, 55, 0.2)"
                                  : "rgba(59, 130, 246, 0.1)",
                                borderRadius: 8,
                                padding: 12,
                                marginBottom: 8,
                                borderWidth: isSelected ? 1 : 0,
                                borderColor: "#d4af37",
                              }}
                            >
                              {/* Checkbox en modo individual */}
                              {isIndividualMode && (
                                <View style={{ marginRight: 8 }}>
                                  {isSelected ? (
                                    <View
                                      style={{
                                        backgroundColor: "#d4af37",
                                        borderRadius: 4,
                                        padding: 2,
                                      }}
                                    >
                                      <Check size={12} color="#1a1a1a" />
                                    </View>
                                  ) : (
                                    <Square size={16} color="#6b7280" />
                                  )}
                                </View>
                              )}

                              <View
                                style={{
                                  backgroundColor: categoryColor,
                                  borderRadius: 4,
                                  padding: 4,
                                  marginRight: 8,
                                }}
                              >
                                <CategoryIcon size={12} color="white" />
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
                                  Cantidad: {item.quantity} •{" "}
                                  {item.menu_item?.prep_minutes} min
                                </Text>
                              </View>

                              <Text
                                style={{
                                  color: isSelected ? "#d4af37" : "#3b82f6",
                                  fontSize: 16,
                                  fontWeight: "600",
                                }}
                              >
                                {formatPrice(item.subtotal)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Botones de acción para la tanda */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        {individualMode ? (
                          <>
                            {/* Botones para modo individual */}
                            <TouchableOpacity
                              onPress={() =>
                                handleIndividualAction(
                                  batch.order_id,
                                  batchKey,
                                  "accept",
                                )
                              }
                              disabled={
                                isProcessing ||
                                (selectedItems[batchKey] || []).length === 0
                              }
                              style={{
                                flex: 1,
                                backgroundColor:
                                  (selectedItems[batchKey] || []).length === 0
                                    ? "#374151"
                                    : "#22c55e",
                                borderRadius: 10,
                                padding: 14,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isProcessing ? 0.7 : 1,
                              }}
                            >
                              <Check size={18} color="white" />
                              <Text
                                style={{
                                  color: "white",
                                  fontSize: 14,
                                  fontWeight: "600",
                                  marginLeft: 6,
                                }}
                              >
                                Aceptar (
                                {(selectedItems[batchKey] || []).length})
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() =>
                                handleIndividualAction(
                                  batch.order_id,
                                  batchKey,
                                  "reject",
                                )
                              }
                              disabled={
                                isProcessing ||
                                (selectedItems[batchKey] || []).length === 0
                              }
                              style={{
                                flex: 1,
                                backgroundColor:
                                  (selectedItems[batchKey] || []).length === 0
                                    ? "#374151"
                                    : "#ef4444",
                                borderRadius: 10,
                                padding: 14,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isProcessing ? 0.7 : 1,
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
                                Rechazar (
                                {(selectedItems[batchKey] || []).length})
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            {/* Botones para modo batch (toda la tanda) */}
                            <TouchableOpacity
                              onPress={() =>
                                handleBatchAction(
                                  batch.order_id,
                                  batch.items,
                                  "accept",
                                )
                              }
                              disabled={isProcessing}
                              style={{
                                flex: 1,
                                backgroundColor: "#22c55e",
                                borderRadius: 10,
                                padding: 14,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isProcessing ? 0.7 : 1,
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
                                Aceptar Tanda
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() =>
                                handleBatchAction(
                                  batch.order_id,
                                  batch.items,
                                  "reject",
                                )
                              }
                              disabled={isProcessing}
                              style={{
                                flex: 1,
                                backgroundColor: "#ef4444",
                                borderRadius: 10,
                                padding: 14,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isProcessing ? 0.7 : 1,
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
                                Rechazar Tanda
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
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
                    marginTop: pendingBatches.length > 0 ? 32 : 0,
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
