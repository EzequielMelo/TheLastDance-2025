import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Users,
  Clock,
  QrCode,
  CheckCircle,
  MapPin,
  RefreshCcw,
  AlertCircle,
} from "lucide-react-native";
import { useClientState, ClientState } from "../../Hooks/useClientState";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";

interface ClientFlowNavigationProps {
  onRefresh?: () => void;
}

const ClientFlowNavigation: React.FC<ClientFlowNavigationProps> = ({
  onRefresh,
}) => {
  const { state, waitingPosition, assignedTable, occupiedTable, refresh } =
    useClientState();
  const navigation = useNavigation<RootStackNavigationProp>();

  const handleRefresh = async () => {
    await refresh();
    onRefresh?.();
  };

  const renderStateContent = () => {
    switch (state) {
      case "loading":
        return (
          <View className="items-center py-8">
            <RefreshCcw size={48} color="#d4af37" className="animate-spin" />
            <Text className="text-white text-lg mt-4">
              Verificando tu estado...
            </Text>
          </View>
        );

      case "not_in_queue":
        return (
          <View className="items-center">
            <Users size={64} color="#d4af37" />
            <Text className="text-white text-xl font-bold mt-4 mb-2">
              ¡Bienvenido!
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              Para comenzar, únete a la lista de espera y te asignaremos una
              mesa cuando esté disponible.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("ScanQR")}
              className="bg-yellow-600 px-8 py-4 rounded-lg flex-row items-center"
            >
              <Users size={20} color="white" className="mr-2" />
              <Text className="text-white font-semibold text-lg">
                Unirse a Lista de Espera
              </Text>
            </TouchableOpacity>
          </View>
        );

      case "in_queue":
        return (
          <View className="items-center">
            <Clock size={64} color="#d4af37" />
            <Text className="text-white text-xl font-bold mt-4 mb-2">
              En Lista de Espera
            </Text>
            <Text className="text-gray-300 text-center mb-2">
              Estás en la posición
            </Text>
            <Text className="text-yellow-400 text-4xl font-bold mb-4">
              #{waitingPosition}
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              Te notificaremos cuando tu mesa esté lista. Puedes ver tu posición
              o cancelar tu reserva.
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => navigation.navigate("MyWaitingPosition")}
                className="bg-blue-600 px-6 py-3 rounded-lg flex-row items-center"
              >
                <Clock size={16} color="white" className="mr-2" />
                <Text className="text-white font-semibold">Ver Posición</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRefresh}
                className="bg-gray-600 px-6 py-3 rounded-lg flex-row items-center"
              >
                <RefreshCcw size={16} color="white" className="mr-2" />
                <Text className="text-white font-semibold">Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "assigned":
        return (
          <View className="items-center">
            <MapPin size={64} color="#22c55e" />
            <Text className="text-white text-xl font-bold mt-4 mb-2">
              ¡Mesa Asignada!
            </Text>
            <Text className="text-gray-300 text-center mb-2">
              Te hemos asignado la mesa
            </Text>
            <Text className="text-green-400 text-4xl font-bold mb-4">
              #{assignedTable?.number}
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              Ve a tu mesa y escanea el código QR para confirmar tu llegada.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("ScanTableQR")}
              className="bg-green-600 px-8 py-4 rounded-lg flex-row items-center"
            >
              <QrCode size={20} color="white" className="mr-2" />
              <Text className="text-white font-semibold text-lg">
                Confirmar Llegada
              </Text>
            </TouchableOpacity>
          </View>
        );

      case "seated":
        return (
          <View className="items-center">
            <CheckCircle size={64} color="#22c55e" />
            <Text className="text-white text-xl font-bold mt-4 mb-2">
              ¡Mesa Confirmada!
            </Text>
            <Text className="text-gray-300 text-center mb-2">
              Estás sentado en la mesa
            </Text>
            <Text className="text-green-400 text-4xl font-bold mb-4">
              #{occupiedTable?.number}
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              ¡Disfruta tu experiencia! Aquí puedes ver el menú y hacer tu
              pedido.
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => navigation.navigate("Menu", { tableId: occupiedTable?.id })}
                className="bg-yellow-600 px-6 py-3 rounded-lg"
              >
                <Text className="text-white font-semibold">Ver Menú</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert("Llamar Mozo", "¿Necesitas asistencia?", [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Llamar",
                      onPress: () => {
                        // TODO: Implementar notificación al mozo
                        Alert.alert("Enviado", "El mozo ha sido notificado");
                      },
                    },
                  ]);
                }}
                className="bg-blue-600 px-6 py-3 rounded-lg"
              >
                <Text className="text-white font-semibold">Llamar Mozo</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "displaced":
        return (
          <View className="items-center">
            <AlertCircle size={64} color="#f59e0b" />
            <Text className="text-white text-xl font-bold mt-4 mb-2">
              Mesa Liberada
            </Text>
            <Text className="text-gray-300 text-center mb-2">
              El personal liberó tu mesa
            </Text>
            <Text className="text-yellow-400 text-lg font-bold mb-4">
              Tu sesión fue interrumpida
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              El maitre liberó tu mesa por motivos operativos. Puedes volver a
              unirte a la lista de espera si deseas otra mesa.
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => navigation.navigate("ScanQR")}
                className="bg-yellow-600 px-6 py-3 rounded-lg flex-row items-center"
              >
                <Users size={16} color="white" className="mr-2" />
                <Text className="text-white font-semibold">Nueva Reserva</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRefresh}
                className="bg-gray-600 px-6 py-3 rounded-lg flex-row items-center"
              >
                <RefreshCcw size={16} color="white" className="mr-2" />
                <Text className="text-white font-semibold">Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "error":
        return (
          <View className="items-center">
            <AlertCircle size={64} color="#ef4444" />
            <Text className="text-white text-xl font-bold mt-4 mb-2">
              Error de Conexión
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              No pudimos verificar tu estado. Verifica tu conexión e intenta
              nuevamente.
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              className="bg-red-600 px-8 py-4 rounded-lg flex-row items-center"
            >
              <RefreshCcw size={20} color="white" className="mr-2" />
              <Text className="text-white font-semibold text-lg">
                Reintentar
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View className="bg-gray-900 rounded-lg p-6 mx-4 my-2">
      {renderStateContent()}
    </View>
  );
};

export default ClientFlowNavigation;
