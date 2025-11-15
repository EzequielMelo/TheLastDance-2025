import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
  ToastAndroid,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import CustomAlert from "../../components/common/CustomAlert";
import {
  Clock,
  Users,
  Trophy,
  XCircle,
  RefreshCw,
  User,
  Crown,
  AlertCircle,
  ArrowLeft,
} from "lucide-react-native";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/axios";

interface WaitingPosition {
  position: number;
  estimatedWait?: number;
}

interface WaitingListEntry {
  id: string;
  party_size: number;
  preferred_table_type?: string;
  special_requests?: string;
  priority: number;
  joined_at: string;
  status: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyWaitingPositionScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [position, setPosition] = useState<WaitingPosition | null>(null);
  const [myEntry, setMyEntry] = useState<WaitingListEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para alertas personalizadas
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as "success" | "error" | "warning" | "info",
    buttons: [] as Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "info",
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }> = [{ text: "OK" }],
  ) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  // Función para navegar al Home
  const navigateToHome = useCallback(() => {
    // Pasar un parámetro para indicar que debe refrescar
    navigation.navigate("Home", { refresh: Date.now() });
  }, [navigation]);

  // Interceptar el botón de hardware de Android
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigateToHome();
        return true; // Previene el comportamiento por defecto
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [navigateToHome]),
  );

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setError(null);

      // Usar el endpoint que detecta el estado completo del cliente
      const statusResponse = await api.get("/tables/my-status");
      const status = statusResponse.data.status;

      if (status === "assigned") {
        // El cliente ya fue asignado a una mesa
        setPosition(null);
        setMyEntry(null);
        setError(
          `¡Tu mesa está lista! Se te ha asignado la mesa ${statusResponse.data.table.number}. Ve al restaurante y escanea el código QR de tu mesa para confirmar tu llegada.`,
        );
        return;
      }

      if (status === "seated") {
        // El cliente ya está sentado
        setPosition(null);
        setMyEntry(null);
        setError(
          `Ya estás en tu mesa ${statusResponse.data.table.number}. ¡Disfruta tu experiencia!`,
        );
        return;
      }

      if (status === "in_queue") {
        // Cliente en lista de espera normal
        setPosition({
          position: statusResponse.data.position || 0,
          estimatedWait: statusResponse.data.estimatedWait,
        });

        // Usar la información real del backend
        setMyEntry({
          id: statusResponse.data.waitingListId || "",
          party_size: statusResponse.data.party_size || 1,
          status: "waiting",
          priority: statusResponse.data.entry?.priority || 0,
          joined_at:
            statusResponse.data.entry?.joined_at || new Date().toISOString(),
          preferred_table_type: statusResponse.data.preferred_table_type,
          special_requests: statusResponse.data.special_requests,
        });
        return;
      }

      if (status === "displaced") {
        setPosition(null);
        setMyEntry(null);
        setError(
          "El maitre liberó tu mesa por motivos operativos. Puedes unirte nuevamente a la lista de espera.",
        );
        return;
      }

      if (status === "completed") {
        setPosition(null);
        setMyEntry(null);
        setError(
          "¡Gracias por visitarnos! Has completado tu experiencia en The Last Dance. ¡Esperamos verte pronto de nuevo!",
        );
        return;
      }
      setError("No estás en la lista de espera");
    } catch (error: any) {
      const message =
        error.response?.data?.error || "Error al cargar tu posición";
      console.error("Error loading position:", error);
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCancel = () => {
    showCustomAlert(
      "Cancelar Reserva",
      "¿Estás seguro que quieres salir de la lista de espera?",
      "warning",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              if (!myEntry?.id) {
                ToastAndroid.show(
                  "Error: No se encontró la reserva",
                  ToastAndroid.SHORT,
                );
                return;
              }

              // Llamar al endpoint para cancelar la reserva
              await api.put(`/tables/waiting-list/${myEntry.id}/cancel`, {});

              ToastAndroid.show(
                "Reserva cancelada exitosamente",
                ToastAndroid.SHORT,
              );

              // Navegar de vuelta al home con refresh
              navigateToHome();
            } catch (error: any) {
              console.error("Error al cancelar reserva:", error);
              const errorMessage =
                error.response?.data?.error || "Error al cancelar la reserva";
              ToastAndroid.show(errorMessage, ToastAndroid.SHORT);
            }
          },
        },
      ],
    );
  };

  const getWaitingTime = () => {
    if (!myEntry) return "0 min";
    const now = new Date().getTime();
    const joined = new Date(myEntry.joined_at).getTime();
    const minutes = Math.floor((now - joined) / (1000 * 60));
    return `${minutes} min`;
  };

  const getEstimatedWaitText = () => {
    if (!position?.estimatedWait) return "Calculando...";
    const hours = Math.floor(position.estimatedWait / 60);
    const minutes = position.estimatedWait % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1 items-center justify-center"
      >
        <RefreshCw size={32} color="#d4af37" />
        <Text className="text-white mt-2">Cargando tu posición...</Text>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1 items-center justify-center px-6"
      >
        <AlertCircle size={64} color="#ef4444" />
        <Text className="text-white text-xl font-bold mt-4 text-center">
          {error === "No estás en la lista de espera"
            ? "No estás en la lista"
            : "Error"}
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          {error === "No estás en la lista de espera"
            ? "Actualmente no tienes ninguna reserva activa en la lista de espera."
            : error}
        </Text>

        <View className="flex-row gap-3 mt-6">
          <TouchableOpacity
            onPress={() => navigation.navigate("ScanQR")}
            className="bg-[#d4af37] px-6 py-3 rounded-xl"
          >
            <Text className="text-black font-semibold">Unirse a Lista</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={navigateToHome}
            className="bg-white/20 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Volver</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1a1a1a" }}>
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1"
      >
        {/* Header manual */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#333",
          }}
        >
          <TouchableOpacity
            style={{ marginRight: 16 }}
            onPress={navigateToHome}
          >
            <ArrowLeft size={24} color="#d4af37" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 20, fontWeight: "bold", color: "#ffffff" }}
            >
              Mi Posición
            </Text>
            <Text style={{ fontSize: 14, color: "#999", marginTop: 2 }}>
              The Last Dance
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-6 pt-6"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#d4af37"
            />
          }
        >
          {/* Header */}
          <View className="items-center mb-8">
            <View className="bg-[#d4af37] rounded-full p-4 mb-4">
              <Clock size={32} color="#1a1a1a" />
            </View>
            <Text className="text-white text-2xl font-bold">
              Tu Posición en Lista
            </Text>
            <Text className="text-gray-400 text-center mt-1">
              The Last Dance
            </Text>
          </View>

          {/* Position Card */}
          <View className="bg-gradient-to-r from-[#d4af37]/20 to-[#b8941f]/20 rounded-2xl p-6 mb-6 border border-[#d4af37]/30">
            <View className="items-center">
              <View className="bg-[#d4af37] rounded-full p-3 mb-4">
                <Trophy size={32} color="#1a1a1a" />
              </View>

              <Text className="text-white text-lg mb-2">Tu posición:</Text>
              <Text className="text-[#d4af37] text-6xl font-bold mb-2">
                #{position?.position || "?"}
              </Text>

              {myEntry && myEntry.priority > 0 && (
                <View className="flex-row items-center bg-yellow-500/20 rounded-full px-3 py-1 mb-2">
                  <Crown size={14} color="#d4af37" />
                  <Text className="text-yellow-400 text-sm ml-1 font-medium">
                    VIP Priority
                  </Text>
                </View>
              )}

              <Text className="text-gray-400 text-center">
                {position?.position === 1
                  ? "¡Eres el siguiente!"
                  : position?.position && position.position <= 3
                    ? "Muy pronto será tu turno"
                    : "Te avisaremos cuando tu mesa esté lista"}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row gap-3 mb-6">
            <View className="flex-1 bg-white/10 rounded-xl p-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-400 text-sm">
                    Tiempo esperando
                  </Text>
                  <Text className="text-white text-xl font-bold">
                    {getWaitingTime()}
                  </Text>
                </View>
                <Clock size={24} color="#d4af37" />
              </View>
            </View>

            <View className="flex-1 bg-white/10 rounded-xl p-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-400 text-sm">Tiempo estimado</Text>
                  <Text className="text-white text-xl font-bold">
                    {getEstimatedWaitText()}
                  </Text>
                </View>
                <Users size={24} color="#22c55e" />
              </View>
            </View>
          </View>

          {/* Reservation Details */}
          {myEntry && (
            <View className="bg-white/5 rounded-xl p-4 mb-6">
              <Text className="text-white font-semibold mb-3">
                Detalles de tu reserva:
              </Text>

              <View className="space-y-2">
                <View className="flex-row items-center">
                  <User size={16} color="#9ca3af" />
                  <Text className="text-gray-300 ml-2">
                    {myEntry.party_size} persona
                    {myEntry.party_size > 1 ? "s" : ""}
                  </Text>
                </View>

                {myEntry.preferred_table_type && (
                  <View className="flex-row items-center">
                    <Crown size={16} color="#9ca3af" />
                    <Text className="text-gray-300 ml-2 capitalize">
                      Mesa {myEntry.preferred_table_type}
                    </Text>
                  </View>
                )}

                {myEntry.special_requests && (
                  <View className="flex-row items-start">
                    <AlertCircle size={16} color="#9ca3af" />
                    <Text className="text-gray-300 ml-2 flex-1">
                      "{myEntry.special_requests}"
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Actions */}
          <View className="gap-3 mb-8">
            <TouchableOpacity
              onPress={handleCancel}
              className="bg-red-600 rounded-xl py-4 flex-row items-center justify-center"
            >
              <XCircle size={20} color="white" />
              <Text className="text-white font-semibold text-lg ml-2">
                Cancelar Reserva
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View className="bg-blue-500/20 rounded-xl p-4 mb-8">
            <Text className="text-blue-400 font-medium mb-2">💡 Consejos:</Text>
            <Text className="text-gray-300 text-sm leading-5">
              • Mantén la app abierta para recibir notificaciones{"\n"}• El
              tiempo estimado puede variar según la ocupación{"\n"}• Puedes
              actualizar tu posición deslizando hacia abajo
            </Text>
          </View>
        </ScrollView>

        {/* Custom Alert */}
        <CustomAlert
          visible={alertVisible}
          onClose={() => setAlertVisible(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}
