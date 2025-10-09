import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChefHat,
  Coffee,
  Clock,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  X,
  Trash2,
} from "lucide-react-native";
import { useCart } from "../../context/CartContext";
import api from "../../api/axios";
import { createOrder, replaceRejectedItems } from "../../api/orders";
import type { CreateOrderRequest, OrderItem } from "../../types/Order";
import OrderStatusView from "../orders/OrderStatusView";
import ModifyRejectedItemsModal from "../orders/ModifyRejectedItemsModal";

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CartModal({ visible, onClose }: CartModalProps) {
  const {
    cartItems,
    pendingOrderItems,
    partialOrderItems,
    userOrders,
    hasPendingOrder,
    hasPartialOrder,
    hasAcceptedOrder,
    acceptedOrderItems,
    acceptedOrderCount,
    acceptedOrderAmount,
    acceptedOrderTime,
    submitToAcceptedOrder,
    cartCount,
    pendingOrderCount,
    partialOrderCount,
    cartAmount,
    pendingOrderAmount,
    partialOrderAmount,
    cartTime,
    pendingOrderTime,
    partialOrderTime,
    updateQuantity,
    removeItem,
    submitOrder,
    submitToPartialOrder,
    refreshOrders,
  } = useCart();

  const [tableId, setTableId] = useState<string | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);

  // Estados para el modal de modificación de items rechazados
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [rejectedItemsToModify, setRejectedItemsToModify] = useState<
    OrderItem[]
  >([]);
  const [availableMenuItems, setAvailableMenuItems] = useState<any[]>([]);

  // Obtener el ID de la mesa del cliente logueado y refrescar órdenes
  useEffect(() => {
    if (visible) {
      fetchUserTable();
      // Refrescar órdenes cada vez que se abre el modal
      refreshOrders().catch(console.error);
    }
  }, [visible]);

  const fetchUserTable = async () => {
    try {
      setLoadingTable(true);
      const response = await api.get("/tables/my-table");

      if (response.data.hasOccupiedTable && response.data.table) {
        setTableId(response.data.table.id);
      } else {
        setTableId(null);
      }
    } catch (error) {
      console.error("Error obteniendo mesa del usuario:", error);
      setTableId(null);
    } finally {
      setLoadingTable(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  const getOrderStatusInfo = (order: any) => {
    if (order.is_paid) {
      return {
        color: "#6b7280",
        text: "Pagado",
        bgColor: "rgba(107, 114, 128, 0.1)",
        borderColor: "rgba(107, 114, 128, 0.2)",
        icon: CheckCircle,
      };
    }

    const items = order.order_items || [];
    const pendingCount = items.filter(
      (item: any) => item.status === "pending",
    ).length;
    const acceptedCount = items.filter(
      (item: any) => item.status === "accepted",
    ).length;
    const preparingCount = items.filter(
      (item: any) => item.status === "preparing",
    ).length;
    const readyCount = items.filter(
      (item: any) => item.status === "ready",
    ).length;
    const deliveredCount = items.filter(
      (item: any) => item.status === "delivered",
    ).length;
    const rejectedCount = items.filter(
      (item: any) => item.status === "rejected",
    ).length;

    // Si hay items pendientes
    if (pendingCount > 0) {
      return {
        color: "#ffa500",
        text: `${pendingCount} item${pendingCount > 1 ? "s" : ""} esperando confirmación`,
        bgColor: "rgba(255, 165, 0, 0.1)",
        borderColor: "rgba(255, 165, 0, 0.2)",
        icon: Clock,
      };
    }

    // Si hay items en preparación
    if (preparingCount > 0) {
      return {
        color: "#f59e0b",
        text: `${preparingCount} item${preparingCount > 1 ? "s" : ""} en preparación`,
        bgColor: "rgba(245, 158, 11, 0.1)",
        borderColor: "rgba(245, 158, 11, 0.2)",
        icon: ChefHat,
      };
    }

    // Si hay items listos
    if (readyCount > 0) {
      return {
        color: "#10b981",
        text: `${readyCount} item${readyCount > 1 ? "s" : ""} listo${readyCount > 1 ? "s" : ""} para servir`,
        bgColor: "rgba(16, 185, 129, 0.1)",
        borderColor: "rgba(16, 185, 129, 0.2)",
        icon: CheckCircle,
      };
    }

    // Si todos los items están aceptados
    if (acceptedCount === items.length) {
      return {
        color: "#3b82f6",
        text: "Confirmado por el mozo",
        bgColor: "rgba(59, 130, 246, 0.1)",
        borderColor: "rgba(59, 130, 246, 0.2)",
        icon: CheckCircle,
      };
    }

    // Si hay items entregados y otros estados
    if (deliveredCount > 0) {
      const remainingCount = items.length - deliveredCount;
      return {
        color: "#22c55e",
        text: `${deliveredCount} entregado${deliveredCount > 1 ? "s" : ""}, ${remainingCount} pendiente${remainingCount > 1 ? "s" : ""}`,
        bgColor: "rgba(34, 197, 94, 0.1)",
        borderColor: "rgba(34, 197, 94, 0.2)",
        icon: CheckCircle,
      };
    }

    return {
      color: "#9ca3af",
      text: "Estado desconocido",
      bgColor: "rgba(156, 163, 175, 0.1)",
      borderColor: "rgba(156, 163, 175, 0.2)",
      icon: Clock,
    };
  };

  const getCategoryIcon = (category: "plato" | "bebida") => {
    return category === "plato" ? ChefHat : Coffee;
  };

  const getCategoryColor = (category: "plato" | "bebida") => {
    return category === "plato" ? "#ef4444" : "#3b82f6";
  };

  // Funciones para manejar items rechazados
  const handleModifyRejectedItems = async (rejectedItems: OrderItem[]) => {
    try {
      // Cargar items del menú disponibles
      const response = await api.get("/menu");
      setAvailableMenuItems(response.data);
      setRejectedItemsToModify(rejectedItems);
      setShowModifyModal(true);
    } catch (error) {
      Alert.alert("Error", "No se pudieron cargar los productos disponibles");
    }
  };

  const handleSubmitModifiedItems = async (newItems: any[]) => {
    try {
      // Encontrar la orden que contiene los items rechazados
      const orderWithRejectedItems = userOrders.find(order =>
        order.order_items.some(item =>
          rejectedItemsToModify.some(rejected => rejected.id === item.id),
        ),
      );

      if (!orderWithRejectedItems) {
        throw new Error("No se encontró la orden con items rechazados");
      }

      // Preparar datos para la API
      const rejectedItemIds = rejectedItemsToModify.map(item => item.id);
      const formattedNewItems = newItems.map(item => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      // Llamar a la API para reemplazar items
      await replaceRejectedItems(
        orderWithRejectedItems.id,
        rejectedItemIds,
        formattedNewItems,
      );

      Alert.alert(
        "Cambios Enviados",
        "Los productos modificados han sido enviados para aprobación del mozo",
      );
      await refreshOrders();
    } catch (error: any) {
      console.error("Error submitting modified items:", error);
      throw new Error(error.message || "Error al enviar cambios");
    }
  };

  const handleAddMoreItems = () => {
    // Cerrar el modal de carrito para que el usuario pueda agregar más items
    onClose();
  };

  const handleConfirmOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert("Error", "No hay items en el carrito para enviar");
      return;
    }

    // Verificar si ya hay un pedido pending
    if (hasPendingOrder) {
      Alert.alert(
        "Error",
        "Ya tienes un pedido pendiente. No puedes enviar otro hasta que sea procesado.",
      );
      return;
    }

    // Si hay pedido aceptado, usar submitToAcceptedOrder
    if (hasAcceptedOrder) {
      try {
        await submitToAcceptedOrder();

        Alert.alert(
          "Items Agregados",
          `Se agregaron ${cartCount} ${cartCount === 1 ? "producto" : "productos"} a tu pedido aceptado. Los nuevos items están pendientes de aprobación del mozo.`,
          [{ text: "OK", onPress: onClose }],
        );
        return;
      } catch (error: any) {
        console.error("Error al agregar items a pedido aceptado:", error);
        Alert.alert(
          "Error",
          error.message ||
            "No se pudieron agregar los items al pedido aceptado.",
        );
        return;
      }
    }

    // Si hay pedido parcial, usar submitToPartialOrder en lugar de submitOrder
    if (hasPartialOrder) {
      try {
        await submitToPartialOrder();

        Alert.alert(
          "Items Agregados",
          `Se agregaron ${cartCount} ${cartCount === 1 ? "producto" : "productos"} a tu pedido parcial. El pedido vuelve a estar pendiente de confirmación.`,
          [{ text: "OK", onPress: onClose }],
        );
        return;
      } catch (error: any) {
        console.error("Error al agregar items a pedido parcial:", error);
        Alert.alert(
          "Error",
          error.message ||
            "No se pudieron agregar los items al pedido parcial. Intenta de nuevo.",
        );
        return;
      }
    }

    // Verificar que se haya obtenido el tableId
    if (loadingTable) {
      Alert.alert("Espera", "Verificando tu mesa asignada...");
      return;
    }

    if (!tableId) {
      Alert.alert(
        "Error",
        "No tienes una mesa asignada. Asegúrate de haber escaneado el código QR de tu mesa.",
        [{ text: "OK", onPress: onClose }],
      );
      return;
    }

    try {
      const orderData: CreateOrderRequest = {
        table_id: tableId,
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          prepMinutes: item.prepMinutes,
          quantity: item.quantity,
          image_url: item.image_url,
        })),
        totalAmount: cartAmount,
        estimatedTime: cartTime,
      };

      // Usar el nuevo API de orders
      await createOrder(orderData);

      // Enviar el pedido (limpia carrito local y refresca desde BD)
      await submitOrder();

      Alert.alert(
        "Pedido Enviado",
        `Tu pedido por ${formatPrice(cartAmount)} ha sido enviado. Espera a que sea confirmado por el personal.`,
        [{ text: "OK", onPress: onClose }],
      );
    } catch (error: any) {
      console.error("Error al enviar pedido:", error);
      Alert.alert(
        "Error",
        error.message || "No se pudo enviar el pedido. Intenta de nuevo.",
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: 48,
            paddingHorizontal: 24,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.1)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <ShoppingCart size={24} color="#d4af37" />
              <Text
                style={{
                  color: "white",
                  fontSize: 24,
                  fontWeight: "600",
                  marginLeft: 8,
                }}
              >
                {hasPendingOrder
                  ? "Pedido Enviado"
                  : hasAcceptedOrder
                    ? "Pedido Aceptado + Carrito"
                    : hasPartialOrder
                      ? "Pedido Parcial + Carrito"
                      : "Mi Carrito"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: 8,
              }}
            >
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: "#d1d5db",
              fontSize: 14,
              marginTop: 4,
            }}
          >
            {hasPendingOrder
              ? `${pendingOrderCount} ${pendingOrderCount === 1 ? "producto" : "productos"} enviados • Esperando confirmación`
              : hasAcceptedOrder && cartCount > 0
                ? `Aceptado: ${acceptedOrderCount} | Carrito: ${cartCount} • Agregar al pedido confirmado`
                : hasAcceptedOrder
                  ? `${acceptedOrderCount} ${acceptedOrderCount === 1 ? "producto" : "productos"} aceptados • En preparación • Puedes agregar más`
                  : hasPartialOrder && cartCount > 0
                    ? `Parcial: ${partialOrderCount} | Carrito: ${cartCount} • Tiempo: ${Math.max(partialOrderTime, cartTime)} min`
                    : hasPartialOrder
                      ? `${partialOrderCount} ${partialOrderCount === 1 ? "producto" : "productos"} aprobados parcialmente • Puedes agregar más`
                      : cartCount > 0
                        ? `${cartCount} ${cartCount === 1 ? "producto" : "productos"} • Tiempo estimado: ${cartTime} min`
                        : "Tu carrito está vacío"}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
          {/* Pedido Enviado (Pendiente de Confirmación) */}
          {hasPendingOrder && pendingOrderItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
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
                  Pedido Enviado ({pendingOrderCount} items)
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    marginLeft: 8,
                  }}
                >
                  - Esperando confirmación
                </Text>
              </View>

              {pendingOrderItems.map((item, index) => {
                const CategoryIcon = getCategoryIcon(
                  item.category as "plato" | "bebida",
                );
                const categoryColor = getCategoryColor(
                  item.category as "plato" | "bebida",
                );

                return (
                  <View
                    key={`pending-${item.id}-${index}`}
                    style={{
                      flexDirection: "row",
                      backgroundColor: "rgba(255, 165, 0, 0.1)",
                      borderRadius: 12,
                      marginBottom: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: "rgba(255, 165, 0, 0.2)",
                    }}
                  >
                    {item.image_url && (
                      <Image
                        source={{ uri: item.image_url }}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 8,
                          marginRight: 12,
                        }}
                      />
                    )}

                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: categoryColor,
                            borderRadius: 6,
                            padding: 4,
                            marginRight: 8,
                          }}
                        >
                          <CategoryIcon size={12} color="white" />
                        </View>
                        <Text
                          style={{
                            color: "#9ca3af",
                            fontSize: 12,
                            textTransform: "uppercase",
                          }}
                        >
                          {item.category === "plato" ? "Plato" : "Bebida"}
                        </Text>
                      </View>

                      <Text
                        style={{
                          color: "white",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{ color: "#9ca3af", fontSize: 14, marginTop: 2 }}
                      >
                        {formatPrice(item.price)} x {item.quantity}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 4,
                        }}
                      >
                        <Clock size={12} color="#ffa500" />
                        <Text
                          style={{
                            color: "#ffa500",
                            fontSize: 12,
                            marginLeft: 4,
                          }}
                        >
                          {item.prepMinutes} min
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        color: "#ffa500",
                        fontSize: 16,
                        fontWeight: "600",
                        alignSelf: "center",
                      }}
                    >
                      {formatPrice(item.price * item.quantity)}
                    </Text>
                  </View>
                );
              })}

              <View
                style={{
                  backgroundColor: "rgba(255, 165, 0, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(255, 165, 0, 0.2)",
                }}
              >
                <Text
                  style={{
                    color: "#ffa500",
                    fontSize: 16,
                    textAlign: "center",
                  }}
                >
                  Tu pedido está siendo revisado por el personal.
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  No puedes agregar más items hasta que este pedido sea
                  confirmado.
                </Text>
              </View>
            </View>
          )}

          {/* Pedido Aceptado (Confirmado y en preparación) */}
          {hasAcceptedOrder && acceptedOrderItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
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
                <ChefHat size={20} color="#3b82f6" />
                <Text
                  style={{
                    color: "#3b82f6",
                    fontSize: 18,
                    fontWeight: "600",
                    marginLeft: 8,
                  }}
                >
                  Pedido Aceptado ({acceptedOrderCount} items)
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    marginLeft: 8,
                  }}
                >
                  - En preparación
                </Text>
              </View>

              {acceptedOrderItems.map((item, index) => {
                const CategoryIcon = getCategoryIcon(
                  item.category as "plato" | "bebida",
                );
                const categoryColor = getCategoryColor(
                  item.category as "plato" | "bebida",
                );

                return (
                  <View
                    key={`accepted-${item.id}-${index}`}
                    style={{
                      flexDirection: "row",
                      backgroundColor: "rgba(59, 130, 246, 0.05)",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: "rgba(59, 130, 246, 0.2)",
                    }}
                  >
                    <Image
                      source={{
                        uri: item.image_url || "/api/placeholder/120/120",
                      }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        backgroundColor: "rgba(255,255,255,0.1)",
                      }}
                    />

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <CategoryIcon size={14} color={categoryColor} />
                        <Text
                          style={{
                            color: "white",
                            fontSize: 16,
                            fontWeight: "600",
                            marginLeft: 6,
                            flex: 1,
                          }}
                        >
                          {item.name}
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          style={{
                            color: "#9ca3af",
                            fontSize: 14,
                          }}
                        >
                          x{item.quantity} • {item.prepMinutes} min
                        </Text>

                        <Text
                          style={{
                            color: "#3b82f6",
                            fontSize: 16,
                            fontWeight: "600",
                          }}
                        >
                          {formatPrice(item.price * item.quantity)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              <View
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <Text
                  style={{
                    color: "#3b82f6",
                    fontSize: 14,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  ✨ Tu pedido está siendo preparado. Puedes agregar más items
                  al carrito y serán enviados para aprobación.
                </Text>
              </View>
            </View>
          )}

          {/* Pedido Parcial (Aprobado Parcialmente) */}
          {hasPartialOrder && partialOrderItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 16,
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
                  Pedido Parcial ({partialOrderCount} items)
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    marginLeft: 8,
                  }}
                >
                  - Aprobado parcialmente
                </Text>
              </View>

              {partialOrderItems.map((item, index) => {
                const CategoryIcon = getCategoryIcon(
                  item.category as "plato" | "bebida",
                );
                const categoryColor = getCategoryColor(
                  item.category as "plato" | "bebida",
                );

                return (
                  <View
                    key={`partial-${item.id}-${index}`}
                    style={{
                      flexDirection: "row",
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      borderRadius: 12,
                      marginBottom: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: "rgba(34, 197, 94, 0.2)",
                    }}
                  >
                    {item.image_url && (
                      <Image
                        source={{ uri: item.image_url }}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 8,
                          marginRight: 12,
                        }}
                      />
                    )}

                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: categoryColor,
                            borderRadius: 6,
                            padding: 4,
                            marginRight: 8,
                          }}
                        >
                          <CategoryIcon size={12} color="white" />
                        </View>
                        <Text
                          style={{
                            color: "#9ca3af",
                            fontSize: 12,
                            textTransform: "uppercase",
                          }}
                        >
                          {item.category === "plato" ? "Plato" : "Bebida"}
                        </Text>
                      </View>

                      <Text
                        style={{
                          color: "white",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{ color: "#9ca3af", fontSize: 14, marginTop: 2 }}
                      >
                        {formatPrice(item.price)} x {item.quantity}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 4,
                        }}
                      >
                        <Clock size={12} color="#22c55e" />
                        <Text
                          style={{
                            color: "#22c55e",
                            fontSize: 12,
                            marginLeft: 4,
                          }}
                        >
                          {item.prepMinutes} min
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        color: "#22c55e",
                        fontSize: 16,
                        fontWeight: "600",
                        alignSelf: "center",
                      }}
                    >
                      {formatPrice(item.price * item.quantity)}
                    </Text>
                  </View>
                );
              })}

              <View
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(34, 197, 94, 0.2)",
                }}
              >
                <Text
                  style={{
                    color: "#22c55e",
                    fontSize: 16,
                    textAlign: "center",
                  }}
                >
                  Estos productos fueron aprobados por el mozo.
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Puedes agregar más productos al pedido desde el menú.
                </Text>
              </View>
            </View>
          )}

          {/* Carrito Local (Solo si no hay pedido pending) */}
          {!hasPendingOrder && cartItems.length > 0 && (
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(212, 175, 55, 0.3)",
                }}
              >
                <ShoppingCart size={20} color="#d4af37" />
                <Text
                  style={{
                    color: "#d4af37",
                    fontSize: 18,
                    fontWeight: "600",
                    marginLeft: 8,
                  }}
                >
                  En el Carrito ({cartCount} items)
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    marginLeft: 8,
                  }}
                >
                  - Listo para enviar
                </Text>
              </View>

              {cartItems.map(item => {
                const CategoryIcon = getCategoryIcon(
                  item.category as "plato" | "bebida",
                );
                const categoryColor = getCategoryColor(
                  item.category as "plato" | "bebida",
                );

                return (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {/* Image */}
                      {item.image_url && (
                        <Image
                          source={{ uri: item.image_url }}
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 8,
                            marginRight: 12,
                          }}
                        />
                      )}

                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: categoryColor,
                              borderRadius: 6,
                              padding: 4,
                              marginRight: 8,
                            }}
                          >
                            <CategoryIcon size={12} color="white" />
                          </View>
                          <Text
                            style={{
                              color: "#9ca3af",
                              fontSize: 12,
                              textTransform: "uppercase",
                            }}
                          >
                            {item.category === "plato" ? "Plato" : "Bebida"}
                          </Text>
                        </View>

                        <Text
                          style={{
                            color: "white",
                            fontSize: 16,
                            fontWeight: "600",
                            marginBottom: 4,
                          }}
                        >
                          {item.name}
                        </Text>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: "#d4af37",
                              fontSize: 16,
                              fontWeight: "600",
                            }}
                          >
                            {formatPrice(item.price)}
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
                              {item.prepMinutes} min
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Controls */}
                      <View style={{ alignItems: "flex-end" }}>
                        <TouchableOpacity
                          onPress={() => removeItem(item.id)}
                          style={{
                            backgroundColor: "rgba(239, 68, 68, 0.2)",
                            borderRadius: 8,
                            padding: 6,
                            marginBottom: 8,
                          }}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#d4af37",
                            borderRadius: 8,
                            paddingHorizontal: 4,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            style={{ padding: 6 }}
                          >
                            <Minus size={14} color="#1a1a1a" />
                          </TouchableOpacity>

                          <Text
                            style={{
                              color: "#1a1a1a",
                              fontWeight: "600",
                              fontSize: 16,
                              marginHorizontal: 8,
                            }}
                          >
                            {item.quantity}
                          </Text>

                          <TouchableOpacity
                            onPress={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            style={{ padding: 6 }}
                          >
                            <Plus size={14} color="#1a1a1a" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Estado vacío */}
          {!hasPendingOrder && !hasPartialOrder && cartItems.length === 0 && (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 48,
              }}
            >
              <ShoppingCart size={64} color="#6b7280" />
              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: 18,
                  marginTop: 16,
                  textAlign: "center",
                }}
              >
                Tu carrito está vacío
              </Text>
              <Text
                style={{
                  color: "#6b7280",
                  fontSize: 14,
                  marginTop: 4,
                  textAlign: "center",
                }}
              >
                Agrega algunos productos del menú
              </Text>
            </View>
          )}

          {/* Estado del Pedido Actual */}
          {userOrders.length > 0 && (
            <View style={{ marginTop: 32 }}>
              {/* Mostrar pedidos activos (no pagados) con el nuevo componente */}
              {userOrders
                .filter(order => !order.is_paid)
                .map(order => (
                  <OrderStatusView
                    key={order.id}
                    order={order}
                    onModifyRejectedItems={handleModifyRejectedItems}
                    onAddMoreItems={handleAddMoreItems}
                  />
                ))}
            </View>
          )}

          {/* Historial de Pedidos Pagados */}
          {userOrders.filter(order => order.is_paid).length > 0 && (
            <View style={{ marginTop: 32 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.2)",
                }}
              >
                <Clock size={20} color="#9ca3af" />
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 18,
                    fontWeight: "600",
                    marginLeft: 8,
                  }}
                >
                  Pedidos Pagados
                </Text>
              </View>

              {userOrders
                .filter(order => order.is_paid)
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
                )
                .slice(0, 3) // Mostrar solo los 3 más recientes
                .map(order => {
                  const statusInfo = getOrderStatusInfo(order);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <View
                      key={`history-${order.id}`}
                      style={{
                        backgroundColor: statusInfo.bgColor,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: statusInfo.borderColor,
                      }}
                    >
                      {/* Header del pedido */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 12,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          <StatusIcon size={16} color={statusInfo.color} />
                          <Text
                            style={{
                              color: statusInfo.color,
                              fontSize: 14,
                              fontWeight: "600",
                              marginLeft: 8,
                            }}
                          >
                            {statusInfo.text}
                          </Text>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={{
                              color: statusInfo.color,
                              fontSize: 16,
                              fontWeight: "600",
                            }}
                          >
                            {formatPrice(order.total_amount)}
                          </Text>
                          <Text
                            style={{
                              color: "#9ca3af",
                              fontSize: 12,
                            }}
                          >
                            {new Date(order.created_at).toLocaleDateString(
                              "es",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </Text>
                        </View>
                      </View>

                      {/* Items del pedido (solo los primeros 2) */}
                      <View>
                        {order.order_items
                          .slice(0, 2)
                          .map((item: any, index: number) => (
                            <View
                              key={`${order.id}-item-${index}`}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 6,
                              }}
                            >
                              <View
                                style={{
                                  backgroundColor:
                                    item.menu_item?.category === "plato"
                                      ? "#ef4444"
                                      : "#3b82f6",
                                  borderRadius: 4,
                                  padding: 3,
                                  marginRight: 8,
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
                                  color: "#d1d5db",
                                  fontSize: 13,
                                  flex: 1,
                                }}
                              >
                                {item.menu_item?.name || "Producto"}
                              </Text>

                              <Text
                                style={{
                                  color: "#9ca3af",
                                  fontSize: 12,
                                }}
                              >
                                x{item.quantity}
                              </Text>
                            </View>
                          ))}

                        {order.order_items.length > 2 && (
                          <Text
                            style={{
                              color: "#9ca3af",
                              fontSize: 12,
                              fontStyle: "italic",
                              marginTop: 4,
                            }}
                          >
                            +{order.order_items.length - 2} productos más
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}

              {userOrders.filter(order => {
                const hasPendingItems = order.order_items?.some(
                  item => item.status === "pending",
                );
                return !hasPendingItems;
              }).length === 0 && (
                <Text
                  style={{
                    color: "#6b7280",
                    fontSize: 14,
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  No hay pedidos anteriores
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {((cartItems.length > 0 && !hasPendingOrder) ||
          (hasPendingOrder && pendingOrderItems.length > 0) ||
          (hasAcceptedOrder && acceptedOrderItems.length > 0) ||
          (hasPartialOrder && partialOrderItems.length > 0)) && (
          <View
            style={{
              padding: 24,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.1)",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              {hasPendingOrder && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#ffa500", fontSize: 16 }}>
                    Pedido Enviado ({pendingOrderCount} items)
                  </Text>
                  <Text
                    style={{
                      color: "#ffa500",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {formatPrice(pendingOrderAmount)}
                  </Text>
                </View>
              )}

              {hasAcceptedOrder && acceptedOrderItems.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#3b82f6", fontSize: 16 }}>
                    Pedido Aceptado ({acceptedOrderCount} items)
                  </Text>
                  <Text
                    style={{
                      color: "#3b82f6",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {formatPrice(acceptedOrderAmount)}
                  </Text>
                </View>
              )}

              {hasPartialOrder && partialOrderItems.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#22c55e", fontSize: 16 }}>
                    Pedido Parcial ({partialOrderCount} items)
                  </Text>
                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {formatPrice(partialOrderAmount)}
                  </Text>
                </View>
              )}

              {!hasPendingOrder && cartItems.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom:
                      cartItems.length > 0 && hasPartialOrder ? 8 : 0,
                  }}
                >
                  <Text style={{ color: "#d4af37", fontSize: 16 }}>
                    En Carrito ({cartCount} items)
                  </Text>
                  <Text
                    style={{
                      color: "#d4af37",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {formatPrice(cartAmount)}
                  </Text>
                </View>
              )}

              {/* Total combinado si hay pedido parcial y carrito */}
              {hasPartialOrder && cartItems.length > 0 && !hasPendingOrder && (
                <>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      marginVertical: 8,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Total ({partialOrderCount + cartCount} items)
                    </Text>
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {formatPrice(partialOrderAmount + cartAmount)}
                    </Text>
                  </View>
                </>
              )}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: "#d1d5db", fontSize: 16 }}>
                  Tiempo estimado
                </Text>
                <Text
                  style={{ color: "#d1d5db", fontSize: 16, fontWeight: "600" }}
                >
                  {hasPendingOrder
                    ? pendingOrderTime
                    : hasAcceptedOrder && cartItems.length > 0
                      ? Math.max(acceptedOrderTime, cartTime)
                      : hasAcceptedOrder
                        ? acceptedOrderTime
                        : hasPartialOrder && cartItems.length > 0
                          ? Math.max(partialOrderTime, cartTime)
                          : hasPartialOrder
                            ? partialOrderTime
                            : cartTime}{" "}
                  minutos
                </Text>
              </View>
            </View>

            {!hasPendingOrder && cartItems.length > 0 && (
              <TouchableOpacity
                onPress={handleConfirmOrder}
                disabled={loadingTable}
                style={{
                  backgroundColor: loadingTable ? "#9ca3af" : "#d4af37",
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: loadingTable ? 0.7 : 1,
                }}
              >
                <CheckCircle size={20} color="#1a1a1a" />
                <Text
                  style={{
                    color: "#1a1a1a",
                    fontSize: 18,
                    fontWeight: "600",
                    marginLeft: 8,
                  }}
                >
                  {loadingTable
                    ? "Verificando mesa..."
                    : hasAcceptedOrder
                      ? `Agregar al Pedido Aceptado • ${formatPrice(cartAmount)}`
                      : hasPartialOrder
                        ? `Agregar al Pedido • ${formatPrice(cartAmount)}`
                        : `Enviar Pedido • ${formatPrice(cartAmount)}`}
                </Text>
              </TouchableOpacity>
            )}

            {hasPendingOrder && (
              <View
                style={{
                  backgroundColor: "rgba(255, 165, 0, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "rgba(255, 165, 0, 0.2)",
                }}
              >
                <Text
                  style={{
                    color: "#ffa500",
                    fontSize: 16,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  Pedido en Revisión
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  El personal confirmará tu pedido pronto
                </Text>
              </View>
            )}

            {hasAcceptedOrder && cartItems.length === 0 && !hasPendingOrder && (
              <View
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "rgba(59, 130, 246, 0.2)",
                }}
              >
                <Text
                  style={{
                    color: "#3b82f6",
                    fontSize: 16,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  Pedido en Preparación
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Tu pedido está siendo preparado. Puedes agregar más items.
                </Text>
              </View>
            )}

            {hasPartialOrder && cartItems.length === 0 && !hasPendingOrder && (
              <View
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "rgba(34, 197, 94, 0.2)",
                }}
              >
                <Text
                  style={{
                    color: "#22c55e",
                    fontSize: 16,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  Pedido Parcialmente Aprobado
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Agrega más productos desde el menú para completar tu pedido
                </Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Modal para modificar items rechazados */}
      <ModifyRejectedItemsModal
        visible={showModifyModal}
        rejectedItems={rejectedItemsToModify}
        availableMenuItems={availableMenuItems}
        onClose={() => {
          setShowModifyModal(false);
          setRejectedItemsToModify([]);
        }}
        onSubmitChanges={handleSubmitModifiedItems}
      />
    </Modal>
  );
}
