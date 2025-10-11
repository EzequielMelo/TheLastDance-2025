import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import {
  Gamepad2,
  ArrowLeft,
  Construction,
  Clock,
} from "lucide-react-native";

const { width } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GamesScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#d4af37" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Gamepad2 size={32} color="#d4af37" />
          <Text style={styles.headerTitle}>Juegos</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.constructionCard}>
          <Construction size={48} color="#d4af37" />
          <Text style={styles.constructionTitle}>En Desarrollo</Text>
          <Text style={styles.constructionSubtitle}>
            Los juegos están siendo desarrollados
          </Text>
          <Text style={styles.constructionDescription}>
            Pronto podrás disfrutar de una variedad de juegos entretenidos 
            mientras esperas tu pedido. ¡Mantente atento a las actualizaciones!
          </Text>
          
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Trivia sobre gastronomía</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Juegos de memoria</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Desafíos rápidos</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Puntuaciones y logros</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <Clock size={20} color="#f59e0b" />
          <Text style={styles.statusText}>
            Estado: En proceso de desarrollo
          </Text>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Volver al Menú</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -40, // Compensar el botón de atrás
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginLeft: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  constructionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.2)",
  },
  constructionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginTop: 12,
    marginBottom: 6,
  },
  constructionSubtitle: {
    fontSize: 16,
    color: "#d4af37",
    marginBottom: 12,
    textAlign: "center",
  },
  constructionDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  featuresList: {
    width: "100%",
    maxWidth: 260,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d4af37",
    marginRight: 10,
  },
  featureText: {
    fontSize: 14,
    color: "#d1d5db",
    flex: 1,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  statusText: {
    fontSize: 14,
    color: "#f59e0b",
    fontWeight: "600",
    marginLeft: 10,
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 24,
  },
  primaryButton: {
    backgroundColor: "#d4af37",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
});