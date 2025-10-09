import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { X, Plus, Minus } from "lucide-react-native";
import type { OrderItem } from "../../types/Order";
import type { CartItem } from "../../context/CartContext";

interface ModifyRejectedItemsModalProps {
  visible: boolean;
  rejectedItems: OrderItem[];
  onClose: () => void;
  onSubmitChanges: (newItems: CartItem[]) => Promise<void>;
  availableMenuItems: any[]; // Aquí deberías usar tu tipo de menu item
}

const ModifyRejectedItemsModal: React.FC<ModifyRejectedItemsModalProps> = ({
  visible,
  rejectedItems,
  onClose,
  onSubmitChanges,
  availableMenuItems,
}) => {
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Inicializar con los items rechazados convertidos
  React.useEffect(() => {
    if (visible && rejectedItems.length > 0) {
      const convertedItems: CartItem[] = rejectedItems.map(item => ({
        id: item.menu_item_id,
        name: item.menu_item?.name || "",
        price: item.unit_price,
        quantity: item.quantity,
        prepMinutes: item.menu_item?.prep_minutes || 0,
        category: item.menu_item?.category || "",
      }));
      setSelectedItems(convertedItems);
    }
  }, [visible, rejectedItems]);

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(prev => prev.filter(item => item.id !== itemId));
    } else {
      setSelectedItems(prev => {
        const existingIndex = prev.findIndex(item => item.id === itemId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], quantity };
          return updated;
        }
        return prev;
      });
    }
  };

  const addMenuItem = (menuItem: any) => {
    const existingIndex = selectedItems.findIndex(
      item => item.id === menuItem.id,
    );

    if (existingIndex >= 0) {
      updateQuantity(menuItem.id, selectedItems[existingIndex].quantity + 1);
    } else {
      const newItem: CartItem = {
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        prepMinutes: menuItem.prep_minutes,
        category: menuItem.category,
      };
      setSelectedItems(prev => [...prev, newItem]);
    }
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      Alert.alert("Error", "Debes seleccionar al menos un producto");
      return;
    }

    setIsLoading(true);
    try {
      await onSubmitChanges(selectedItems);
      setSelectedItems([]);
      onClose();
    } catch (error) {
      Alert.alert("Error", "No se pudieron guardar los cambios");
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalAmount = () => {
    return selectedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={{ flex: 1, backgroundColor: "white" }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#111827",
            }}
          >
            Modificar Productos Rechazados
          </Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }}>
          {/* Items rechazados originales */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#ef4444",
                marginBottom: 12,
              }}
            >
              Productos Rechazados:
            </Text>
            {rejectedItems.map(item => (
              <View
                key={item.id}
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.2)",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "500" }}>
                  {item.menu_item?.name}
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280" }}>
                  Cantidad: {item.quantity} • ${item.subtotal}
                </Text>
              </View>
            ))}
          </View>

          {/* Items seleccionados actualmente */}
          {selectedItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#22c55e",
                  marginBottom: 12,
                }}
              >
                Nuevos Productos Seleccionados:
              </Text>
              {selectedItems.map(item => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#f9fafb",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500" }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>
                      ${item.price} c/u
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                      style={{
                        backgroundColor: "#ef4444",
                        borderRadius: 16,
                        width: 32,
                        height: 32,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Minus size={16} color="white" />
                    </TouchableOpacity>

                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        marginHorizontal: 16,
                      }}
                    >
                      {item.quantity}
                    </Text>

                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                      style={{
                        backgroundColor: "#22c55e",
                        borderRadius: 16,
                        width: 32,
                        height: 32,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Plus size={16} color="white" />
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#22c55e",
                      marginLeft: 16,
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    ${item.price * item.quantity}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Lista de productos disponibles */}
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#111827",
                marginBottom: 12,
              }}
            >
              Productos Disponibles:
            </Text>
            {availableMenuItems.map(menuItem => (
              <TouchableOpacity
                key={menuItem.id}
                onPress={() => addMenuItem(menuItem)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  marginBottom: 8,
                  backgroundColor: "white",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500" }}>
                    {menuItem.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6b7280" }}>
                    {menuItem.category}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#22c55e",
                  }}
                >
                  ${menuItem.price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Footer con total y botones */}
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
            backgroundColor: "white",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#111827",
              }}
            >
              Total:
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: "#22c55e",
              }}
            >
              ${getTotalAmount()}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: "#f3f4f6",
                borderRadius: 8,
                padding: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#6b7280",
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || selectedItems.length === 0}
              style={{
                flex: 2,
                backgroundColor:
                  selectedItems.length > 0 ? "#22c55e" : "#d1d5db",
                borderRadius: 8,
                padding: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "white",
                }}
              >
                {isLoading ? "Enviando..." : "Confirmar Cambios"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ModifyRejectedItemsModal;
