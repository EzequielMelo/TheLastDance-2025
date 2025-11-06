import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ShoppingCart } from "lucide-react-native";

interface FloatingModifyCartProps {
  onPress: () => void;
  selectedItems: { [key: string]: number };
  menuItems: any[];
}

export default function FloatingModifyCart({
  onPress,
  selectedItems,
  menuItems,
}: FloatingModifyCartProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  // Calcular cantidad total y precio total
  const cartCount = Object.values(selectedItems).reduce(
    (sum, qty) => sum + qty,
    0,
  );

  const cartAmount = Object.entries(selectedItems).reduce(
    (sum, [itemId, quantity]) => {
      const menuItem = menuItems.find(m => m.id === itemId);
      return sum + (menuItem ? menuItem.price * quantity : 0);
    },
    0,
  );

  // Calcular tiempo total estimado
  const cartTime = Object.entries(selectedItems).reduce(
    (maxTime, [itemId, quantity]) => {
      const menuItem = menuItems.find(m => m.id === itemId);
      return menuItem ? Math.max(maxTime, menuItem.prepMinutes) : maxTime;
    },
    0,
  );

  const isEmpty = cartCount === 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        position: "absolute",
        bottom: 5,
        left: 20,
        right: 20,
        backgroundColor: isEmpty ? "rgba(212,175,55,0.12)" : "#d4af37",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        borderWidth: isEmpty ? 1 : 0,
        borderColor: isEmpty ? "rgba(212,175,55,0.2)" : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: 12,
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text
            style={{
              color: isEmpty ? "#d1d5db" : "#d4af37",
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {isEmpty ? "0" : cartCount}
          </Text>
        </View>

        <View>
          <Text
            style={{
              color: isEmpty ? "#d1d5db" : "#1a1a1a",
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {isEmpty ? "Sin productos" : formatPrice(cartAmount)}
          </Text>
          <Text
            style={{
              color: isEmpty ? "#9ca3af" : "#1a1a1a",
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            {isEmpty ? "Selecciona productos" : `Tiempo: ${cartTime} min`}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: isEmpty ? "rgba(26,26,26,0.12)" : "#1a1a1a",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <ShoppingCart size={16} color={isEmpty ? "#9ca3af" : "#d4af37"} />
        <Text
          style={{
            color: isEmpty ? "#9ca3af" : "#d4af37",
            fontWeight: "600",
            marginLeft: 6,
          }}
        >
          Ver carrito
        </Text>
      </View>
    </TouchableOpacity>
  );
}
