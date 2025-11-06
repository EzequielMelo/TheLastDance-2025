import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ToastAndroid,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import ChefLoading from "../../components/common/ChefLoading";
import CustomAlert from "../../components/common/CustomAlert";
import {
  Users,
  User,
  Table,
  MessageCircle,
  CheckCircle,
  Clock,
  Crown,
} from "lucide-react-native";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/axios";
import TextField from "../../components/form/TextField";
import { TextInput } from "react-native";

interface QRData {
  action: string;
  restaurant_id: string;
  generated_by: string;
  timestamp: number;
  expires_at: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, "JoinWaitingList">;

export default function JoinWaitingListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { qrData } = route.params || {};

  const [partySize, setPartySize] = useState("2");
  const [tableType, setTableType] = useState("estandar");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qrExpired, setQrExpired] = useState(false);

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

  useEffect(() => {
    // Verificar si el QR ha expirado
    if (qrData && qrData.expires_at && Date.now() > qrData.expires_at) {
      setQrExpired(true);
    }
  }, [qrData]);

  const handleSubmit = async () => {
    // Validaciones
    const partySizeNum = parseInt(partySize);
    if (!partySizeNum || partySizeNum < 1 || partySizeNum > 20) {
      showCustomAlert(
        "Error",
        "El número de personas debe ser entre 1 y 20",
        "error",
      );
      return;
    }

    if (qrData && qrExpired) {
      showCustomAlert(
        "QR Expirado",
        "Este código QR ya no es válido. Solicita uno nuevo al maitre.",
        "warning",
      );
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        client_id: user?.id,
        party_size: partySizeNum,
        preferred_table_type:
          tableType === "sin_preferencia" ? null : tableType,
        special_requests: specialRequests.trim() || null,
        priority: 0, // Normal, no VIP
      };

      await api.post("/tables/waiting-list", data);

      showCustomAlert(
        "¡Agregado a la lista!",
        `Te hemos agregado a la lista de espera con ${partySizeNum} persona${partySizeNum > 1 ? "s" : ""}. Te notificaremos cuando tu mesa esté lista.`,
        "success",
        [
          {
            text: "Ver mi posición",
            onPress: () => navigation.navigate("MyWaitingPosition"),
          },
          {
            text: "Ir al inicio",
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
              });
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Error joining waiting list:", error);
      const message =
        error.response?.data?.error || "Error al unirse a la lista de espera";

      if (message.includes("ya está en la lista")) {
        showCustomAlert(
          "Ya estás en la lista",
          "Ya te encuentras en la lista de espera. ¿Quieres ver tu posición actual?",
          "warning",
          [
            { text: "No", style: "cancel" },
            {
              text: "Ver posición",
              onPress: () => navigation.navigate("MyWaitingPosition"),
            },
          ],
        );
      } else {
        showCustomAlert("Error", message, "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getTableTypeLabel = (type: string) => {
    switch (type) {
      case "vip":
        return "VIP";
      case "accesible":
        return "Accesible";
      default:
        return "Estándar";
    }
  };

  const getTableTypeDescription = (type: string) => {
    switch (type) {
      case "vip":
        return "Mesa premium con mejor ubicación";
      case "estandar":
        return "Mesa tradicional del restaurante";
      case "accesible":
        return "Mesa adaptada para personas con movilidad reducida";
      default:
        return "Cualquier mesa disponible";
    }
  };

  if (qrData && qrExpired) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1 items-center justify-center px-6"
      >
        <Clock size={64} color="#ef4444" />
        <Text className="text-white text-xl font-bold mt-4 text-center">
          QR Expirado
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          Este código QR ya no es válido. Solicita uno nuevo al maitre del
          restaurante.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          className="bg-[#d4af37] px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-black font-semibold">Volver al inicio</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="items-center mb-6">
            <View className="bg-[#d4af37] rounded-full p-4 mb-4">
              <Users size={32} color="#1a1a1a" />
            </View>
            <Text className="text-white text-2xl font-bold mb-2">
              Unirse a lista de espera
            </Text>
            <Text className="text-gray-400 text-center">
              Completa los datos para reservar tu mesa en The Last Dance
            </Text>
          </View>

          {/* User Info Card */}
          <View className="bg-white/10 rounded-xl p-4 mb-6">
            <View className="flex-row items-center mb-3">
              <User size={18} color="#d4af37" />
              <Text className="text-white font-semibold ml-2">Tus datos:</Text>
            </View>
            <Text className="text-gray-300 text-lg">
              {user?.first_name} {user?.last_name}
            </Text>
            {user?.email && <Text className="text-gray-400">{user.email}</Text>}
            {user?.profile_code === "cliente_anonimo" && (
              <Text className="text-yellow-500 text-sm mt-1">
                Usuario anónimo
              </Text>
            )}
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Party Size */}
            <View>
              <Text className="text-white font-medium mb-3">
                ¿Cuántas personas? *
              </Text>
              <TextField
                value={partySize}
                onChangeText={setPartySize}
                keyboardType="numeric"
                placeholder="Número de personas (1-20)"
              />
            </View>

            {/* Table Type */}
            <View>
              <Text className="text-white font-medium mb-3">
                Tipo de mesa preferida
              </Text>
              <View className="space-y-2">
                {[
                  { value: "estandar", icon: Table },
                  { value: "vip", icon: Crown },
                  { value: "accesible", icon: Table },
                ].map(option => {
                  const IconComponent = option.icon;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setTableType(option.value)}
                      className={`rounded-xl p-4 border ${
                        tableType === option.value
                          ? "bg-[#d4af37]/20 border-[#d4af37]"
                          : "bg-white/5 border-gray-600"
                      }`}
                    >
                      <View className="flex-row items-center">
                        <IconComponent
                          size={20}
                          color={
                            tableType === option.value ? "#d4af37" : "#9ca3af"
                          }
                        />
                        <View className="ml-3 flex-1">
                          <Text
                            className={`font-medium ${
                              tableType === option.value
                                ? "text-[#d4af37]"
                                : "text-white"
                            }`}
                          >
                            {getTableTypeLabel(option.value)}
                          </Text>
                          <Text className="text-gray-400 text-sm">
                            {getTableTypeDescription(option.value)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Special Requests */}
            <View>
              <Text className="text-white font-medium mb-3">
                Solicitudes especiales (opcional)
              </Text>
              <View className="bg-white/5 rounded-xl border border-gray-600">
                <TextInput
                  value={specialRequests}
                  onChangeText={setSpecialRequests}
                  placeholder="Ej: Cerca de ventana, cumpleaños, etc."
                  placeholderTextColor="#9ca3af"
                  multiline={true}
                  numberOfLines={3}
                  className="text-white p-4 rounded-xl"
                  style={{
                    textAlignVertical: "top",
                    minHeight: 80,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`rounded-xl py-4 mt-8 mb-8 ${
              submitting ? "bg-gray-600" : "bg-[#d4af37]"
            }`}
          >
            <View className="flex-row items-center justify-center">
              {submitting ? (
                <>
                  <ChefLoading size="small" />
                  <Text className="text-white font-semibold text-lg ml-2">
                    Agregando...
                  </Text>
                </>
              ) : (
                <>
                  <CheckCircle size={20} color="#1a1a1a" />
                  <Text className="text-black font-semibold text-lg ml-2">
                    Unirse a Lista de Espera
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Info */}
          <View className="bg-blue-500/20 rounded-xl p-4 mb-8">
            <Text className="text-blue-400 font-medium mb-2">
              💡 Información importante:
            </Text>
            <Text className="text-gray-300 text-sm leading-5">
              • Recibirás una notificación cuando tu mesa esté lista{"\n"}• El
              tiempo de espera puede variar según la disponibilidad{"\n"}•
              Puedes cancelar tu reserva en cualquier momento
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
    </KeyboardAvoidingView>
  );
}
