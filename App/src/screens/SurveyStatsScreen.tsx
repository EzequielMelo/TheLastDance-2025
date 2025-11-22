import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
  Animated,
  PanResponder,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import {
  Star,
  TrendingUp,
  Users,
  MessageSquare,
  Award,
  BarChart3,
  PieChart,
  TrendingDown,
} from "lucide-react-native";
import api from "../api/axios";
import ChefLoading from "../components/common/ChefLoading";
import Svg, { Path, G, Circle } from "react-native-svg";

const { width } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SurveyStats {
  total_surveys: number;
  average_food_rating: number;
  average_service_rating: number;
  average_restaurant_rating: number;
  overall_average: number;
  rating_distribution: {
    food: { [key: number]: number };
    service: { [key: number]: number };
    restaurant: { [key: number]: number };
  };
  recent_surveys: Array<{
    id: string;
    food_rating: number;
    service_rating: number;
    restaurant_rating: number;
    comment: string | null;
    created_at: string;
    client_name: string;
    client_profile_image: string | null;
  }>;
}

export default function SurveyStatsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [surveyType, setSurveyType] = useState<"restaurant" | "delivery">(
    "restaurant",
  );
  const [chartType, setChartType] = useState<"bar" | "pie" | "line">("pie");
  const fadeAnim = useState(new Animated.Value(1))[0];
  const scrollViewRef = useRef<ScrollView>(null);

  const changeChartWithAnimation = (newType: "bar" | "pie" | "line") => {
    if (newType === chartType) return;

    // Scroll hacia arriba
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });

    // Animación de fade
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setChartType(newType);
  };

  const handleSwipe = (gestureState: any) => {
    const swipeDistance = gestureState.dx;
    const minSwipeDistance = 50;

    if (
      Math.abs(swipeDistance) > minSwipeDistance &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
    ) {
      if (swipeDistance > 0) {
        // Deslizar a la derecha - gráfico anterior
        if (chartType === "bar") {
          changeChartWithAnimation("pie");
        } else if (chartType === "line") {
          changeChartWithAnimation("bar");
        }
      } else {
        // Deslizar a la izquierda - gráfico siguiente
        if (chartType === "pie") {
          changeChartWithAnimation("bar");
        } else if (chartType === "bar") {
          changeChartWithAnimation("line");
        }
      }
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Solo activar si el movimiento es más horizontal que vertical
      const isHorizontalSwipe =
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
        Math.abs(gestureState.dx) > 20;
      return isHorizontalSwipe;
    },
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      const isHorizontalSwipe =
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
        Math.abs(gestureState.dx) > 20;
      return isHorizontalSwipe;
    },
    onPanResponderRelease: (_, gestureState) => {
      handleSwipe(gestureState);
    },
    onPanResponderTerminationRequest: () => false,
  });

  useEffect(() => {
    loadStats();
  }, [surveyType]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const endpoint =
        surveyType === "restaurant"
          ? "/surveys/stats"
          : "/surveys/deliveries/stats";
      const response = await api.get(endpoint);

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={{ flexDirection: "row" }}>
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={size}
            color="#d4af37"
            fill={star <= Math.round(rating) ? "#d4af37" : "transparent"}
          />
        ))}
      </View>
    );
  };

  const renderRatingBar = (count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 4,
        }}
      >
        <View
          style={{
            flex: 1,
            height: 8,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${percentage}%`,
              height: "100%",
              backgroundColor: "#d4af37",
            }}
          />
        </View>
        <Text
          style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8, width: 40 }}
        >
          {count}
        </Text>
      </View>
    );
  };

  // Gráfico de torta circular (Pie Chart)
  const renderPieChart = (
    distribution: { [key: number]: number },
    title: string,
  ) => {
    const total = Object.values(distribution).reduce(
      (sum, val) => sum + val,
      0,
    );
    if (total === 0) {
      console.log("⚠️ Total is 0, returning null");
      return null;
    }

    const colors = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"]; // 1-5 estrellas
    const size = 180;
    const center = size / 2;
    const radius = 70;

    // Función para crear path de un slice de torta
    const createPieSlice = (
      startAngle: number,
      endAngle: number,
      color: string,
    ) => {
      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;

      return (
        <Path
          d={`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
          fill={color}
        />
      );
    };

    // Calcular ángulos para cada slice
    let currentAngle = 0;
    const slices: React.ReactElement[] = [];

    // Si solo hay un rating, mostrar un círculo completo
    const nonZeroRatings = [5, 4, 3, 2, 1].filter(r => distribution[r] > 0);

    if (nonZeroRatings.length === 1) {
      const rating = nonZeroRatings[0];
      slices.push(
        <Circle
          key={`circle-${rating}`}
          cx={center}
          cy={center}
          r={radius}
          fill={colors[5 - rating]}
        />,
      );
    } else {
      [5, 4, 3, 2, 1].forEach(rating => {
        const count = distribution[rating] || 0;
        if (count > 0) {
          const percentage = count / total;
          const angle = percentage * 360;
          const endAngle = currentAngle + angle;

          slices.push(
            <G key={`slice-${rating}`}>
              {createPieSlice(currentAngle, endAngle, colors[5 - rating])}
            </G>,
          );

          currentAngle = endAngle;
        }
      });
    }

    return (
      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            color: "#d1d5db",
            fontSize: 14,
            fontWeight: "500",
            marginBottom: 12,
          }}
        >
          {title}
        </Text>

        <View style={{ alignItems: "center" }}>
          {/* Gráfico de torta circular */}
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {slices}
          </Svg>

          {/* Leyenda */}
          <View style={{ marginTop: 16, width: "100%" }}>
            {[5, 4, 3, 2, 1].map(rating => {
              const count = distribution[rating] || 0;
              if (count === 0) return null;
              const percentage = ((count / total) * 100).toFixed(1);
              return (
                <View
                  key={`legend-${rating}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: colors[5 - rating],
                      borderRadius: 3,
                      marginRight: 10,
                    }}
                  />
                  <Text style={{ color: "#d1d5db", fontSize: 13, flex: 1 }}>
                    {rating} Estrellas
                  </Text>
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {count} ({percentage}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  // Gráfico de línea temporal simplificado
  const renderLineChart = () => {
    console.log("📈 Rendering Line Chart");
    if (!stats || stats.recent_surveys.length === 0) {
      console.log("❌ No surveys data for line chart");
      return (
        <View style={{ marginBottom: 20, alignItems: "center", padding: 40 }}>
          <Text style={{ color: "#9ca3af", fontSize: 14 }}>
            No hay suficientes datos para mostrar tendencia temporal
          </Text>
        </View>
      );
    }

    // Agrupar encuestas por fecha y calcular promedio
    const surveysByDate: { [key: string]: number[] } = {};
    stats.recent_surveys.forEach(survey => {
      const date = new Date(survey.created_at).toLocaleDateString("es-AR", {
        month: "short",
        day: "numeric",
      });
      const avg =
        (survey.food_rating +
          survey.service_rating +
          survey.restaurant_rating) /
        3;
      if (!surveysByDate[date]) {
        surveysByDate[date] = [];
      }
      surveysByDate[date].push(avg);
    });

    const dates = Object.keys(surveysByDate).slice(-7); // Últimos 7 puntos
    const averages = dates.map(date => {
      const ratings = surveysByDate[date];
      return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    });

    if (dates.length < 1) {
      return (
        <View style={{ marginBottom: 20, alignItems: "center", padding: 40 }}>
          <Text style={{ color: "#9ca3af", fontSize: 14 }}>
            No hay suficientes datos para mostrar tendencia
          </Text>
        </View>
      );
    }

    const maxRating = Math.max(...averages);
    const minRating = Math.min(...averages);

    return (
      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            color: "white",
            fontSize: 16,
            fontWeight: "600",
            marginBottom: 12,
          }}
        >
          📈 Tendencia de satisfacción
        </Text>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          {/* Gráfico de barras verticales simulando línea */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              height: 150,
              gap: 8,
              marginBottom: 12,
            }}
          >
            {averages.map((avg, index) => {
              const heightPercentage = ((avg - 0) / 5) * 100;
              return (
                <View
                  key={`bar-${index}`}
                  style={{ flex: 1, alignItems: "center" }}
                >
                  <View
                    style={{
                      width: "100%",
                      height: `${heightPercentage}%`,
                      backgroundColor: "#d4af37",
                      borderRadius: 4,
                      minHeight: 20,
                      justifyContent: "flex-start",
                      alignItems: "center",
                      paddingTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: "#1a1a1a",
                        fontSize: 10,
                        fontWeight: "700",
                      }}
                    >
                      {avg.toFixed(1)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* X-axis labels */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {dates.map((date, index) => (
              <Text
                key={`label-${index}`}
                style={{
                  flex: 1,
                  color: "#6b7280",
                  fontSize: 9,
                  textAlign: "center",
                }}
              >
                {date}
              </Text>
            ))}
          </View>

          {/* Info adicional */}
          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              justifyContent: "space-around",
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 11 }}>Máximo</Text>
              <Text
                style={{ color: "#22c55e", fontSize: 14, fontWeight: "700" }}
              >
                {maxRating.toFixed(1)} ⭐
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 11 }}>Mínimo</Text>
              <Text
                style={{ color: "#f97316", fontSize: 14, fontWeight: "700" }}
              >
                {minRating.toFixed(1)} ⭐
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 11 }}>Promedio</Text>
              <Text
                style={{ color: "#d4af37", fontSize: 14, fontWeight: "700" }}
              >
                {(
                  averages.reduce((sum, a) => sum + a, 0) / averages.length
                ).toFixed(1)}{" "}
                ⭐
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1 }}
      >
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ChefLoading size="large" text="Cargando estadísticas..." />
        </View>
      </LinearGradient>
    );
  }

  if (!stats || stats.total_surveys === 0) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1 }}
      >
        <View
          style={{ paddingTop: 48, paddingHorizontal: 24, paddingBottom: 20 }}
        >
          <View style={{ alignItems: "center", marginTop: 20 }}>
            <Award size={48} color="#d4af37" />
            <Text
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: "700",
                marginTop: 12,
              }}
            >
              Opiniones del Restaurante
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <MessageSquare size={64} color="#6b7280" />
          <Text
            style={{
              color: "white",
              fontSize: 20,
              fontWeight: "700",
              marginTop: 20,
              textAlign: "center",
            }}
          >
            Aún no hay opiniones
          </Text>
          <Text
            style={{
              color: "#9ca3af",
              fontSize: 16,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Sé el primero en compartir tu experiencia en The Last Dance
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={{ flex: 1 }}
    >
      {/* Header */}
      <View
        style={{ paddingTop: 48, paddingHorizontal: 24, paddingBottom: 20 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <View style={{ flex: 1, alignItems: "center" }}>
            <Award size={32} color="#d4af37" />
            <Text
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: "700",
                marginTop: 4,
              }}
            >
              The Last Dance
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Calificación general */}
        <View
          style={{
            backgroundColor: "rgba(212, 175, 55, 0.1)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "rgba(212, 175, 55, 0.3)",
            alignItems: "center",
          }}
        >
          <TrendingUp size={40} color="#d4af37" />
          <Text
            style={{
              color: "#d4af37",
              fontSize: 48,
              fontWeight: "700",
              marginTop: 12,
            }}
          >
            {stats.overall_average.toFixed(1)}
          </Text>
          {renderStars(stats.overall_average, 24)}
          <Text style={{ color: "#d1d5db", fontSize: 14, marginTop: 8 }}>
            Calificación promedio general
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <Users size={16} color="#9ca3af" />
            <Text style={{ color: "#9ca3af", fontSize: 14, marginLeft: 6 }}>
              Basado en {stats.total_surveys}{" "}
              {stats.total_surveys === 1 ? "opinión" : "opiniones"}
            </Text>
          </View>
        </View>

        {/* Botones de filtro por tipo de encuesta */}
        <View style={{ flexDirection: "row", marginBottom: 16, gap: 12 }}>
          <TouchableOpacity
            onPress={() => setSurveyType("restaurant")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                surveyType === "restaurant"
                  ? "#d4af37"
                  : "rgba(255,255,255,0.1)",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor:
                surveyType === "restaurant"
                  ? "#d4af37"
                  : "rgba(255,255,255,0.2)",
            }}
          >
            <Award
              size={18}
              color={surveyType === "restaurant" ? "#1a1a1a" : "#d4af37"}
            />
            <Text
              style={{
                color: surveyType === "restaurant" ? "#1a1a1a" : "#d4af37",
                fontSize: 14,
                fontWeight: "600",
                marginLeft: 8,
              }}
            >
              Restaurante
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSurveyType("delivery")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                surveyType === "delivery" ? "#d4af37" : "rgba(255,255,255,0.1)",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor:
                surveyType === "delivery" ? "#d4af37" : "rgba(255,255,255,0.2)",
            }}
          >
            <TrendingUp
              size={18}
              color={surveyType === "delivery" ? "#1a1a1a" : "#d4af37"}
            />
            <Text
              style={{
                color: surveyType === "delivery" ? "#1a1a1a" : "#d4af37",
                fontSize: 14,
                fontWeight: "600",
                marginLeft: 8,
              }}
            >
              Delivery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selector de tipo de gráfico con transición */}
        <View style={{ flexDirection: "row", marginBottom: 8, gap: 8 }}>
          <TouchableOpacity
            onPress={() => changeChartWithAnimation("pie")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                chartType === "pie"
                  ? "rgba(212, 175, 55, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
              borderRadius: 8,
              padding: 12,
              borderWidth: 1,
              borderColor:
                chartType === "pie" ? "#d4af37" : "rgba(255, 255, 255, 0.1)",
            }}
          >
            <PieChart
              size={16}
              color={chartType === "pie" ? "#d4af37" : "#9ca3af"}
            />
            <Text
              style={{
                color: chartType === "pie" ? "#d4af37" : "#9ca3af",
                fontSize: 12,
                marginLeft: 6,
                fontWeight: "600",
              }}
            >
              Torta
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeChartWithAnimation("bar")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                chartType === "bar"
                  ? "rgba(212, 175, 55, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
              borderRadius: 8,
              padding: 12,
              borderWidth: 1,
              borderColor:
                chartType === "bar" ? "#d4af37" : "rgba(255, 255, 255, 0.1)",
            }}
          >
            <BarChart3
              size={16}
              color={chartType === "bar" ? "#d4af37" : "#9ca3af"}
            />
            <Text
              style={{
                color: chartType === "bar" ? "#d4af37" : "#9ca3af",
                fontSize: 12,
                marginLeft: 6,
                fontWeight: "600",
              }}
            >
              Barras
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeChartWithAnimation("line")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                chartType === "line"
                  ? "rgba(212, 175, 55, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
              borderRadius: 8,
              padding: 12,
              borderWidth: 1,
              borderColor:
                chartType === "line" ? "#d4af37" : "rgba(255, 255, 255, 0.1)",
            }}
          >
            <TrendingUp
              size={16}
              color={chartType === "line" ? "#d4af37" : "#9ca3af"}
            />
            <Text
              style={{
                color: chartType === "line" ? "#d4af37" : "#9ca3af",
                fontSize: 12,
                marginLeft: 6,
                fontWeight: "600",
              }}
            >
              Línea
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contenedor animado para los gráficos con swipe */}
        <Animated.View
          style={{ opacity: fadeAnim }}
          {...panResponder.panHandlers}
        >
          {/* Gráfico de línea temporal */}
          {chartType === "line" && renderLineChart()}

          {/* Desglose de calificaciones */}
          {chartType !== "line" && (
            <View
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 16,
                }}
              >
                📊 Desglose por categoría
              </Text>

              {chartType === "pie" ? (
                <>
                  {/* Gráficos de Torta */}
                  {renderPieChart(
                    stats.rating_distribution.food,
                    "🍽️ Calidad de la comida - Promedio: " +
                      stats.average_food_rating.toFixed(1),
                  )}
                  {renderPieChart(
                    stats.rating_distribution.service,
                    "👨‍🍳 Atención del mozo - Promedio: " +
                      stats.average_service_rating.toFixed(1),
                  )}
                  {renderPieChart(
                    stats.rating_distribution.restaurant,
                    "🏪 Experiencia general - Promedio: " +
                      stats.average_restaurant_rating.toFixed(1),
                  )}
                </>
              ) : (
                <>
                  {/* Gráficos de Barras */}
                  {/* Comida */}
                  <View style={{ marginBottom: 16 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: "#d1d5db",
                          fontSize: 14,
                          fontWeight: "500",
                        }}
                      >
                        🍽️ Calidad de la comida
                      </Text>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{
                            color: "#d4af37",
                            fontSize: 16,
                            fontWeight: "700",
                            marginRight: 8,
                          }}
                        >
                          {stats.average_food_rating.toFixed(1)}
                        </Text>
                        {renderStars(stats.average_food_rating, 14)}
                      </View>
                    </View>
                    {[5, 4, 3, 2, 1].map(rating => (
                      <View
                        key={`food-${rating}`}
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{ color: "#9ca3af", fontSize: 12, width: 20 }}
                        >
                          {rating}
                        </Text>
                        <Star
                          size={12}
                          color="#d4af37"
                          fill="#d4af37"
                          style={{ marginRight: 8 }}
                        />
                        {renderRatingBar(
                          stats.rating_distribution.food[rating] || 0,
                          stats.total_surveys,
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Servicio */}
                  <View style={{ marginBottom: 16 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: "#d1d5db",
                          fontSize: 14,
                          fontWeight: "500",
                        }}
                      >
                        👨‍🍳 Atención del mozo
                      </Text>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{
                            color: "#d4af37",
                            fontSize: 16,
                            fontWeight: "700",
                            marginRight: 8,
                          }}
                        >
                          {stats.average_service_rating.toFixed(1)}
                        </Text>
                        {renderStars(stats.average_service_rating, 14)}
                      </View>
                    </View>
                    {[5, 4, 3, 2, 1].map(rating => (
                      <View
                        key={`service-${rating}`}
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{ color: "#9ca3af", fontSize: 12, width: 20 }}
                        >
                          {rating}
                        </Text>
                        <Star
                          size={12}
                          color="#d4af37"
                          fill="#d4af37"
                          style={{ marginRight: 8 }}
                        />
                        {renderRatingBar(
                          stats.rating_distribution.service[rating] || 0,
                          stats.total_surveys,
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Restaurante */}
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: "#d1d5db",
                          fontSize: 14,
                          fontWeight: "500",
                        }}
                      >
                        🏪 Experiencia general
                      </Text>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{
                            color: "#d4af37",
                            fontSize: 16,
                            fontWeight: "700",
                            marginRight: 8,
                          }}
                        >
                          {stats.average_restaurant_rating.toFixed(1)}
                        </Text>
                        {renderStars(stats.average_restaurant_rating, 14)}
                      </View>
                    </View>
                    {[5, 4, 3, 2, 1].map(rating => (
                      <View
                        key={`restaurant-${rating}`}
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{ color: "#9ca3af", fontSize: 12, width: 20 }}
                        >
                          {rating}
                        </Text>
                        <Star
                          size={12}
                          color="#d4af37"
                          fill="#d4af37"
                          style={{ marginRight: 8 }}
                        />
                        {renderRatingBar(
                          stats.rating_distribution.restaurant[rating] || 0,
                          stats.total_surveys,
                        )}
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </Animated.View>

        {/* Opiniones recientes con comentarios */}
        {stats.recent_surveys.filter(s => s.comment).length > 0 && (
          <View
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "600",
                marginBottom: 16,
              }}
            >
              💬 Comentarios
            </Text>
            {stats.recent_surveys
              .filter(survey => survey.comment)
              .slice(0, 5)
              .map((survey, index) => (
                <View
                  key={survey.id}
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: index < 4 ? 12 : 0,
                  }}
                >
                  {/* Header con foto, nombre y fecha */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    {/* Foto de perfil */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#d4af37",
                        marginRight: 12,
                        overflow: "hidden",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {survey.client_profile_image ? (
                        <Image
                          source={{ uri: survey.client_profile_image }}
                          style={{ width: 40, height: 40 }}
                        />
                      ) : (
                        <Text
                          style={{
                            color: "#1a1a1a",
                            fontSize: 16,
                            fontWeight: "700",
                          }}
                        >
                          {survey.client_name?.[0]?.toUpperCase() || "?"}
                        </Text>
                      )}
                    </View>

                    {/* Nombre y fecha */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#d1d5db",
                          fontSize: 14,
                          fontWeight: "600",
                          marginBottom: 2,
                        }}
                      >
                        {survey.client_name}
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 12 }}>
                        {new Date(survey.created_at).toLocaleDateString(
                          "es-AR",
                        )}
                      </Text>
                    </View>

                    {/* Estrellas */}
                    <View>
                      {renderStars(
                        (survey.food_rating +
                          survey.service_rating +
                          survey.restaurant_rating) /
                          3,
                      )}
                    </View>
                  </View>

                  {/* Comentario */}
                  <Text
                    style={{
                      color: "#d1d5db",
                      fontSize: 14,
                      lineHeight: 20,
                      fontStyle: "italic",
                    }}
                  >
                    "{survey.comment}"
                  </Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}
