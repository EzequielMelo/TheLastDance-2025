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
import { createOrder } from "../../api/orders";
import type { CreateOrderRequest } from "../../types/Order";

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CartModal({ visible, onClose }: CartModalProps) {
  const {
    cartItems,
    pendingOrderItems,
    partialOrderItems,
    hasPendingOrder,
    hasPartialOrder,
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

  const getCategoryIcon = (category: "plato" | "bebida") => {
    return category === "plato" ? ChefHat : Coffee;
  };

  const getCategoryColor = (category: "plato" | "bebida") => {
    return category === "plato" ? "#ef4444" : "#3b82f6";
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
        </ScrollView>

        {/* Footer */}
        {((cartItems.length > 0 && !hasPendingOrder) ||
          (hasPendingOrder && pendingOrderItems.length > 0) ||
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
    </Modal>
  );
}
