import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";

interface AvatarProps {
  imageUrl?: string;
  name: string;
  size?: "small" | "medium" | "large";
  style?: any;
}

export default function Avatar({
  imageUrl,
  name,
  size = "medium",
  style,
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  // Reiniciar error cuando cambie la URL
  React.useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const getInitials = (fullName: string) => {
    const names = fullName.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return fullName[0]?.toUpperCase() || "?";
  };

  const sizeStyles = {
    small: { width: 32, height: 32, fontSize: 12 },
    medium: { width: 40, height: 40, fontSize: 14 },
    large: { width: 56, height: 56, fontSize: 18 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        {
          width: currentSize.width,
          height: currentSize.height,
        },
        style,
      ]}
    >
      {imageUrl && !imageError ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            {
              width: currentSize.width,
              height: currentSize.height,
            },
          ]}
          onError={() => setImageError(true)}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: currentSize.width,
              height: currentSize.height,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: currentSize.fontSize }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "#2d2d2d",
    borderWidth: 2,
    borderColor: "#d4af37",
  },
  image: {
    borderRadius: 50,
  },
  placeholder: {
    backgroundColor: "#d4af37",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 50,
  },
  initials: {
    color: "#1a1a1a",
    fontWeight: "bold",
  },
});
