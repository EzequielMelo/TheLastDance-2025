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
  FileText,
  ArrowLeft,
  Star,
  MessageSquare,
  Clock,
  ThumbsUp,
} from "lucide-react-native";

const { width } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SurveyScreen() {
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
          <FileText size={32} color="#d4af37" />
          <Text style={styles.headerTitle}>Encuesta</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.surveyCard}>
          <MessageSquare size={48} color="#d4af37" />
          <Text style={styles.surveyTitle}>Tu Opinión es Importante</Text>
          <Text style={styles.surveySubtitle}>
            Ayúdanos a mejorar tu experiencia
          </Text>
          <Text style={styles.surveyDescription}>
            Pronto podrás compartir tu opinión sobre diversos aspectos de tu 
            experiencia en nuestro restaurante. Tu feedback nos ayuda a 
            brindar un mejor servicio.
          </Text>
          
          <View style={styles.categoriesList}>
            <View style={styles.categoryItem}>
              <Star size={20} color="#d4af37" />
              <Text style={styles.categoryText}>Calidad de la comida</Text>
            </View>
            <View style={styles.categoryItem}>
              <ThumbsUp size={20} color="#d4af37" />
              <Text style={styles.categoryText}>Atención del personal</Text>
            </View>
            <View style={styles.categoryItem}>
              <Clock size={20} color="#d4af37" />
              <Text style={styles.categoryText}>Tiempo de espera</Text>
            </View>
            <View style={styles.categoryItem}>
              <MessageSquare size={20} color="#d4af37" />
              <Text style={styles.categoryText}>Ambiente del restaurante</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <Clock size={20} color="#f59e0b" />
          <Text style={styles.statusText}>
            Estado: Próximamente disponible
          </Text>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Volver</Text>
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
  surveyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.2)",
  },
  surveyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  surveySubtitle: {
    fontSize: 16,
    color: "#d4af37",
    marginBottom: 12,
    textAlign: "center",
  },
  surveyDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  categoriesList: {
    width: "100%",
    maxWidth: 300,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.2)",
  },
  categoryText: {
    fontSize: 14,
    color: "#d1d5db",
    marginLeft: 10,
    flex: 1,
    fontWeight: "500",
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