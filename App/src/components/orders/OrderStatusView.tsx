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
          title: "Rechazados",
          description: "Estos productos no están disponibles",
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

  const renderItemGroup = (status: OrderItemStatus, items: OrderItem[]) => {
    if (items.length === 0) return null;

    const statusInfo = getStatusInfo(status);
    const StatusIcon = statusInfo.icon;
    const canModify = status === "rejected" || status === "pending";

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

        {/* Botón de acción para items rechazados */}
        {status === "rejected" && (
          <TouchableOpacity
            style={{
              backgroundColor: statusInfo.color,
              borderRadius: 8,
              padding: 12,
              marginTop: 12,
              alignItems: "center",
            }}
            onPress={() => onModifyRejectedItems(items)}
          >
            <Text
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Modificar Productos Rechazados
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const canAddMoreItems = () => {
    // Solo se pueden agregar más items si no hay items pendientes
    // y hay al menos algunos items aceptados (no todos rechazados)
    const hasPendingItems = groups.pending.length > 0;
    const hasAcceptedOrBetter =
      groups.accepted.length > 0 ||
      groups.preparing.length > 0 ||
      groups.ready.length > 0 ||
      groups.delivered.length > 0;

    return !hasPendingItems && hasAcceptedOrBetter && !order.is_paid;
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

      {/* Grupos de items por estado */}
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
          💡 Puedes modificar productos rechazados o agregar nuevos items cuando
          no haya productos esperando confirmación.
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
