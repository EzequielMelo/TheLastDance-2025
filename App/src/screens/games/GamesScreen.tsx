import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gamepad2, ArrowLeft } from "lucide-react-native";
import GameCard from "../../components/game/GameCard";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { getDiscount } from "../../storage/discountStorage";
import { useAuth } from "../../auth/useAuth";

const simonImg = require("../../../assets/simon.png");
const mathImg = require("../../../assets/math-quiz.png");
const puzzleImg = require("../../../assets/sliding-puzzle.png");
const mozoImg = require("../../../assets/mozo.png");

const GAMES = [
  {
    key: "Memory",
    title: "Simon",
    subtitle: "Repetí el patrón sin olvidarte!",
    discount: 10,
    image: simonImg,
  },
  {
    key: "FastMath",
    title: "Quiz Matemático",
    subtitle: "Contestá correctamente antes de que el tiempo se termine!",
    discount: 15,
    image: mathImg,
  },
  {
    key: "Puzzle",
    title: "Rompecabezas deslizable",
    subtitle: "Ordená las piezas del 1 al 8",
    discount: 20,
    image: puzzleImg,
  },
  {
    key: "WaiterMaze",
    title: "Mozo en Apuros",
    subtitle: "Esquivá obstáculos y llegá a la mesa usando el giroscopio!",
    discount: 20,
    image: mozoImg,
  },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GamesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [discount, setDiscount] = useState<number | null>(null);

  useEffect(() => {
    // Solo cargar descuentos para usuarios registrados
    if (user?.profile_code === "cliente_registrado") {
      let mounted = true;
      (async () => {
        const d = await getDiscount();
        if (!mounted) return;
        setDiscount(d && d.received ? d.amount : null);
      })();
      return () => {
        mounted = false;
      };
    }
  }, [user?.profile_code]);

  return (
    <LinearGradient
      colors={["#161412", "#2b1712", "#161412"]}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Gamepad2 size={28} color="#d4af37" />
          <Text style={styles.headerTitle}>Juegos</Text>
        </View>
      </View>

      {/* Banner */}
      <View
        style={[
          styles.banner,
          discount ? styles.bannerActive : styles.bannerNeutral,
        ]}
      >
        <Text style={styles.bannerText}>
          {discount
            ? `Descuento aplicado: ${discount}%`
            : user?.profile_code === "cliente_anonimo"
              ? "Juega y divertite - Los descuentos están disponibles solo para usuarios registrados"
              : "Ganá un descuento si ganás en tu primera victoria"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Nuestros juegos disponibles</Text>

        <Text style={styles.info}>
          {user?.profile_code === "cliente_anonimo"
            ? "Seleccioná un juego y divertite. Los descuentos están disponibles solo para usuarios registrados."
            : "Seleccioná un juego. La primera victoria que consigas en cualquiera de los juegos desbloquea un descuento para la cuenta!"}
        </Text>

        <View style={styles.list}>
          {GAMES.map(g => (
            <View key={g.key} style={styles.cardWrap}>
              <GameCard
                title={g.title}
                subtitle={g.subtitle}
                discount={g.discount}
                image={g.image}
                onPress={() => navigation.navigate(g.key as any)}
              />
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          onPress={() => navigation.popTo("Home")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 46,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(212,175,55,0.08)",
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginLeft: 10,
  },

  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  bannerActive: { backgroundColor: "#e6ffed" },
  bannerNeutral: { backgroundColor: "#fff8e6" },
  bannerText: { fontWeight: "700", color: "#0b2a12" },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: { fontSize: 24, fontWeight: "900", color: "#fff", marginBottom: 8 },
  info: { color: "#cfc4b8", marginBottom: 14 },

  list: { marginTop: 6 },
  cardWrap: {
    marginBottom: 12,
  },

  bottomActions: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: "#d4af37",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a1a",
  },
});
