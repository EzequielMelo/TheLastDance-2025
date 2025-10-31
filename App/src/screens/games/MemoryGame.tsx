import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ToastAndroid } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { awardIfFirstWin } from "../../storage/discountStorage";

const COLORS = ["#ff7675", "#74b9ff", "#55efc4", "#ffeaa7"];
const DISCOUNT = 10;
const MAX_ROUNDS = 3;
const BASE_LENGTH = 3;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function hexToRgba(hex: string, alpha = 1) {
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3
      ? h
          .split("")
          .map(ch => ch + ch)
          .join("")
      : h,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function MemoryGame() {
  const [pattern, setPattern] = useState<number[]>([]);
  const [player, setPlayer] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [active, setActive] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);

  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    startRound(1);
  }, []);

  const startRound = (nextRound: number) => {
    let newPattern =
      nextRound === 1
        ? Array.from({ length: BASE_LENGTH }, () =>
            Math.floor(Math.random() * COLORS.length),
          )
        : [...pattern, Math.floor(Math.random() * COLORS.length)];
    setPattern(newPattern);
    setPlayer([]);
    setRound(nextRound);
    showPattern(newPattern);
  };

  const showPattern = async (p: number[]) => {
    setShowing(true);
    for (let i = 0; i < p.length; i++) {
      setActive(p[i]);
      await new Promise(r => setTimeout(r, 600));
      setActive(null);
      await new Promise(r => setTimeout(r, 250));
    }
    setShowing(false);
  };

  const handlePress = async (index: number) => {
    if (showing) return;
    setActive(index);
    setTimeout(() => setActive(null), 200);

    const next = [...player, index];
    setPlayer(next);

    if (pattern[next.length - 1] !== index) {
      ToastAndroid.show("❌ Fallaste - Volvés al inicio", ToastAndroid.SHORT);
      setTimeout(() => {
        navigation.navigate("Games" as any);
      }, 1500);
      return;
    }

    if (next.length === pattern.length) {
      if (round >= MAX_ROUNDS) {
        const res = await awardIfFirstWin(true, DISCOUNT);
        if (res.awarded) {
          const currentDiscount = res.discount?.amount || DISCOUNT;
          if (currentDiscount > DISCOUNT) {
            ToastAndroid.show(`🎉 ¡Ganaste! Mantienes tu descuento de ${currentDiscount}%`, ToastAndroid.LONG);
          } else {
            ToastAndroid.show(`🎉 ¡Ganaste! Obtuviste ${DISCOUNT}% de descuento`, ToastAndroid.LONG);
          }
        } else {
          const currentDiscount = res.discount?.amount || 0;
          if (currentDiscount >= DISCOUNT) {
            ToastAndroid.show(`🎉 Ganaste, pero ya tenés ${currentDiscount}% de descuento (mayor o igual)`, ToastAndroid.LONG);
          } else {
            ToastAndroid.show("🎉 Ganaste, pero ya no hay premio disponible", ToastAndroid.LONG);
          }
        }
        setTimeout(() => {
          navigation.navigate("Games" as any);
        }, 2500);
      } else {
        startRound(round + 1);
      }
    }
  };

  return (
    <LinearGradient colors={["#161412", "#2b1712"]} style={styles.container}>
      <Text style={styles.title}>
        Simon — Ronda {round}/{MAX_ROUNDS}
      </Text>
      <Text style={styles.subtitle}>
        Repetí el patrón. Cada ronda se vuelve más largo!
      </Text>

      <View style={styles.grid}>
        {COLORS.map((color, i) => {
          const bg =
            (showing && active === i) || (!showing && active === i)
              ? color
              : hexToRgba(color, 0.32);

          const isActiveVisual = active === i;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => handlePress(i)}
              style={[
                styles.tile,
                { backgroundColor: bg },
                isActiveVisual && styles.activeTile,
              ]}
              activeOpacity={0.9}
            />
          );
        })}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={() => navigation.navigate("Games" as any)}
        >
          <Text style={styles.smallText}>🏠 Volver</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallButton}
          onPress={() => showing || showPattern(pattern)}
        >
          <Text style={styles.smallText}>🔁 Repetir</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 6 },
  subtitle: { color: "#cfc4b8", marginBottom: 18, textAlign: "center" },
  grid: {
    width: 260,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  tile: {
    width: 100,
    height: 100,
    margin: 8,
    borderRadius: 14,
    elevation: 4,
  },
  activeTile: {
    transform: [{ scale: 1.06 }],
    borderWidth: 3,
    borderColor: "#222",
  },
  controls: { flexDirection: "row", marginTop: 28 },
  smallButton: {
    backgroundColor: "#d4af37",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  smallText: { color: "#1a1a1a", fontWeight: "800" },
});
