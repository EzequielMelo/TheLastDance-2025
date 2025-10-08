import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ShoppingCart, Clock } from "lucide-react-native";
import { useCart } from "../../context/CartContext";

interface FloatingCartProps {
  onPress: () => void;
}

export default function FloatingCart({ onPress }: FloatingCartProps) {
  const { pendingCount, pendingAmount, pendingTime } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  if (pendingCount === 0) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: "#d4af37",
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
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{
          backgroundColor: "#1a1a1a",
          borderRadius: 12,
          width: 24,
          height: 24,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}>
          <Text style={{
            color: "#d4af37",
            fontSize: 12,
            fontWeight: "600",
          }}>
            {pendingCount}
          </Text>
        </View>
        
        <View>
          <Text style={{
            color: "#1a1a1a",
            fontSize: 18,
            fontWeight: "600",
          }}>
            {formatPrice(pendingAmount)}
          </Text>
          <Text style={{
            color: "#1a1a1a",
            fontSize: 12,
            opacity: 0.8,
          }}>
            Tiempo: {pendingTime} min
          </Text>
        </View>
      </View>

      <View style={{
        backgroundColor: "#1a1a1a",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
      }}>
        <ShoppingCart size={16} color="#d4af37" />
        <Text style={{
          color: "#d4af37",
          fontWeight: "600",
          marginLeft: 6,
        }}>
          Ver Carrito
        </Text>
      </View>
    </TouchableOpacity>
  );
}