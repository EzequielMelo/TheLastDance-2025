import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LucideIcon } from "lucide-react-native";

interface AdminActionButtonProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  variant?: "default" | "secondary";
}

export default function AdminActionButton({
  icon: Icon,
  label,
  onPress,
  variant = "default",
}: AdminActionButtonProps) {
  const bgColor = variant === "secondary" 
    ? "rgba(255, 255, 255, 0.05)" 
    : "rgba(212, 175, 55, 0.1)";
  
  const borderColor = variant === "secondary"
    ? "rgba(255, 255, 255, 0.2)"
    : "rgba(212, 175, 55, 0.3)";

  const iconColor = variant === "secondary" ? "#9ca3af" : "#d4af37";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        alignItems: "center",
        width: 70,
      }}
    >
      {/* Círculo del ícono */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor: borderColor,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
        }}
      >
        <Icon size={24} color={iconColor} strokeWidth={1.5} />
      </View>

      {/* Label */}
      <Text
        style={{
          color: "white",
          fontSize: 11,
          textAlign: "center",
          fontWeight: "500",
          lineHeight: 14,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
