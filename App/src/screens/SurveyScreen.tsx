import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import {
  FileText,
  Star,
  MessageSquare,
  Send,
  CheckCircle,
  AlertCircle,
  ChevronDown,
} from "lucide-react-native";
import api from "../api/axios";
import ChefLoading from "../components/common/ChefLoading";
import CustomAlert from "../components/common/CustomAlert";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SurveyScreenRouteProp = RouteProp<RootStackParamList, "Survey">;

export default function SurveyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SurveyScreenRouteProp>();
  const { tableId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Calificaciones
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [comment, setComment] = useState("");
  
  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Alert
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>;
  }>({
    type: "info",
    title: "",
    message: "",
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "info"
  ) => {
    setAlertConfig({ type, title, message });
    setShowAlert(true);
  };

  useEffect(() => {
    checkSurveyStatus();
  }, [tableId]);

  const checkSurveyStatus = async () => {
    if (!tableId) {
      showCustomAlert(
        "Error",
        "No se proporcionó información de la mesa",
        "error"
      );
      setLoading(false);
      return;
    }

    try {
      const response = await api.get(`/surveys/check-status/${tableId}`);
      setHasAnswered(response.data.hasAnswered);

      if (response.data.hasAnswered) {
        setAlertConfig({
          type: "info",
          title: "Encuesta ya respondida",
          message: "Ya has respondido una encuesta para esta estadía. ¡Gracias por tu opinión!",
          buttons: [
            {
              text: "Cancelar",
              style: "cancel",
            },
            {
              text: "Ver estadísticas",
              onPress: () => navigation.navigate("SurveyStats"),
            },
          ],
        });
        setShowAlert(true);
      }
    } catch (error: any) {
      console.error("Error verificando estado de encuesta:", error);
      showCustomAlert(
        "Error",
        "No se pudo verificar el estado de la encuesta",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const getRatingLabel = (rating: number): string => {
    const labels: { [key: number]: string } = {
      5: "Excelente",
      4: "Muy bueno",
      3: "Bueno",
      2: "Regular",
      1: "Malo",
    };
    return labels[rating] || "";
  };

  const handleSubmit = async () => {
    // Validar que se hayan dado todas las calificaciones
    if (foodRating === 0 || serviceRating === 0 || restaurantRating === 0) {
      showCustomAlert(
        "Calificaciones incompletas",
        "Por favor, califica todos los aspectos antes de enviar",
        "warning"
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/surveys", {
        table_id: tableId,
        food_rating: foodRating,
        service_rating: serviceRating,
        restaurant_rating: restaurantRating,
        comment: comment.trim() || null,
      });

      if (response.data.success) {
        showCustomAlert(
          "¡Gracias!",
          "Tu encuesta ha sido enviada exitosamente. ¡Apreciamos mucho tu opinión!",
          "success"
        );
        setHasAnswered(true);

        // Navegar de vuelta después de 2 segundos
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error enviando encuesta:", error);
      const errorMessage =
        error.response?.data?.error || "No se pudo enviar la encuesta";
      showCustomAlert("Error", errorMessage, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (
    currentRating: number,
    onPress: (rating: number) => void,
    label: string
  ) => {
    return (
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>{label}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => onPress(star)}
              disabled={hasAnswered}
              style={styles.starButton}
            >
              <Star
                size={36}
                color="#d4af37"
                fill={star <= currentRating ? "#d4af37" : "transparent"}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ChefLoading size="large" text="Cargando encuesta..." />
        </View>
      </LinearGradient>
    );
  }

  if (hasAnswered) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <FileText size={32} color="#d4af37" />
            <Text style={styles.headerTitle}>Encuesta</Text>
          </View>
        </View>

        <View style={styles.centerContent}>
          <CheckCircle size={64} color="#22c55e" />
          <Text style={styles.messageTitle}>¡Gracias!</Text>
          <Text style={styles.messageText}>
            Ya has respondido esta encuesta. Apreciamos mucho tu opinión.
          </Text>
        </View>

        <CustomAlert
          visible={showAlert}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onClose={() => setShowAlert(false)}
        />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <FileText size={32} color="#d4af37" />
          <Text style={styles.headerTitle}>Encuesta de Satisfacción</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Tu opinión es importante</Text>
          <Text style={styles.introText}>
            Ayúdanos a mejorar tu experiencia calificando los siguientes
            aspectos
          </Text>
        </View>

        {/* Calificación de la comida */}
        {renderStars(foodRating, setFoodRating, "🍽️ Calidad de la comida")}

        {/* Calificación del servicio */}
        {renderStars(
          serviceRating,
          setServiceRating,
          "👨‍🍳 Atención del mozo"
        )}

        {/* Calificación del restaurante - Dropdown */}
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingLabel}>🏪 Experiencia general</Text>
          
          <TouchableOpacity
            onPress={() => !hasAnswered && setDropdownOpen(!dropdownOpen)}
            disabled={hasAnswered}
            style={styles.dropdownButton}
          >
            <Text style={styles.dropdownButtonText}>
              {restaurantRating === 0 ? "Selecciona una calificación" : `${restaurantRating} - ${getRatingLabel(restaurantRating)}`}
            </Text>
            <ChevronDown 
              size={20} 
              color="#d4af37" 
              style={{ transform: [{ rotate: dropdownOpen ? "180deg" : "0deg" }] }}
            />
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {[5, 4, 3, 2, 1].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  onPress={() => {
                    setRestaurantRating(rating);
                    setDropdownOpen(false);
                  }}
                  style={[
                    styles.dropdownItem,
                    restaurantRating === rating && styles.dropdownItemSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      restaurantRating === rating && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {rating} - {getRatingLabel(rating)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Comentario opcional */}
        <View style={styles.commentContainer}>
          <View style={styles.commentHeader}>
            <MessageSquare size={20} color="#d4af37" />
            <Text style={styles.commentLabel}>
              Comentarios adicionales (opcional)
            </Text>
          </View>
          <TextInput
            style={styles.commentInput}
            placeholder="Comparte tu experiencia..."
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={4}
            maxLength={500}
            value={comment}
            onChangeText={setComment}
            editable={!hasAnswered}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{comment.length}/500</Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || hasAnswered}
          style={[
            styles.submitButton,
            (submitting || hasAnswered) && styles.submitButtonDisabled,
          ]}
        >
          {submitting ? (
            <ChefLoading size="small" text="Enviando..." color="#1a1a1a" />
          ) : (
            <>
              <Send size={20} color="#1a1a1a" />
              <Text style={styles.submitButtonText}>Enviar Encuesta</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <CustomAlert
        visible={showAlert}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setShowAlert(false)}
      />
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
    paddingBottom: 20,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  messageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginTop: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  messageText: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  introCard: {
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
  },
  introTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#d4af37",
    marginBottom: 8,
    textAlign: "center",
  },
  introText: {
    fontSize: 14,
    color: "#d1d5db",
    textAlign: "center",
    lineHeight: 20,
  },
  ratingContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginBottom: 16,
    textAlign: "center",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  starButton: {
    padding: 8,
  },
  selectRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  selectOption: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  selectOptionSelected: {
    backgroundColor: "rgba(212, 175, 55, 0.2)",
    borderColor: "#d4af37",
  },
  selectOptionText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#9ca3af",
  },
  selectOptionTextSelected: {
    color: "#d4af37",
  },
  dropdownButton: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownButtonText: {
    color: "#d1d5db",
    fontSize: 16,
    fontWeight: "500",
  },
  dropdownList: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
    overflow: "hidden",
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  dropdownItemSelected: {
    backgroundColor: "rgba(212, 175, 55, 0.2)",
  },
  dropdownItemText: {
    color: "#d1d5db",
    fontSize: 16,
    fontWeight: "500",
  },
  dropdownItemTextSelected: {
    color: "#d4af37",
    fontWeight: "700",
  },
  commentContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginLeft: 8,
  },
  commentInput: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
    padding: 12,
    color: "white",
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  characterCount: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 8,
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  primaryButton: {
    backgroundColor: "#d4af37",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  submitButton: {
    backgroundColor: "#d4af37",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#6b7280",
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginLeft: 8,
  },
});