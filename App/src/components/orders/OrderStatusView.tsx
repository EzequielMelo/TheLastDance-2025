import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import {
  CheckCircle,
  X,
  Clock,
  ChefHat,
  CheckCircle2,
} from "lucide-react-native";
import type { Order, OrderItem, OrderItemStatus } from "../../types/Order";

interface OrderStatusViewProps {
  order: Order;
  onModifyRejectedItems: (rejectedItems: OrderItem[]) => void;
  onAddMoreItems: () => void;
}

const OrderStatusView: React.FC<OrderStatusViewProps> = ({
  order,
  onModifyRejectedItems,
  onAddMoreItems,
}) => {
  // Agrupar items por estado
  const groupItemsByStatus = () => {
    const groups: Record<OrderItemStatus, OrderItem[]> = {
      pending: [],
      accepted: [],
      rejected: [],
      needs_modification: [], // ¡AGREGADO!
      preparing: [],
      ready: [],
      delivered: [],
    };

    order.order_items.forEach(item => {
      groups[item.status].push(item);
    });

    return groups;
  };

  const groups = groupItemsByStatus();

  const getStatusInfo = (status: OrderItemStatus) => {
    switch (status) {
      case "pending":
        return {
          color: "#ffa500",
          bgColor: "rgba(255, 165, 0, 0.1)",
          icon: Clock,
          title: "Esperando Confirmación",
          description: "El mozo está revisando estos productos",
        };
      case "accepted":
        return {
          color: "#22c55e",
          bgColor: "rgba(34, 197, 94, 0.1)",
          icon: CheckCircle,
          title: "Confirmados",
          description: "Estos productos fueron aprobados",
        };
      case "rejected":
        return {
          color: "#ef4444",
          bgColor: "rgba(239, 68, 68, 0.1)",
          icon: X,
          title: "No Disponibles",
          description: "No disponemos de stock de estos productos",
        };
      case "needs_modification":
        return {
          color: "#22c55e",
          bgColor: "rgba(34, 197, 94, 0.1)",
          icon: CheckCircle,
          title: "Disponibles en Tanda",
          description:
            "Estos productos sí tenemos en stock, forman parte de la tanda afectada",
        };
      case "preparing":
        return {
          color: "#f59e0b",
          bgColor: "rgba(245, 158, 11, 0.1)",
          icon: ChefHat,
          title: "En Preparación",
          description: "La cocina está preparando estos productos",
        };
      case "ready":
        return {
          color: "#10b981",
          bgColor: "rgba(16, 185, 129, 0.1)",
          icon: CheckCircle2,
          title: "Listos para Servir",
          description: "Estos productos están listos",
        };
      case "delivered":
        return {
          color: "#6b7280",
          bgColor: "rgba(107, 114, 128, 0.1)",
          icon: CheckCircle2,
          title: "Entregados",
          description: "Productos servidos en tu mesa",
        };
    }
  };

  const renderModificationRequiredGroup = () => {
    const rejectedItems = groups.rejected;
    const needsModificationItems = groups.needs_modification;
    const pendingItems = groups.pending;

    // Verificar si realmente hay items que requieren acción del usuario
    const hasItemsNeedingAction = needsModificationItems.length > 0;

    // Verificar si hay modificaciones enviadas (items pending de modificaciones)
    const hasModificationsAlreadySent =
      rejectedItems.length > 0 && pendingItems.length > 0;

    // Verificar si la tanda ya fue completamente procesada
    const acceptedItems = groups.accepted;
    const preparingItems = groups.preparing;
    const readyItems = groups.ready;
    const deliveredItems = groups.delivered;

    const tandaWasProcessed =
      acceptedItems.length > 0 ||
      preparingItems.length > 0 ||
      readyItems.length > 0 ||
      deliveredItems.length > 0;

    // Solo mostrar el grupo de modificación si:
    // 1. Hay items que necesitan acción (needs_modification), O
    // 2. Hay items rejected pero la tanda no ha sido procesada completamente
    const shouldShowModificationGroup =
      hasItemsNeedingAction ||
      (rejectedItems.length > 0 &&
        !tandaWasProcessed &&
        !hasModificationsAlreadySent);

    if (!shouldShowModificationGroup) return null;

    // Si ya se enviaron modificaciones, mostrar mensaje diferente
    if (hasModificationsAlreadySent) {
      return (
        <View
          style={{
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "rgba(59, 130, 246, 0.3)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Clock size={22} color="#3b82f6" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#3b82f6",
                }}
              >
                ⏳ Modificaciones Enviadas
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginTop: 2,
                }}
              >
                Tus cambios están siendo revisados por el mozo
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 14,
              color: "#1e40af",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            💡 No puedes realizar más modificaciones hasta que el mozo apruebe o
            rechace los cambios actuales
          </Text>
        </View>
      );
    }

    // Combinar todos los items que requieren modificación
    const allItemsRequiringModification = [
      ...rejectedItems,
      ...needsModificationItems,
      ...(rejectedItems.length > 0 || needsModificationItems.length > 0
        ? pendingItems
        : []),
    ];

    return (
      <View
        style={{
          backgroundColor: "rgba(255, 193, 7, 0.1)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "rgba(255, 193, 7, 0.3)",
        }}
      >
        {/* Header unificado */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <X size={22} color="#ffc107" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#ffc107",
              }}
            >
              ⚠️ Se requiere modificación
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              Algunos productos no tienen stock. Otros sí están disponibles.
            </Text>
          </View>
        </View>

        {/* Productos no disponibles */}
        {rejectedItems.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: "#ef4444",
                marginBottom: 8,
              }}
            >
              ❌ No disponibles:
            </Text>
            {rejectedItems.map((item, index) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  borderRadius: 8,
                  marginBottom: 6,
                  borderLeftWidth: 3,
                  borderLeftColor: "#ef4444",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: "#ef4444",
                      textDecorationLine: "line-through",
                    }}
                  >
                    {item.menu_item?.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    Cantidad: {item.quantity} • Sin stock
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  NO DISPONIBLE
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Productos disponibles en esta tanda */}
        {needsModificationItems.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: "#22c55e",
                marginBottom: 8,
              }}
            >
              ✅ Disponibles (en esta tanda):
            </Text>
            {needsModificationItems.map((item, index) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: "rgba(34, 197, 94, 0.15)",
                  borderRadius: 8,
                  marginBottom: 6,
                  borderLeftWidth: 3,
                  borderLeftColor: "#22c55e",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: "#16a34a",
                    }}
                  >
                    {item.menu_item?.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#15803d",
                    }}
                  >
                    Cantidad: {item.quantity} • Tenemos stock
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#22c55e",
                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  DISPONIBLE
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Productos pendientes afectados */}
        {pendingItems.length > 0 &&
          (rejectedItems.length > 0 || needsModificationItems.length > 0) && (
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: "#6b7280",
                  marginBottom: 8,
                }}
              >
                📦 También incluye:
              </Text>
              {pendingItems.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    backgroundColor: "rgba(156, 163, 175, 0.1)",
                    borderRadius: 8,
                    marginBottom: 4,
                    borderLeftWidth: 3,
                    borderLeftColor: "#9ca3af",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: "#6b7280",
                      }}
                    >
                      {item.menu_item?.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      Cantidad: {item.quantity} • En la misma tanda
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#6b7280",
                    }}
                  >
                    ${item.subtotal}
                  </Text>
                </View>
              ))}
            </View>
          )}

        {/* Instrucciones y botón de acción */}
        <View
          style={{
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "rgba(59, 130, 246, 0.3)",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#3b82f6",
              marginBottom: 4,
            }}
          >
            ℹ️ ¿Qué significa esto?
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: "#1e40af",
              lineHeight: 16,
            }}
          >
            • Los productos marcados ❌ no tienen stock disponible
            {"\n"}• Los productos marcados ✅ sí tenemos en stock
            {"\n"}• Puedes reemplazar los no disponibles con otros del menú
            {"\n"}• Los disponibles se mantendrán en tu pedido modificado
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: "#ffc107",
            borderRadius: 8,
            padding: 14,
            alignItems: "center",
          }}
          onPress={() => {
            onModifyRejectedItems(allItemsRequiringModification);
          }}
        >
          <Text
            style={{
              color: "#1a1a1a",
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            🔄 Modificar Selección
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Renderizar items rejected como información "sin stock" cuando ya no requieren modificación
  const renderRejectedItemsAsInfo = () => {
    const rejectedItems = groups.rejected;
    const needsModificationItems = groups.needs_modification;
    const pendingItems = groups.pending;

    // Solo mostrar si hay items rejected PERO ya no se requiere modificación
    const hasItemsNeedingAction = needsModificationItems.length > 0;
    const hasModificationsAlreadySent =
      rejectedItems.length > 0 && pendingItems.length > 0;

    // Verificar si la tanda ya fue procesada
    const acceptedItems = groups.accepted;
    const preparingItems = groups.preparing;
    const readyItems = groups.ready;
    const deliveredItems = groups.delivered;

    const tandaWasProcessed =
      acceptedItems.length > 0 ||
      preparingItems.length > 0 ||
      readyItems.length > 0 ||
      deliveredItems.length > 0;

    // Mostrar info de rejected solo si:
    // - Hay items rejected Y
    // - NO hay items que necesiten acción Y
    // - (La tanda fue procesada O ya se enviaron modificaciones)
    const shouldShowRejectedInfo =
      rejectedItems.length > 0 &&
      !hasItemsNeedingAction &&
      (tandaWasProcessed || hasModificationsAlreadySent);

    if (!shouldShowRejectedInfo) return null;

    return (
      <View
        style={{
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "rgba(239, 68, 68, 0.3)",
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <X size={22} color="#ef4444" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#ef4444",
              }}
            >
              ❌ Productos Sin Stock
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              Estos productos no estaban disponibles en el momento del pedido
            </Text>
          </View>
        </View>

        {/* Lista de items rechazados */}
        {rejectedItems.map((item, index) => (
          <View
            key={item.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              borderRadius: 8,
              marginBottom: 6,
              borderLeftWidth: 3,
              borderLeftColor: "#ef4444",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: "#ef4444",
                  textDecorationLine: "line-through",
                }}
              >
                {item.menu_item?.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#dc2626",
                }}
              >
                Cantidad: {item.quantity} • Sin stock disponible
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: "#ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              SIN STOCK
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderItemGroup = (status: OrderItemStatus, items: OrderItem[]) => {
    if (items.length === 0) return null;

    // No renderizar grupos individuales si ya están en el grupo de modificación
    if (status === "rejected" || status === "needs_modification") return null;

    // Para items pending, solo ocultar los que pertenecen a la misma tanda de modificación
    if (
      status === "pending" &&
      (groups.rejected.length > 0 || groups.needs_modification.length > 0)
    ) {
      // Obtener batch_ids de items que requieren modificación
      const modificationBatchIds = new Set(
        [
          ...groups.rejected.map(item => item.batch_id),
          ...groups.needs_modification.map(item => item.batch_id),
        ].filter(Boolean), // Filtrar null/undefined
      );

      // Filtrar solo items pending que NO pertenecen a tandas de modificación
      const newTandaItems = items.filter(item => {
        // Si el item no tiene batch_id, considerarlo como nueva tanda
        if (!item.batch_id) return true;
        // Si el batch_id no está en los de modificación, es nueva tanda
        return !modificationBatchIds.has(item.batch_id);
      });

      // Si todos los items pending son de modificación, no renderizar este grupo
      if (newTandaItems.length === 0) return null;

      // Renderizar solo los items de nuevas tandas
      items = newTandaItems;
    }

    const statusInfo = getStatusInfo(status);
    const StatusIcon = statusInfo.icon;

    return (
      <View
        key={status}
        style={{
          backgroundColor: statusInfo.bgColor,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: statusInfo.color + "40",
        }}
      >
        {/* Header del grupo */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <StatusIcon size={20} color={statusInfo.color} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: statusInfo.color,
              }}
            >
              {statusInfo.title}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              {statusInfo.description}
            </Text>
          </View>
        </View>

        {/* Lista de items */}
        {items.map((item, index) => (
          <View
            key={item.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              borderTopWidth: index > 0 ? 1 : 0,
              borderTopColor: "#e5e7eb",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: "#111827",
                }}
              >
                {item.menu_item?.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Cantidad: {item.quantity}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: statusInfo.color,
              }}
            >
              ${item.subtotal}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const canAddMoreItems = () => {
    // Solo se pueden agregar más items si no hay items que requieran modificación
    // y hay al menos algunos items aceptados (no todos rechazados)
    const hasItemsRequiringModification =
      groups.pending.length > 0 ||
      groups.needs_modification.length > 0 ||
      groups.rejected.length > 0;

    const hasAcceptedOrBetter =
      groups.accepted.length > 0 ||
      groups.preparing.length > 0 ||
      groups.ready.length > 0 ||
      groups.delivered.length > 0;

    return (
      !hasItemsRequiringModification && hasAcceptedOrBetter && !order.is_paid
    );
  };

  return (
    <View style={{ padding: 16 }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "bold",
          color: "#111827",
          marginBottom: 16,
        }}
      >
        Estado de tu Pedido
      </Text>

      <Text
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 16,
        }}
      >
        Mesa {order.table?.number || "N/A"} •{" "}
        {new Date(order.created_at).toLocaleString()}
      </Text>

      {/* Sección unificada de modificación requerida */}
      {renderModificationRequiredGroup()}

      {/* Items rejected como información (cuando ya no requieren modificación) */}
      {renderRejectedItemsAsInfo()}

      {/* Grupos de items por estado (excluyendo los que ya están en modificación) */}
      {Object.entries(groups).map(([status, items]) =>
        renderItemGroup(status as OrderItemStatus, items),
      )}

      {/* Botón para agregar más items */}
      {canAddMoreItems() && (
        <TouchableOpacity
          style={{
            backgroundColor: "#22c55e",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 8,
          }}
          onPress={onAddMoreItems}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "600",
              fontSize: 16,
            }}
          >
            Agregar Más Productos
          </Text>
        </TouchableOpacity>
      )}

      {/* Información adicional */}
      <View
        style={{
          backgroundColor: "#f9fafb",
          borderRadius: 8,
          padding: 12,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          💡 Cuando hay productos que requieren modificación, debes resolverlos
          antes de poder agregar más items al pedido.
        </Text>
      </View>

      {/* Total actual */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "#111827",
          }}
        >
          Total del Pedido:
        </Text>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: "#22c55e",
          }}
        >
          ${order.total_amount}
        </Text>
      </View>
    </View>
  );
};

export default OrderStatusView;
