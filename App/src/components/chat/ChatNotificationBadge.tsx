import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ChatNotificationBadgeProps {
  count: number;
  size?: "small" | "medium" | "large";
  style?: any;
}

export const ChatNotificationBadge: React.FC<ChatNotificationBadgeProps> = ({
  count,
  size = "medium",
  style,
}) => {
  if (count <= 0) return null;

  const sizeStyles = {
    small: styles.badgeSmall,
    medium: styles.badgeMedium,
    large: styles.badgeLarge,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  return (
    <View style={[styles.badge, sizeStyles[size], style]}>
      <Text style={[styles.text, textSizeStyles[size]]}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    position: "absolute",
    zIndex: 1000,
  },
  badgeSmall: {
    minWidth: 16,
    height: 16,
    top: -8,
    right: -8,
  },
  badgeMedium: {
    minWidth: 20,
    height: 20,
    top: -10,
    right: -10,
  },
  badgeLarge: {
    minWidth: 24,
    height: 24,
    top: -12,
    right: -12,
  },
  text: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
  textLarge: {
    fontSize: 14,
  },
});
