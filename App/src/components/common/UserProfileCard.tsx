import React, { useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import { User as UserIcon, Gift } from "lucide-react-native";
import { User } from "../../types/User";
import { getDiscount, Discount } from "../../storage/discountStorage";

interface UserProfileCardProps {
  user: User;
  getProfileLabel: (profileCode: string, positionCode?: string) => string;
}

export default function UserProfileCard({
  user,
  getProfileLabel,
}: UserProfileCardProps) {
  const [discount, setDiscount] = useState<Discount | null>(null);

  useEffect(() => {
    // Solo obtener descuento si es cliente registrado
    if (user?.profile_code === "cliente_registrado") {
      let mounted = true;
      (async () => {
        const discountData = await getDiscount();
        if (mounted && discountData && discountData.received) {
          setDiscount(discountData);
        }
      })();
      return () => {
        mounted = false;
      };
    }
  }, [user?.profile_code]);

  return (
    <View
      style={{
        backgroundColor: "rgba(212, 175, 55, 0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(212, 175, 55, 0.3)",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "#333",
          marginBottom: 16,
          overflow: "hidden",
          borderWidth: 3,
          borderColor: "#d4af37",
        }}
      >
        {(user as any)?.photo_url ? (
          <Image
            source={{ uri: (user as any).photo_url }}
            style={{ width: "100%", height: "100%", borderRadius: 60 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <UserIcon size={60} color="#d4af37" />
          </View>
        )}
      </View>
      <Text
        style={{
          color: "#d4af37",
          fontSize: 20,
          fontWeight: "700",
          marginBottom: 4,
        }}
      >
        {user?.first_name} {user?.last_name}
      </Text>
      <Text
        style={{
          color: "#fff",
          fontSize: 16,
          opacity: 0.8,
        }}
      >
        {getProfileLabel(user?.profile_code, user?.position_code || undefined)}
      </Text>

      {/* Mostrar descuento si está disponible y es cliente registrado */}
      {discount && user?.profile_code === "cliente_registrado" && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: "rgba(16, 185, 129, 0.3)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Gift size={20} color="#10b981" style={{ marginRight: 8 }} />
          <Text
            style={{
              color: "#10b981",
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            Descuento ganado: {discount.amount}%
          </Text>
        </View>
      )}
    </View>
  );
}
