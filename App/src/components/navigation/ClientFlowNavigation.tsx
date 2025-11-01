import React, { useState, useEffect } from "react";
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
  Package,
  Gamepad2,
  FileText,
  Receipt,
  UtensilsCrossed,
  MessageCircle,
  ArrowDown,
} from "lucide-react-native";
import { useClientState, ClientState } from "../../Hooks/useClientState";
import {
  confirmTableDelivery,
  checkTableDeliveryStatus,
} from "../../api/orders";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";

interface ClientFlowNavigationProps {
  onRefresh?: () => void;
  refreshTrigger?: number;
}

const ClientFlowNavigation: React.FC<ClientFlowNavigationProps> = ({
  onRefresh,
  refreshTrigger,
}) => {
  const {
    state,
    waitingPosition,
    assignedTable,
    occupiedTable,
    deliveryConfirmationStatus,
    refresh,
  } = useClientState();
  const navigation = useNavigation<RootStackNavigationProp>();
  const [deliveryStatus, setDeliveryStatus] = useState<{
    allDelivered: boolean;
    totalItems: number;
    deliveredItems: number;
  } | null>(null);
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [lastRefreshTrigger, setLastRefreshTrigger] = useState(0);

  const handleRefresh = async () => {
    await refresh();
    onRefresh?.();
  };

  // Solo ejecutar cuando se dispare refreshTrigger (pull-to-refresh)
  useEffect(() => {
    // Solo ejecutar si es un nuevo trigger válido
    if (refreshTrigger && refreshTrigger > lastRefreshTrigger) {
      setLastRefreshTrigger(refreshTrigger);
      console.log("🔄 Pull-to-refresh activado");

      // Refrescar estado general
      refresh();

      // Verificar delivery status si corresponde (con delay para que refresh termine)
      setTimeout(() => {
        if (
          state === "seated" &&
          occupiedTable?.id &&
          deliveryConfirmationStatus === "pending"
        ) {
          console.log("🔍 Verificando delivery status");
          checkTableDeliveryStatus(occupiedTable.id)
            .then(setDeliveryStatus)
            .catch(console.error);
        }
      }, 500);
    }
  }, [refreshTrigger]); // SOLO refreshTrigger como dependencia

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
          <View>
            {/* Header con ícono a la izquierda y textos a la derecha */}
            <View className="flex-row items-center mb-6 w-full px-2">
              <Clock size={58} color="#d4af37" />
              <View className="flex-1 ml-4">
                <Text className="text-white text-2xl font-bold">
                  En Lista de Espera
                </Text>
                <Text className="text-gray-300 text-lg">
                  Estás en la posición #{waitingPosition}
                </Text>
              </View>
            </View>

            <Text className="text-gray-300 text-center mb-6">
              Te notificaremos cuando tu mesa esté lista. Puedes ver tu posición
              o cancelar tu reserva.
            </Text>
            <View className="flex-row gap-4 justify-center">
              <TouchableOpacity
                onPress={() => navigation.navigate("MyWaitingPosition")}
                className="bg-blue-600 px-6 py-3 rounded-lg flex-row items-center"
              >
                <Clock size={16} color="white" className="mr-2" />
                <Text className="text-white font-semibold ml-2">
                  Ver Posición
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "assigned":
        return (
          <View>
            {/* Header con ícono a la izquierda y textos a la derecha */}
            <View className="flex-row items-center mb-6 w-full px-2">
              <MapPin size={58} color="#22c55e" />
              <View className="flex-1 ml-4">
                <Text className="text-white text-2xl font-bold">
                  ¡Mesa Asignada!
                </Text>
                <Text className="text-gray-300 text-lg">
                  Te hemos asignado la mesa #{assignedTable?.number}
                </Text>
              </View>
            </View>

            <Text className="text-gray-300 text-center mb-6">
              Ve a tu mesa y usa el botón QR del menú inferior para confirmar tu
              llegada.
            </Text>

            {/* Indicador visual del botón QR */}
            <View className="items-center">
              <View
                className="bg-yellow-600 w-16 h-16 rounded-full items-center justify-center mb-3"
                style={{
                  shadowColor: "#d4af37",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <QrCode size={32} color="#1a1a1a" />
              </View>
              <ArrowDown size={32} color="#d4af37" />
              <Text className="text-yellow-500 text-sm font-semibold mt-2">
                Presiona aquí para escanear
              </Text>
            </View>
          </View>
        );

      case "seated":
        return (
          <View className="items-center">
            {/* Si el table_status es 'bill_requested', mostrar solo botón para pagar cuenta */}
            {deliveryConfirmationStatus === "bill_requested" ? (
              <>
                <Receipt size={64} color="#f59e0b" />
                <Text className="text-white text-xl font-bold mt-4 mb-2">
                  Pagar la Cuenta
                </Text>
                <Text className="text-gray-300 text-center mb-2">
                  Mesa {occupiedTable?.number}
                </Text>
                <Text className="text-amber-400 text-lg font-semibold mb-4">
                  Lista para pagar
                </Text>
                <Text className="text-gray-300 text-center mb-6">
                  Escanea el código QR de tu mesa para proceder con el pago o
                  responde la encuesta de satisfacción.
                </Text>

                {/* Botones para pagar cuenta y encuesta */}
                <View className="flex-col gap-3 w-full items-center">
                  <TouchableOpacity
                    onPress={() => navigation.navigate("ScanOrderQR")}
                    className="bg-amber-600 px-8 py-4 rounded-lg flex-row items-center w-64"
                  >
                    <QrCode size={20} color="white" className="mr-2" />
                    <Text className="text-white font-semibold text-lg ml-2">
                      Escanear QR
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => navigation.navigate("Survey")}
                    className="bg-blue-600 px-8 py-4 rounded-lg flex-row items-center w-64"
                  >
                    <FileText size={20} color="white" className="mr-2" />
                    <Text className="text-white font-semibold text-lg ml-2">
                      Encuesta
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : /* Si el table_status es 'confirmed', mostrar acceso directo a juegos/encuestas */
            deliveryConfirmationStatus === "confirmed" ? (
              <>
                {console.log(
                  "🎉 Showing confirmed state - Acceso directo a opciones!",
                )}
                <CheckCircle size={64} color="#10b981" />
                <Text className="text-white text-xl font-bold mt-4 mb-2">
                  ¡Pedido Confirmado!
                </Text>
                <Text className="text-gray-300 text-center mb-2">
                  Mesa {occupiedTable?.number}
                </Text>
                <Text className="text-green-400 text-lg font-semibold mb-4">
                  Acceso completo desbloqueado
                </Text>
                <Text className="text-gray-300 text-center mb-8">
                  Si todavía no has jugado, ¡ahora es tu oportunidad! Si lográs
                  ganar en tu primera victoria, desbloquearás un descuento para
                  tu cuenta.
                </Text>

                {/* Botones circulares estilo MercadoPago */}
                <View className="w-full mb-6">
                  {/* Primera fila: Ver Menú, Chat, Juegos */}
                  <View className="flex-row justify-around items-center mb-8">
                    {/* Ver Menú */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => navigation.navigate("Menu")}
                        className="bg-blue-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                        style={{
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                        }}
                      >
                        <UtensilsCrossed size={24} color="white" />
                      </TouchableOpacity>
                      <Text className="text-white text-center text-xs font-medium">
                        Ver Menú
                      </Text>
                    </View>

                    {/* Chat con Mesero */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => {
                          if (occupiedTable) {
                            navigation.navigate("TableChat", {
                              tableId: occupiedTable.id,
                            });
                          }
                        }}
                        className="bg-orange-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                        style={{
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                        }}
                      >
                        <MessageCircle size={24} color="white" />
                      </TouchableOpacity>
                      <Text className="text-white text-center text-xs font-medium">
                        Chat con{"\n"}mesero
                      </Text>
                    </View>

                    {/* Juegos */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => navigation.navigate("Games")}
                        className="bg-purple-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                        style={{
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                        }}
                      >
                        <Gamepad2 size={24} color="white" />
                      </TouchableOpacity>
                      <Text className="text-white text-center text-xs font-medium">
                        Juegos
                      </Text>
                    </View>
                  </View>

                  {/* Segunda fila: Encuesta, Pedir la Cuenta */}
                  <View
                    className="flex-row justify-around items-center"
                    style={{ paddingHorizontal: 60 }}
                  >
                    {/* Encuesta */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => navigation.navigate("Survey")}
                        className="bg-green-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                        style={{
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                        }}
                      >
                        <FileText size={24} color="white" />
                      </TouchableOpacity>
                      <Text className="text-white text-center text-xs font-medium">
                        Encuesta
                      </Text>
                    </View>

                    {/* Pedir la Cuenta */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => {
                          if (occupiedTable) {
                            navigation.navigate("TableChat", {
                              tableId: occupiedTable.id,
                              autoMessage: "Pedir la cuenta.",
                            });
                          }
                        }}
                        className="bg-red-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                        style={{
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                        }}
                      >
                        <Receipt size={24} color="white" />
                      </TouchableOpacity>
                      <Text className="text-white text-center text-xs font-medium">
                        Pedir la{"\n"}cuenta
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Si table_status es 'confirmed', NO mostrar "Pedido en Mesa" */}
                {/* Si todos los items están 'delivered' pero aún no confirmado, mostrar botón de confirmación */}
                {deliveryStatus?.allDelivered &&
                deliveryStatus.totalItems > 0 &&
                deliveryConfirmationStatus === "pending" ? (
                  <>
                    {console.log(
                      "✅ Showing delivered state - Pedido en Mesa!",
                    )}
                    <Package size={64} color="#22c55e" />
                    <Text className="text-white text-xl font-bold mt-4 mb-2">
                      ¡Pedido en Mesa!
                    </Text>
                    <Text className="text-gray-300 text-center mb-2">
                      Mesa {occupiedTable?.number}
                    </Text>
                    <Text className="text-green-400 text-lg font-semibold mb-4">
                      {deliveryStatus.totalItems} Productos entregados
                    </Text>
                    <Text className="text-gray-300 text-center mb-6">
                      Tu pedido está completo. Confirma que has recibido todo
                      para desbloquear juegos y encuestas.
                    </Text>

                    <TouchableOpacity
                      onPress={() => navigation.navigate("ScanOrderQR")}
                      className="bg-green-600 px-8 py-4 rounded-lg flex-row items-center mb-4"
                    >
                      <QrCode size={20} color="white" className="mr-2" />
                      <Text className="text-white font-semibold text-lg">
                        Confirmar Recepción
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* Header con ícono a la izquierda y textos a la derecha */}
                    <View className="flex-row items-center mb-6 w-full px-2">
                      <CheckCircle size={58} color="#22c55e" />
                      <View className="flex-1 ml-4">
                        <Text className="text-white text-2xl font-bold">
                          ¡Mesa Confirmada!
                        </Text>
                        <Text className="text-gray-300 text-lg">
                          Estás sentado en la mesa #{occupiedTable?.number}
                        </Text>
                      </View>
                    </View>

                    {/* Mostrar estado de entrega si hay pedidos */}
                    {deliveryStatus && deliveryStatus.totalItems > 0 ? (
                      <View className="mb-4">
                        <Text className="text-yellow-400 text-center mb-6">
                          📦 {deliveryStatus.deliveredItems}/
                          {deliveryStatus.totalItems} items entregados
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-gray-300 text-center mb-6">
                        ¡Disfruta tu experiencia! Aquí puedes ver el menú y
                        hacer tu pedido.
                      </Text>
                    )}
                  </>
                )}

                {/* Botones para estado seated - Solo Ver Menú y Chat */}
                <View className="w-full mb-6">
                  <View
                    className="flex-row justify-around items-center"
                    style={{ paddingHorizontal: 60 }}
                  >
                    {/* Ver Menú */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => navigation.navigate("Menu")}
                        className="bg-blue-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                        style={{
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                        }}
                      >
                        <UtensilsCrossed size={24} color="white" />
                      </TouchableOpacity>
                      <View style={{ height: 32, justifyContent: "center" }}>
                        <Text className="text-white text-center text-xs font-medium">
                          Ver Menú
                        </Text>
                      </View>
                    </View>

                    {/* Chat con Mesero */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => {
                          if (occupiedTable) {
                            navigation.navigate("TableChat", {
                              tableId: occupiedTable.id,
                            });
                          }
                        }}
                        className="bg-orange-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                        style={{
                          elevation: 4,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                        }}
                      >
                        <MessageCircle size={24} color="white" />
                      </TouchableOpacity>
                      <View style={{ height: 32, justifyContent: "center" }}>
                        <Text className="text-white text-center text-xs font-medium">
                          Chat con{"\n"}mesero
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        );

      case "confirm_pending":
        return (
          <View className="items-center">
            <Clock size={64} color="#f59e0b" />
            <Text className="text-white text-xl font-bold mt-4 mb-2">
              Pago Pendiente de Confirmación
            </Text>
            <Text className="text-gray-300 text-center mb-2">
              Hemos recibido tu pago
            </Text>
            <Text className="text-amber-400 text-lg font-semibold mb-4">
              Esperando confirmación del mozo
            </Text>
            <Text className="text-gray-300 text-center mb-6">
              Tu pago fue procesado exitosamente. El mozo confirmará la
              recepción y liberará tu mesa en breve.
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={handleRefresh}
                className="bg-amber-600 px-6 py-3 rounded-lg flex-row items-center"
              >
                <RefreshCcw size={16} color="white" className="mr-2" />
                <Text className="text-white font-semibold">
                  Actualizar Estado
                </Text>
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
    <View className="bg-gray-900 p-6 my-2" style={{ borderRadius: 16 }}>
      {renderStateContent()}
    </View>
  );
};

export default ClientFlowNavigation;
