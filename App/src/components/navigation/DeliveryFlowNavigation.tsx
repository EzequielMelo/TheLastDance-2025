import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  MapPin,
  RefreshCcw,
  XCircle,
  AlertCircle,
} from "lucide-react-native";
import { useDeliveryState } from "../../Hooks/useDeliveryState";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";
import { cancelDelivery } from "../../api/deliveries";
import CustomAlert from "../common/CustomAlert";

interface DeliveryFlowNavigationProps {
  onRefresh?: () => void;
}

const DeliveryFlowNavigation: React.FC<DeliveryFlowNavigationProps> = ({
  onRefresh,
}) => {
  const { state, delivery, hasActiveDelivery, refresh, isLoading } =
    useDeliveryState();
  const navigation = useNavigation<RootStackNavigationProp>();

  const [isCancelling, setIsCancelling] = useState(false);
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
    type: "success" | "error" | "warning" | "info",
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  ) => {
    setAlertConfig({ title, message, type, buttons: buttons || [] });
    setAlertVisible(true);
  };

  const handleRefresh = async () => {
    await refresh();
    onRefresh?.();
  };

  const handleCancelDelivery = () => {
    showCustomAlert(
      "¿Cancelar Pedido?",
      "¿Estás seguro de que quieres cancelar este pedido de delivery? Esta acción no se puede deshacer.",
      "warning",
      [
        {
          text: "No, Volver",
          style: "cancel",
          onPress: () => setAlertVisible(false),
        },
        {
          text: "Sí, Cancelar",
          style: "destructive",
          onPress: async () => {
            setAlertVisible(false);
            await confirmCancelDelivery();
          },
        },
      ],
    );
  };

  const confirmCancelDelivery = async () => {
    if (!delivery?.id) return;

    setIsCancelling(true);

    try {
      await cancelDelivery(delivery.id);

      showCustomAlert(
        "Pedido Cancelado",
        "Tu pedido de delivery ha sido cancelado exitosamente.",
        "success",
        [
          {
            text: "OK",
            onPress: () => {
              setAlertVisible(false);
              refresh();
              onRefresh?.();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Error cancelando delivery:", error);
      showCustomAlert(
        "Error",
        error.response?.data?.error ||
          error.message ||
          "No se pudo cancelar el pedido. Intenta nuevamente.",
        "error",
        [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
          },
        ],
      );
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading || state === "loading") {
    return (
      <View
        className="bg-gray-900 px-6 pt-6 pb-3 mt-3"
        style={{ borderRadius: 16 }}
      >
        <View className="items-center py-8">
          <RefreshCcw size={48} color="#d4af37" />
          <Text className="text-white text-lg mt-4">
            Verificando estado del delivery...
          </Text>
        </View>
      </View>
    );
  }

  if (state === "error") {
    return (
      <View
        className="bg-gray-900 px-6 pt-6 pb-3 mt-3"
        style={{ borderRadius: 16 }}
      >
        <View className="items-center py-8">
          <AlertCircle size={48} color="#ef4444" />
          <Text className="text-red-400 text-lg mt-4 mb-4">
            Error al cargar el delivery
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            className="bg-red-600 px-6 py-3 rounded-lg flex-row items-center"
          >
            <RefreshCcw size={18} color="white" />
            <Text className="text-white font-semibold ml-2">Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state === "no_delivery" || !hasActiveDelivery) {
    return null; // No mostrar nada si no hay delivery activo
  }

  // Estados del delivery
  const getDeliveryIcon = () => {
    switch (state) {
      case "pending":
        return <Clock size={48} color="#f59e0b" />;
      case "confirmed":
        return <CheckCircle size={48} color="#10b981" />;
      case "preparing":
        return <Package size={48} color="#3b82f6" />;
      case "ready":
        return <CheckCircle size={48} color="#22c55e" />;
      case "on_the_way":
        return <Truck size={48} color="#8b5cf6" />;
      case "delivered":
        return <CheckCircle size={48} color="#22c55e" />;
      case "cancelled":
        return <XCircle size={48} color="#ef4444" />;
      default:
        return <Package size={48} color="#6b7280" />;
    }
  };

  const getDeliveryTitle = () => {
    switch (state) {
      case "pending":
        return "Esperando Confirmación";
      case "confirmed":
        return "Pedido Confirmado";
      case "preparing":
        return "Preparando tu Pedido";
      case "ready":
        return "¡Tu Pedido está Listo!";
      case "on_the_way":
        return "En Camino";
      case "delivered":
        return "Pedido Entregado";
      case "cancelled":
        return "Pedido Cancelado";
      default:
        return "Estado del Delivery";
    }
  };

  const getDeliveryDescription = () => {
    switch (state) {
      case "pending":
        return "Tu pedido está siendo revisado por el restaurante";
      case "confirmed":
        return "Tu pedido ha sido confirmado y pronto será preparado";
      case "preparing":
        return "El restaurante está preparando tu pedido";
      case "ready":
        return "Tu comida está lista y esperando a un repartidor";
      case "on_the_way":
        return delivery?.driver
          ? `${delivery.driver.first_name} está en camino con tu pedido`
          : "Tu pedido está en camino";
      case "delivered":
        return "Tu pedido ha sido entregado. ¡Buen provecho!";
      case "cancelled":
        return "Tu pedido ha sido cancelado";
      default:
        return "";
    }
  };

  const getProgressPercentage = () => {
    switch (state) {
      case "pending":
        return 16; // 1/6 checkpoints
      case "confirmed":
        return 33; // 2/6 checkpoints
      case "preparing":
        return 50; // 3/6 checkpoints
      case "ready":
        return 66; // 4/6 checkpoints
      case "on_the_way":
        return 83; // 5/6 checkpoints
      case "delivered":
        return 100; // 6/6 checkpoints
      case "cancelled":
        return 0;
      default:
        return 0;
    }
  };

  const canViewTracking = state === "on_the_way" && delivery?.driver;
  const canCancel = state === "pending"; // Solo se puede cancelar antes de ser aceptado

  return (
    <View
      className="bg-gray-900 px-6 pt-6 pb-3 mt-3"
      style={{ borderRadius: 16 }}
    >
      {/* Header con checkpoint integrado */}
      {delivery?.status !== "delivered" && delivery?.status !== "cancelled" && (
        <View className="mb-6 w-full px-2">
          <View
            className="rounded-2xl p-6 border-2"
            style={{
              backgroundColor:
                state === "on_the_way"
                  ? "rgba(139, 92, 246, 0.15)"
                  : state === "ready"
                    ? "rgba(34, 197, 94, 0.15)"
                    : state === "preparing"
                      ? "rgba(59, 130, 246, 0.15)"
                      : state === "confirmed"
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
              borderColor:
                state === "on_the_way"
                  ? "#8b5cf6"
                  : state === "ready"
                    ? "#22c55e"
                    : state === "preparing"
                      ? "#3b82f6"
                      : state === "confirmed"
                        ? "#10b981"
                        : "#f59e0b",
            }}
          >
            {/* Timeline horizontal con checkpoint */}
            <View
              className="relative items-center mb-5"
              style={{ height: 80, overflow: "visible" }}
            >
              {/* Línea de progreso de fondo */}
              <View
                className="absolute h-0.5 bg-gray-700"
                style={{
                  width: "80%",
                  top: 28,
                  left: "10%",
                }}
              />

              {/* Línea de progreso activa */}
              <View
                className="absolute h-0.5"
                style={{
                  width: `${getProgressPercentage() * 0.8}%`,
                  backgroundColor:
                    state === "on_the_way"
                      ? "#8b5cf6"
                      : state === "ready"
                        ? "#22c55e"
                        : state === "preparing"
                          ? "#3b82f6"
                          : state === "confirmed"
                            ? "#10b981"
                            : "#f59e0b",
                  top: 28,
                  left: "10%",
                }}
              />

              {/* Estado actual - Grande y centrado */}
              <View
                className="absolute items-center"
                style={{ alignSelf: "center" }}
              >
                <View
                  className="rounded-full items-center justify-center shadow-lg"
                  style={{
                    width: 56,
                    height: 56,
                    backgroundColor:
                      state === "on_the_way"
                        ? "#8b5cf6"
                        : state === "ready"
                          ? "#22c55e"
                          : state === "preparing"
                            ? "#3b82f6"
                            : state === "confirmed"
                              ? "#10b981"
                              : "#f59e0b",
                    borderWidth: 4,
                    borderColor:
                      state === "on_the_way"
                        ? "#a78bfa"
                        : state === "ready"
                          ? "#4ade80"
                          : state === "preparing"
                            ? "#60a5fa"
                            : state === "confirmed"
                              ? "#22c55e"
                              : "#fbbf24",
                  }}
                >
                  {state === "pending" && <Clock size={28} color="#ffffff" />}
                  {state === "confirmed" && (
                    <CheckCircle size={28} color="#ffffff" />
                  )}
                  {state === "preparing" && (
                    <Package size={28} color="#ffffff" />
                  )}
                  {state === "ready" && (
                    <CheckCircle size={28} color="#ffffff" />
                  )}
                  {state === "on_the_way" && (
                    <Truck size={28} color="#ffffff" />
                  )}
                </View>
                <Text
                  className="mt-3 text-center font-bold"
                  style={{
                    fontSize: 15,
                    color:
                      state === "on_the_way"
                        ? "#8b5cf6"
                        : state === "ready"
                          ? "#22c55e"
                          : state === "preparing"
                            ? "#3b82f6"
                            : state === "confirmed"
                              ? "#10b981"
                              : "#f59e0b",
                  }}
                >
                  {state === "pending" && "Recibido"}
                  {state === "confirmed" && "Confirmado"}
                  {state === "preparing" && "Preparando"}
                  {state === "ready" && "Listo"}
                  {state === "on_the_way" && "En Camino"}
                </Text>
              </View>

              {/* Estados anteriores - Pequeños a la izquierda */}
              <View
                className="absolute flex-row items-center"
                style={{ left: -40, top: 18 }}
              >
                {state !== "pending" && (
                  <>
                    <View
                      className="rounded-full mr-2"
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: "#d4af37",
                        opacity: 0.5,
                      }}
                    />
                    <View
                      className="rounded-full mr-2"
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: "#d4af37",
                        opacity: 0.4,
                      }}
                    />
                    {(state === "preparing" ||
                      state === "ready" ||
                      state === "on_the_way") && (
                      <View
                        className="rounded-full"
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: "#d4af37",
                          opacity: 0.3,
                        }}
                      />
                    )}
                  </>
                )}
              </View>

              {/* Estados siguientes - Pequeños a la derecha */}
              <View
                className="absolute flex-row items-center"
                style={{ right: -40, top: 18 }}
              >
                {state !== "on_the_way" && (
                  <>
                    {state !== "ready" && (
                      <View
                        className="rounded-full ml-2"
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: "#4b5563",
                          opacity: 0.3,
                        }}
                      />
                    )}
                    {(state === "pending" || state === "confirmed") && (
                      <View
                        className="rounded-full ml-2"
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: "#4b5563",
                          opacity: 0.4,
                        }}
                      />
                    )}
                    <View
                      className="rounded-full ml-2"
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: "#4b5563",
                        opacity: 0.5,
                      }}
                    />
                  </>
                )}
              </View>
            </View>

            {/* Título y descripción del estado */}
            <View>
              <Text className="text-white text-2xl font-bold text-center mb-2">
                {getDeliveryTitle()}
              </Text>
              <Text className="text-gray-300 text-base text-center leading-6">
                {getDeliveryDescription()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Información de dirección */}
      <View className="mb-6 w-full px-2" style={{ maxWidth: 350 }}>
        <View className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <View className="flex-row items-start">
            <MapPin size={20} color="#d4af37" />
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-white mb-1">
                Dirección de entrega
              </Text>
              <Text className="text-base text-gray-300">
                {delivery?.delivery_address}
              </Text>
              {delivery?.delivery_notes && (
                <Text className="text-sm text-gray-400 mt-2">
                  Nota: {delivery.delivery_notes}
                </Text>
              )}
            </View>
          </View>

          {delivery?.estimated_time_minutes && state !== "delivered" && (
            <View className="flex-row items-center mt-3 pt-3 border-t border-gray-700">
              <Clock size={18} color="#d4af37" />
              <Text className="text-base text-gray-300 ml-2">
                Tiempo estimado: {delivery.estimated_time_minutes} minutos
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Botones de acción */}
      <View className="w-full px-2" style={{ maxWidth: 350 }}>
        {/* Info: Usar el botón QR del navbar cuando el delivery está en camino y se seleccionó QR */}
        {state === "on_the_way" && delivery?.payment_method === "qr" && (
          <View
            className="w-full rounded-lg py-3 px-4 mb-3 border border-purple-500"
            style={{ backgroundColor: "rgba(139, 92, 246, 0.1)" }}
          >
            <Text className="text-purple-400 font-semibold text-sm text-center">
              💡 Usa el botón QR del menú inferior para escanear el código del
              repartidor
            </Text>
          </View>
        )}

        <View className="flex-row gap-3">
          {canViewTracking && (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("DeliveryTracking", {
                  deliveryId: delivery!.id,
                })
              }
              className="flex-1 rounded-lg py-4 flex-row items-center justify-center"
              style={{ backgroundColor: "#d4af37" }}
            >
              <MapPin size={20} color="white" />
              <Text className="text-white font-bold ml-2 text-base">
                Ver en Mapa
              </Text>
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity
              onPress={handleCancelDelivery}
              disabled={isCancelling}
              className={`flex-1 bg-gray-800 rounded-lg py-4 flex-row items-center justify-center border border-red-500 ${
                isCancelling ? "opacity-50" : ""
              }`}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <XCircle size={20} color="#ef4444" />
                  <Text className="text-red-500 font-bold ml-2 text-base">
                    Cancelar Pedido
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {state === "delivered" && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Home")}
              className="flex-1 bg-green-700 rounded-lg py-4 flex-row items-center justify-center"
            >
              <CheckCircle size={20} color="white" />
              <Text className="text-white font-bold ml-2 text-base">
                Finalizar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CustomAlert */}
      <CustomAlert
        visible={alertVisible}
        onClose={() => setAlertVisible(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
    </View>
  );
};

export default DeliveryFlowNavigation;
