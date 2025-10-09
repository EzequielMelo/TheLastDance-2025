import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView } from "react-native";
import type { OrderItem } from "../../types/Order";

interface PartialRejectModalProps {
  visible: boolean;
  orderItems: OrderItem[];
  onClose: () => void;
  onConfirm: (rejectedItemIds: string[]) => void;
  loading?: boolean;
}

export default function PartialRejectModal({
  visible,
  orderItems,
  onClose,
  onConfirm,
  loading = false,
}: PartialRejectModalProps) {
  const [selectedItems, setSelectedItems] = useState<{
    [key: string]: boolean;
  }>({});

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleConfirm = () => {
    const rejectedItemIds = Object.keys(selectedItems).filter(
      id => selectedItems[id],
    );
    onConfirm(rejectedItemIds);
  };

  const getSelectedCount = () => {
    return Object.values(selectedItems).filter(Boolean).length;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            padding: 20,
            borderRadius: 10,
            width: "90%",
            maxHeight: "80%",
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              marginBottom: 20,
              color: "#000",
            }}
          >
            Rechazar Productos
          </Text>

          <Text style={{ fontSize: 16, marginBottom: 15, color: "#000" }}>
            Productos: {orderItems?.length || 0}
          </Text>

          <ScrollView style={{ maxHeight: 300 }}>
            {orderItems &&
              orderItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleItemToggle(item.id)}
                  style={{
                    backgroundColor: selectedItems[item.id]
                      ? "#ffebee"
                      : "#f5f5f5",
                    padding: 15,
                    marginBottom: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedItems[item.id] ? "#f44336" : "#ddd",
                  }}
                >
                  <Text
                    style={{ color: "#000", fontSize: 16, fontWeight: "bold" }}
                  >
                    {index + 1}. {item.menu_item?.name || "Sin nombre"}
                  </Text>
                  <Text style={{ color: "#666", fontSize: 14, marginTop: 5 }}>
                    Cantidad: {item.quantity} | ${item.subtotal.toFixed(2)}
                  </Text>
                  {selectedItems[item.id] && (
                    <Text
                      style={{
                        color: "#f44336",
                        fontSize: 12,
                        fontWeight: "bold",
                        marginTop: 5,
                      }}
                    >
                      SELECCIONADO
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>

          {getSelectedCount() > 0 && (
            <View
              style={{
                backgroundColor: "#ffebee",
                padding: 10,
                borderRadius: 5,
                marginTop: 15,
                marginBottom: 15,
              }}
            >
              <Text
                style={{
                  color: "#f44336",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                Productos a rechazar: {getSelectedCount()}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", marginTop: 20 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: "#757575",
                padding: 15,
                borderRadius: 5,
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  color: "white",
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={getSelectedCount() === 0}
              style={{
                flex: 1,
                backgroundColor: getSelectedCount() > 0 ? "#f44336" : "#bdbdbd",
                padding: 15,
                borderRadius: 5,
                marginLeft: 10,
              }}
            >
              <Text
                style={{
                  color: "white",
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                {loading ? "Procesando..." : `Rechazar (${getSelectedCount()})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
