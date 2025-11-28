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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
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
  QrCode,
} from "lucide-react-native";
import { useCart } from "../../context/CartContext";
import { useClientState } from "../../Hooks/useClientState";
import api from "../../api/axios";
import {
  createOrder,
  replaceRejectedItems,
  checkTableDeliveryStatus,
  confirmTableDelivery,
} from "../../api/orders";
import { createDeliveryOrder, createDelivery } from "../../api/deliveries";
import { RESTAURANT_LOCATION } from "../../config/restaurantConfig";
import type { CreateOrderRequest, OrderItem } from "../../types/Order";
import OrderStatusView from "../orders/OrderStatusView";
import CustomAlert from "../common/CustomAlert";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
  forceDeliveryMode?: boolean; // 🚚 Prop para forzar modo delivery (evita race conditions)
  deliveryAddressProp?: {
    address: string;
    latitude: number;
    longitude: number;
    notes?: string;
  } | null; // 🚚 Prop para pasar la dirección directamente
  showCustomAlert?: (
    title: string,
    message: string,
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
    type?: "success" | "error" | "warning" | "info",
  ) => void;
}

export default function CartModal({
  visible,
  onClose,
  forceDeliveryMode = false,
  deliveryAddressProp = null,
  showCustomAlert,
}: CartModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const {
    cartItems,
    userOrders,
    cartCount,
    cartAmount,
    cartTime,
    updateQuantity,
    removeItem,
    submitOrder,
    submitToAcceptedOrder,
    refreshOrders,
    isDeliveryOrder, // 🚚 Flag para detectar modo delivery
    deliveryAddress, // 🚚 Dirección de delivery guardada
    setIsDeliveryOrder, // 🚚 Para resetear modo delivery
    setDeliveryAddress, // 🚚 Para limpiar dirección
  } = useCart();

  const {
    occupiedTable,
    deliveryConfirmationStatus,
    refresh: refreshClientState,
  } = useClientState();

  const [tableId, setTableId] = useState<string | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<{
    allDelivered: boolean;
    totalItems: number;
    deliveredItems: number;
  } | null>(null);

  // 🚚 Estado local para capturar el modo delivery al abrir el modal
  // Priorizar el prop forceDeliveryMode sobre el contexto (evita race conditions)
  const [isDeliveryMode, setIsDeliveryMode] = useState(() => {
    const mode =
      forceDeliveryMode || isDeliveryOrder || deliveryAddress !== null;
    return mode;
  });

  // Estado para CustomAlert
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>;
  }>({
    visible: false,
    title: "",
    message: "",
    type: "info",
    buttons: [],
  });

  const showAlert = (
    title: string,
    message: string,
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }> = [{ text: "OK" }],
    type: "success" | "error" | "warning" | "info" = "info",
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons,
    });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  // Estado del pedido actual (simplificado)
  const currentOrder = userOrders.find(order => !order.is_paid);
  const hasActiveOrder = !!currentOrder;
  const hasPendingItems =
    currentOrder?.order_items.some(item => item.status === "pending") || false;
  const canAddMoreItems =
    hasActiveOrder && !hasPendingItems && !currentOrder?.is_paid;

  // Verificar si hay items delivered cuando se abre el modal
  useEffect(() => {
    if (visible) {
      // 🚚 Capturar el modo delivery al abrir el modal
      // Priorizar forceDeliveryMode prop sobre el contexto
      const deliveryMode =
        forceDeliveryMode || isDeliveryOrder || deliveryAddress !== null;
      setIsDeliveryMode(deliveryMode);

      // Solo verificar mesa si NO es un pedido delivery
      if (!deliveryMode) {
        fetchUserTable();
      }
      refreshOrders().catch(console.error);

      // Verificar delivery status solo para pedidos en mesa
      if (occupiedTable?.id && !deliveryMode) {
        checkTableDeliveryStatus(occupiedTable.id)
          .then(setDeliveryStatus)
          .catch(console.error);
      }
    } else {
      // NO limpiar deliveryAddress aquí - solo limpiar cuando el pedido se confirme exitosamente
      // Resetear estado local del modal
      setIsDeliveryMode(false);
    }
  }, [
    visible,
    occupiedTable?.id,
    cartItems.length,
    forceDeliveryMode,
    isDeliveryOrder,
    deliveryAddress,
  ]);

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

  const getCategoryIcon = (category: "plato" | "bebida") => {
    return category === "plato" ? ChefHat : Coffee;
  };

  const getCategoryColor = (category: "plato" | "bebida") => {
    return category === "plato" ? "#ef4444" : "#3b82f6";
  };

  // Funciones para manejar items rechazados
  const handleModifyRejectedItems = async (rejectedItems: OrderItem[]) => {
    try {
      // Encontrar el orderId de los items rechazados
      const orderWithRejectedItems = userOrders.find(order =>
        order.order_items.some(item =>
          rejectedItems.some(rejected => rejected.id === item.id),
        ),
      );

      if (!orderWithRejectedItems) {
        showAlert(
          "Error",
          "No se encontró la orden con productos rechazados",
          undefined,
          "error",
        );
        return;
      }

      // Cerrar modal y navegar al menú en modo modificar
      onClose();
      navigation.navigate("Menu", {
        mode: "modify-rejected",
        rejectedItems: rejectedItems,
        orderId: orderWithRejectedItems.id,
      });
    } catch (error) {
      showAlert(
        "Error",
        "No se pudo abrir el menú para modificar los productos",
        undefined,
        "error",
      );
    }
  };

  const handleAddMoreItems = () => {
    // Cerrar el modal de carrito
    onClose();

    // Navegar al menú para que el usuario pueda agregar más items
    if (navigation) {
      navigation.navigate("Menu");
    }
  };

  const handleConfirmDelivery = async () => {
    if (!occupiedTable?.id) {
      showAlert(
        "Error",
        "No se pudo obtener la información de tu mesa",
        undefined,
        "error",
      );
      return;
    }

    try {
      setConfirmingDelivery(true);

      const result = await confirmTableDelivery(occupiedTable.id);

      if (result.success) {
        // Obtener el id_waiter de la mesa para la encuesta
        const waiterId = occupiedTable.id_waiter || "";

        showAlert(
          "✅ Recepción Confirmada",
          "¡Perfecto! Has confirmado la recepción de tu pedido. ¿Te gustaría responder una breve encuesta sobre tu experiencia?",
          [
            {
              text: "Responder encuesta",
              onPress: async () => {
                onClose();
                // Refrescar estado
                await refreshClientState();
                refreshOrders();
                // Navegar a encuesta
                navigation.navigate("Survey", {
                  tableId: occupiedTable.id,
                  waiterId: waiterId,
                });
              },
            },
            {
              text: "Más tarde",
              style: "cancel",
              onPress: async () => {
                onClose();
                await refreshClientState();
                refreshOrders();
              },
            },
          ],
          "success",
        );
      } else {
        showAlert(
          "Error",
          "No se pudo confirmar la recepción. Intenta de nuevo.",
          undefined,
          "error",
        );
      }
    } catch (error: any) {
      console.error("Error confirmando entrega:", error);
      showAlert(
        "Error",
        error.message || "No se pudo confirmar la recepción del pedido",
        undefined,
        "error",
      );
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const handleConfirmOrder = async () => {
    // Prevenir múltiples envíos simultáneos
    if (isSubmitting) {
      console.log("⚠️ Ya se está procesando un pedido, ignorando...");
      return;
    }

    // 🚚 Usar el estado local capturado al abrir el modal
    console.log("🚚 handleConfirmOrder - isDeliveryMode:", isDeliveryMode);
    console.log("🚚 handleConfirmOrder - deliveryAddress:", deliveryAddress);

    // === Flujo para pedidos DELIVERY ===
    if (isDeliveryMode) {
      // Validar que haya productos en el carrito
      if (cartItems.length === 0) {
        showAlert(
          "Error",
          "No hay productos en el carrito para realizar el pedido",
          undefined,
          "error",
        );
        return;
      }

      // Usar la dirección del prop con prioridad sobre el contexto
      const finalDeliveryAddress = deliveryAddressProp || deliveryAddress;

      if (!finalDeliveryAddress) {
        console.error("❌ No hay dirección de delivery disponible", {
          deliveryAddressProp,
          deliveryAddress,
        });
        showAlert(
          "Error",
          "No se ha seleccionado una dirección de entrega. Por favor, regresa y confirma tu dirección.",
          undefined,
          "error",
        );
        return;
      }

      console.log("✅ Usando dirección de delivery:", finalDeliveryAddress);

      try {
        setIsSubmitting(true);

        // Crear el pedido de delivery con los items del carrito
        const deliveryOrderData = {
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
          notes: "",
        };

        const deliveryOrderResponse =
          await createDeliveryOrder(deliveryOrderData);
        const deliveryOrderId = deliveryOrderResponse.id;

        // Crear el registro de delivery con la dirección
        const deliveryData = {
          delivery_order_id: deliveryOrderId,
          delivery_address: finalDeliveryAddress.address,
          delivery_latitude: finalDeliveryAddress.latitude,
          delivery_longitude: finalDeliveryAddress.longitude,
          delivery_notes: finalDeliveryAddress.notes || "",
          origin_latitude: RESTAURANT_LOCATION.latitude,
          origin_longitude: RESTAURANT_LOCATION.longitude,
        };

        await createDelivery(deliveryData);

        // Limpiar el carrito y resetear estados
        await submitOrder();
        setIsDeliveryOrder(false);
        setDeliveryAddress(null);

        // Mostrar mensaje de éxito
        showAlert(
          "Pedido Enviado",
          "Tu pedido de delivery ha sido enviado exitosamente",
          [{ text: "OK", onPress: onClose }],
          "success",
        );
      } catch (error: any) {
        console.error("Error al crear pedido de delivery:", error);
        showAlert(
          "Error",
          error.message || "No se pudo crear el pedido de delivery",
          undefined,
          "error",
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // === Flujo normal para pedidos en mesa ===
    if (cartItems.length === 0) {
      showAlert(
        "Error",
        "No hay productos en el carrito para enviar",
        undefined,
        "error",
      );
      return;
    }

    // Verificar si hay items pendientes
    if (hasPendingItems) {
      showAlert(
        "Error",
        "Ya tienes productos pendientes de aprobación. No puedes enviar más hasta que sean procesados.",
        undefined,
        "error",
      );
      return;
    }

    // Si hay un pedido activo, agregar como nueva tanda
    if (canAddMoreItems) {
      try {
        setIsSubmitting(true);
        await submitToAcceptedOrder();

        showAlert(
          "Nueva Tanda Agregada",
          `Se agregaron ${cartCount} ${cartCount === 1 ? "producto" : "productos"} como nueva tanda. Los productos están pendientes de aprobación del mozo.`,
          [{ text: "OK", onPress: onClose }],
          "success",
        );
        return;
      } catch (error: any) {
        console.error("Error al agregar nueva tanda:", error);
        showAlert(
          "Error",
          error.message || "No se pudo agregar la nueva tanda.",
          undefined,
          "error",
        );
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    // Verificar mesa solo si NO es delivery
    if (!isDeliveryMode) {
      if (loadingTable) {
        showAlert(
          "Espera",
          "Verificando tu mesa asignada...",
          undefined,
          "info",
        );
        return;
      }

      if (!tableId) {
        showAlert(
          "Error",
          "No tienes una mesa asignada. Asegúrate de haber escaneado el código QR de tu mesa.",
          [{ text: "OK", onPress: onClose }],
          "error",
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const orderData: CreateOrderRequest = {
        table_id: tableId || undefined, // undefined para delivery, string para mesa
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

      await createOrder(orderData);
      await submitOrder();

      showAlert(
        "Pedido Enviado",
        `Tu pedido por ${formatPrice(cartAmount)} ha sido enviado. Espera a que sea confirmado por el personal.`,
        [{ text: "OK", onPress: onClose }],
        "success",
      );
    } catch (error: any) {
      console.error("Error al enviar pedido:", error);
      showAlert(
        "Error",
        error.message || "No se pudo enviar el pedido. Intenta de nuevo.",
        undefined,
        "error",
      );
    } finally {
      setIsSubmitting(false);
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
                {isDeliveryMode && cartItems.length > 0
                  ? "Pedido Delivery"
                  : cartItems.length > 0
                    ? canAddMoreItems
                      ? "Nueva Tanda"
                      : "Mi Carrito"
                    : hasActiveOrder
                      ? "Mi Pedido"
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
            {isDeliveryMode && cartItems.length > 0
              ? `${cartCount} ${cartCount === 1 ? "producto" : "productos"} • Dirección de entrega confirmada`
              : cartItems.length > 0
                ? canAddMoreItems
                  ? `${cartCount} ${cartCount === 1 ? "producto" : "productos"} • Se agregará a tu pedido existente`
                  : `${cartCount} ${cartCount === 1 ? "producto" : "productos"} • Tiempo estimado: ${cartTime} min`
                : hasActiveOrder
                  ? "Revisá el estado de tu pedido actual"
                  : "Tu carrito está vacío"}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
          {/* Botón de Confirmar Recepción - Arriba de todo cuando está disponible */}
          {!isDeliveryMode && occupiedTable?.id && (
            <>
              {deliveryStatus === null ? (
                // Skeleton mientras carga
                <View
                  style={{
                    marginBottom: 24,
                    backgroundColor: "rgba(156, 163, 175, 0.1)",
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "rgba(156, 163, 175, 0.2)",
                    minHeight: 100,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    Verificando estado de entrega...
                  </Text>
                </View>
              ) : deliveryStatus?.allDelivered &&
                deliveryStatus.totalItems > 0 &&
                deliveryConfirmationStatus === "pending" ? (
                // Mostrar botón de confirmación cuando TODO está entregado
                <View
                  style={{
                    marginBottom: 24,
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "rgba(34, 197, 94, 0.3)",
                  }}
                >
                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 16,
                      fontWeight: "600",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    ✅ ¡Pedido Completo!
                  </Text>
                  <Text
                    style={{
                      color: "#d1d5db",
                      fontSize: 14,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  >
                    Todos tus productos han sido entregados.
                  </Text>
                  <TouchableOpacity
                    onPress={handleConfirmDelivery}
                    disabled={confirmingDelivery}
                    style={{
                      backgroundColor: confirmingDelivery
                        ? "#9ca3af"
                        : "#22c55e",
                      borderRadius: 12,
                      padding: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: confirmingDelivery ? 0.7 : 1,
                    }}
                  >
                    <CheckCircle size={20} color="white" />
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      {confirmingDelivery
                        ? "Confirmando recepción..."
                        : "Confirmar Recepción"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : deliveryStatus &&
                deliveryStatus.totalItems > 0 &&
                !deliveryStatus.allDelivered ? (
                // Mostrar progreso cuando hay items pero NO todos están entregados
                <View
                  style={{
                    marginBottom: 24,
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "rgba(59, 130, 246, 0.3)",
                    minHeight: 100,
                  }}
                >
                  <Text
                    style={{
                      color: "#3b82f6",
                      fontSize: 16,
                      fontWeight: "600",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    🚀 Pedido en camino
                  </Text>
                  <Text
                    style={{
                      color: "#d1d5db",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {deliveryStatus.deliveredItems} de{" "}
                    {deliveryStatus.totalItems} productos entregados
                  </Text>
                  <View
                    style={{
                      marginTop: 12,
                      height: 8,
                      backgroundColor: "rgba(59, 130, 246, 0.2)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${(deliveryStatus.deliveredItems / deliveryStatus.totalItems) * 100}%`,
                        backgroundColor: "#3b82f6",
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </>
          )}

          {/* Carrito Local (Nueva Tanda) */}
          {cartItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
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
                  {canAddMoreItems ? "Nueva Tanda" : "En el Carrito"} (
                  {cartCount} producto{cartCount === 1 ? "" : "s"})
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

              {/* Aviso si es nueva tanda */}
              {canAddMoreItems && (
                <View
                  style={{
                    backgroundColor: "rgba(212, 175, 55, 0.1)",
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "rgba(212, 175, 55, 0.3)",
                  }}
                >
                  <Text
                    style={{
                      color: "#d4af37",
                      fontSize: 14,
                      textAlign: "center",
                      fontWeight: "500",
                    }}
                  >
                    💡 Estos productos se agregan como nueva tanda a tu pedido
                    existente
                  </Text>
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 12,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    Necesitarán aprobación del mozo antes de ir a la cocina
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Estado vacío del carrito */}
          {cartItems.length === 0 && !hasActiveOrder && (
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
          {currentOrder && (
            <View style={{ marginTop: cartItems.length > 0 ? 24 : 0 }}>
              <OrderStatusView
                order={currentOrder}
                onModifyRejectedItems={handleModifyRejectedItems}
                onAddMoreItems={handleAddMoreItems}
              />
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {cartItems.length > 0 && (
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
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: "#d4af37", fontSize: 16 }}>
                  {canAddMoreItems ? "Nueva Tanda" : "Total"} ({cartCount}{" "}
                  productos)
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
                  {cartTime} minutos
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleConfirmOrder}
              disabled={loadingTable || isSubmitting}
              style={{
                backgroundColor:
                  loadingTable || isSubmitting ? "#9ca3af" : "#d4af37",
                borderRadius: 12,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                opacity: loadingTable || isSubmitting ? 0.7 : 1,
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
                  : isSubmitting
                    ? "Enviando pedido..."
                    : isDeliveryMode && cartItems.length > 0
                      ? `Confirmar Pedido • ${formatPrice(cartAmount)}`
                      : canAddMoreItems
                        ? `Agregar Nueva Tanda • ${formatPrice(cartAmount)}`
                        : `Enviar Pedido • ${formatPrice(cartAmount)}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* CustomAlert */}
      <CustomAlert
        visible={alertConfig.visible}
        onClose={hideAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
    </Modal>
  );
}
