import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ToastAndroid } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { awardIfFirstWin } from "../../storage/discountStorage";
import { useAuth } from "../../auth/useAuth";

const DISCOUNT = 20;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const target = [1, 2, 3, 4, 5, 6, 7, 8, null];

export default function PuzzleGame() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const generateTiles = () =>
    Array.from({ length: 9 }, (_, i) => (i < 8 ? i + 1 : null)).sort(
      () => Math.random() - 0.5,
    );

  const [tiles, setTiles] = useState<(number | null)[]>(generateTiles());

  const moveTile = (index: number) => {
    const emptyIndex = tiles.indexOf(null);
    const validMoves = [index - 1, index + 1, index - 3, index + 3];
    if (!validMoves.includes(emptyIndex)) return;

    const newTiles = [...tiles];
    [newTiles[index], newTiles[emptyIndex]] = [
      newTiles[emptyIndex],
      newTiles[index],
    ];
    setTiles(newTiles);

    if (isSolved(newTiles)) {
      handleWin();
    }
  };

  const isSolved = (arr: (number | null)[]) =>
    JSON.stringify(arr) === JSON.stringify(target);

  const handleWin = async () => {
    // Verificar si es usuario anónimo
    if (user?.profile_code === "cliente_anonimo") {
      ToastAndroid.show("🎉 ¡Ganaste el juego! (Los usuarios anónimos no reciben descuentos)", ToastAndroid.LONG);
      setTimeout(() => {
        navigation.navigate("Games" as any);
      }, 2500);
      return;
    }
    
    const res = await awardIfFirstWin(true, DISCOUNT, user?.profile_code);
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
        ToastAndroid.show(`🎮 Ganaste, pero ya tenés ${currentDiscount}% de descuento (mayor o igual)`, ToastAndroid.LONG);
      } else {
        ToastAndroid.show("🎮 Ganaste, pero ya no hay premio disponible", ToastAndroid.LONG);
      }
    }
    
    // Navegar después de mostrar el toast
    setTimeout(() => {
      navigation.navigate("Games");
    }, 2000);
  };

  const resetGame = () => setTiles(generateTiles());

  return (
    <LinearGradient colors={["#161412", "#2b1712"]} style={styles.container}>
      <Text style={styles.title}>Rompecabezas 3x3</Text>
      <Text style={styles.subtitle}>Ordená los números del 1 al 8</Text>

      <View style={styles.grid}>
        {tiles.map((num, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.cell, num === null && styles.empty]}
            onPress={() => moveTile(i)}
            activeOpacity={0.9}
          >
            {num && <Text style={styles.number}>{num}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.button} onPress={resetGame}>
          <Text style={styles.buttonText}>🔄 Resetear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Games" as any)}
        >
          <Text style={styles.buttonText}>🏠 Volver</Text>
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
  subtitle: { color: "#cfc4b8", marginBottom: 20 },
  grid: {
    width: 270,
    height: 270,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  cell: {
    width: 80,
    height: 80,
    margin: 3,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    elevation: 6,
  },
  empty: { backgroundColor: "transparent" },
  number: { fontSize: 24, fontWeight: "800", color: "#1a1a1a" },
  buttons: { flexDirection: "row", marginTop: 12 },
  button: {
    backgroundColor: "#d4af37",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  buttonText: { color: "#1a1a1a", fontWeight: "800" },
});
