import React from "react";
import { TouchableOpacity, View, Text } from "react-native";
import { LucideIcon } from "lucide-react-native";

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconSize?: number;
  onPress: () => void;
  variant?: "primary" | "secondary";
  style?: any;
}

export default function ActionCard({
  title,
  description,
  icon: Icon,
  iconSize = 20,
  onPress,
  variant = "secondary",
  style,
}: ActionCardProps) {
  const isPrimary = variant === "primary";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          backgroundColor: isPrimary
            ? "rgba(212, 175, 55, 0.15)"
            : "rgba(255, 255, 255, 0.05)",
          borderRadius: isPrimary ? 16 : 12,
          padding: isPrimary ? 20 : 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: isPrimary
            ? "rgba(212, 175, 55, 0.3)"
            : "rgba(255, 255, 255, 0.1)",
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: isPrimary ? "#d4af37" : "white",
              fontSize: isPrimary ? 20 : 18,
              fontWeight: isPrimary ? "700" : "600",
              marginBottom: isPrimary ? 4 : 2,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: isPrimary ? "white" : "#9ca3af",
              fontSize: isPrimary ? 16 : 14,
              lineHeight: isPrimary ? 22 : 20,
            }}
          >
            {description}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: isPrimary
              ? "rgba(212, 175, 55, 0.2)"
              : "transparent",
            borderRadius: isPrimary ? 12 : 0,
            padding: isPrimary ? 12 : 0,
            marginLeft: 16,
          }}
        >
          <Icon
            size={isPrimary ? 24 : iconSize}
            color={isPrimary ? "#d4af37" : "#9ca3af"}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
