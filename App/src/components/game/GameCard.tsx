import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  title: string;
  subtitle: string;
  discount: number;
  image?: ImageSourcePropType | string;
  onPress: () => void;
};

export default function GameCard({
  title,
  subtitle,
  discount,
  image,
  onPress,
}: Props) {
  const imageSource = typeof image === "string" ? { uri: image } : image;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}. Premio ${discount} por ciento`}
    >
      {/* fondo con gradiente */}
      <LinearGradient
        colors={["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]}
        start={[0, 0]}
        end={[1, 1]}
        style={styles.gradient}
      >
        {/* imagen izquierda */}
        {image ? (
          <Image
            source={imageSource as any}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder} />
        )}

        {/* info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>

          <View style={styles.row}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{discount}% Dto</Text>
            </View>

            <Text style={styles.cta}>Jugar ›</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 5 },
    }),
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
  },
  image: {
    width: 104,
    height: 104,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "#eee",
  },
  placeholder: {
    width: 104,
    height: 104,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tag: {
    backgroundColor: "transparent",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0,
  },
  tagText: {
    color: "#ffdca3",
    fontWeight: "800",
    fontSize: 13,
  },
  cta: {
    color: "#d4af37",
    fontWeight: "900",
    fontSize: 13,
  },
});
