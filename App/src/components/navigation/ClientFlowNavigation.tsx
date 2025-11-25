import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
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
  Download,
} from "lucide-react-native";
import { useClientState, ClientState } from "../../Hooks/useClientState";
import { useClientStateSocket } from "../../Hooks/useClientStateSocket";
import {
  checkTableDeliveryStatus,
  getAnonymousOrderData,
} from "../../api/orders";
import { PDFService } from "../../services/pdfService";
import { useAuth } from "../../auth/useAuth";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";
import { io, Socket } from "socket.io-client";
import { SERVER_BASE_URL } from "../../api/config";

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

  // Socket para actualizaciones en tiempo real
  useClientStateSocket(refresh);

  const navigation = useNavigation<RootStackNavigationProp>();
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<{
    allDelivered: boolean;
    totalItems: number;
    deliveredItems: number;
  } | null>(null);
  const [lastRefreshTrigger, setLastRefreshTrigger] = useState(0);
  const [anonymousOrderData, setAnonymousOrderData] = useState<{
    hasOrder: boolean;
    orderData?: {
      clientName: string;
      tableNumber: string;
      items: Array<{
        name: string;
        description: string;
        category: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      subtotal: number;
      tipAmount: number;
      gameDiscountAmount: number;
      gameDiscountPercentage: number;
      totalAmount: number;
      satisfactionLevel: string;
      orderDate: string;
      orderTime: string;
      invoiceNumber: string;
    };
  } | null>(null);

  const handleRefresh = async () => {
    await refresh();

    // Verificar datos de orden para usuarios anónimos
    if (user?.profile_code === "cliente_anonimo") {
      try {
        const orderDataCheck = await getAnonymousOrderData();
        setAnonymousOrderData(orderDataCheck);
      } catch (error) {
        console.error("Error verificando datos de orden anónimos:", error);
      }
    }

    onRefresh?.();
  };

  // Verificar delivery status cuando la pantalla está en foco
  useFocusEffect(
    React.useCallback(() => {
      // Verificar datos de orden para usuarios anónimos
      if (user?.profile_code === "cliente_anonimo") {
        getAnonymousOrderData()
          .then(setAnonymousOrderData)
          .catch(console.error);
      }

      if (
        state === "seated" &&
        occupiedTable?.id &&
        deliveryConfirmationStatus === "pending"
      ) {
        checkTableDeliveryStatus(occupiedTable.id)
          .then(setDeliveryStatus)
          .catch(console.error);
      }
    }, [
      state,
      occupiedTable?.id,
      deliveryConfirmationStatus,
      user?.profile_code,
    ]),
  );

  // Solo ejecutar cuando se dispare refreshTrigger (pull-to-refresh)
  useEffect(() => {
    // Solo ejecutar si es un nuevo trigger válido
    if (refreshTrigger && refreshTrigger > lastRefreshTrigger) {
      setLastRefreshTrigger(refreshTrigger);

      // Refrescar estado general
      refresh();

      // Verificar delivery status si corresponde (con delay para que refresh termine)
      setTimeout(() => {
        if (
          state === "seated" &&
          occupiedTable?.id &&
          deliveryConfirmationStatus === "pending"
        ) {
          checkTableDeliveryStatus(occupiedTable.id)
            .then(setDeliveryStatus)
            .catch(console.error);
        }
      }, 500);
    }
  }, [refreshTrigger]); // SOLO refreshTrigger como dependencia

  // Socket.IO para escuchar actualizaciones de items entregados en tiempo real
  useEffect(() => {
    if (!user || !token || !occupiedTable?.id || state !== "seated") {
      console.log("⏸️ Socket.IO no iniciado - Condiciones no cumplidas:", {
        hasUser: !!user,
        hasToken: !!token,
        hasTable: !!occupiedTable?.id,
        state,
      });
      return;
    }

    console.log("🚀 Iniciando Socket.IO para items entregados...", {
      userId: user.id,
      tableId: occupiedTable.id,
      profileCode: user.profile_code,
      tokenLength: token.length,
    });

    // Usar el token de sesión real (JWT de Supabase)
    const authToken = token;

    console.log("🔑 Token JWT presente - longitud:", token.length);

    // Crear conexión Socket.IO
    const socket = io(SERVER_BASE_URL, {
      auth: { token: authToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(
        `🔌 Socket.IO CONECTADO - SocketId: ${socket.id}, Mesa: ${occupiedTable.id}`,
      );
      socket.emit("join_table_room", occupiedTable.id);
    });

    socket.on(
      "joined_table_room",
      (data: { tableId: string; tableRoom: string }) => {
        console.log(
          `✅ CONFIRMACIÓN: Unido exitosamente a sala ${data.tableRoom}`,
        );
      },
    );

    // Escuchar actualizaciones de items marcados como entregados
    socket.on("order_items_delivered", (data: { tableId: string }) => {
      console.log(
        `📦 EVENTO RECIBIDO - Items entregados en mesa ${data.tableId}`,
      );
      if (data.tableId === occupiedTable.id) {
        console.log(
          "✅ TableId coincide - Recargando TODO el estado del cliente...",
        );

        // Recargar TODO el estado del cliente (más robusto que solo actualizar números)
        refresh()
          .then(() => {
            console.log("✅ Estado del cliente recargado completamente");
            // También actualizar el delivery status específicamente
            return checkTableDeliveryStatus(occupiedTable.id);
          })
          .then(newStatus => {
            console.log("📊 Nuevo delivery status:", newStatus);
            setDeliveryStatus(newStatus);
          })
          .catch(error => {
            console.error("❌ Error recargando estado:", error);
          });
      } else {
        console.log(
          `⚠️ TableId no coincide: recibido ${data.tableId}, esperado ${occupiedTable.id}`,
        );
      }
    });

    socket.on("disconnect", reason => {
      console.log("🔌 Socket.IO DESCONECTADO:", reason);
    });

    socket.on("connect_error", error => {
      console.error("❌ ERROR de conexión Socket.IO:", error.message);
    });

    socket.on("error", (error: { message: string }) => {
      console.error("❌ ERROR Socket.IO del servidor:", error.message);
    });

    return () => {
      console.log("🧹 Limpiando Socket.IO...");
      socket.off("order_items_delivered");
      socket.off("joined_table_room");
      socket.off("connect_error");
      socket.off("error");
      socket.disconnect();
    };
  }, [user?.id, token, occupiedTable?.id, state]);

  const renderStateContent = () => {
    // Verificar si es usuario anónimo con pedido listo para facturar, independientemente del estado
    if (
      user?.profile_code === "cliente_anonimo" &&
      anonymousOrderData?.hasOrder
    ) {
      return (
        <View className="items-center">
          {/* Header con ícono a la izquierda y textos a la derecha */}
          <View className="flex-row items-center mb-2 w-full justify-center px-2">
            <Download size={58} color="#10b981" />
            <View className="ml-4" style={{ maxWidth: 200 }}>
              <Text className="text-white text-2xl font-bold">
                ¡Factura Lista!
              </Text>
              <Text className="text-gray-300 text-lg">
                Mesa #{anonymousOrderData.orderData?.tableNumber}
              </Text>
            </View>
          </View>

          <Text className="text-green-400 text-center text-lg font-semibold mb-2">
            Tu factura está lista para descargar
          </Text>

          <Text className="text-gray-300 text-center text-lg mb-6">
            Pago confirmado por $
            {anonymousOrderData.orderData?.totalAmount?.toLocaleString()}. Si
            deseas realizar nuevos pedidos, crea una cuenta para disfrutar de
            beneficios exclusivos.
          </Text>

          {/* Botón de descarga */}
          <View className="w-full mb-6">
            <TouchableOpacity
              onPress={async () => {
                if (anonymousOrderData.orderData) {
                  try {
                    await PDFService.generateInvoicePDF(
                      anonymousOrderData.orderData,
                    );
                  } catch (error) {
                    console.error("Error generando PDF:", error);
                    Alert.alert(
                      "Error",
                      "No se pudo generar la factura. Inténtalo de nuevo.",
                    );
                  }
                }
              }}
              className="bg-green-600 py-4 rounded-lg flex-row justify-center items-center mb-4"
              style={{
                elevation: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
              }}
            >
              <Download size={24} color="white" />
              <Text className="text-white text-lg font-bold ml-3">
                Descargar Factura
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

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
          <View>
            {/* Header con ícono a la izquierda y textos a la derecha */}
            <View className="flex-row items-center mb-6 w-full justify-center px-2">
              <Users size={58} color="#d4af37" />
              <View className="ml-4" style={{ maxWidth: 200 }}>
                <Text className="text-white text-2xl font-bold">
                  ¡Bienvenido!
                </Text>
                <Text className="text-gray-300 text-lg">
                  Únete a la lista de espera
                </Text>
              </View>
            </View>

            <Text className="text-gray-300 text-center text-lg mb-6">
              Para comenzar, usa el botón QR del menú inferior para unirte a la
              lista de espera.
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
            </View>
          </View>
        );

      case "in_queue":
        return (
          <View>
            {/* Header con ícono a la izquierda y textos a la derecha */}
            <View className="flex-row items-center mb-6 w-full justify-center px-2">
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
              Te notificaremos cuando tu mesa esté lista. Mientras esperas,
              puedes ver tu posición o consultar las encuestas del restaurante.
            </Text>

            {/* Botones circulares */}
            <View className="w-full mb-6">
              <View
                className="flex-row justify-around items-center"
                style={{ paddingHorizontal: 60 }}
              >
                {/* Ver Posición */}
                <View className="items-center">
                  <TouchableOpacity
                    onPress={() => navigation.navigate("MyWaitingPosition")}
                    className="bg-blue-600 w-16 h-16 rounded-full items-center justify-center mb-2"
                    style={{
                      elevation: 4,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                    }}
                  >
                    <Clock size={24} color="white" />
                  </TouchableOpacity>
                  <View style={{ height: 32, justifyContent: "center" }}>
                    <Text className="text-white text-center text-xs font-medium">
                      Ver{"\n"}Posición
                    </Text>
                  </View>
                </View>

                {/* Ver Encuestas */}
                <View className="items-center">
                  <TouchableOpacity
                    onPress={() => navigation.navigate("SurveyStats")}
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
                  <View style={{ height: 32, justifyContent: "center" }}>
                    <Text className="text-white text-center text-xs font-medium">
                      Ver{"\n"}Encuestas
                    </Text>
                  </View>
                </View>
              </View>
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

            <Text className="text-gray-300 text-center text-lg mb-6">
              Ve a tu mesa y usa el botón QR inferior para confirmar tu llegada.
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
            </View>
          </View>
        );

      case "seated":
        return (
          <View className="items-center">
            {/* Si el table_status es 'bill_requested', mostrar solo botón para pagar cuenta */}
            {deliveryConfirmationStatus === "bill_requested" ? (
              <>
                {/* Header con ícono a la izquierda y textos a la derecha */}
                <View className="flex-row items-center mb-2 w-full justify-center px-2">
                  <Receipt size={58} color="#f59e0b" />
                  <View className="ml-4" style={{ maxWidth: 200 }}>
                    <Text className="text-white text-2xl font-bold">
                      Pagar la Cuenta
                    </Text>
                    <Text className="text-gray-300 text-lg">
                      Mesa {occupiedTable?.number}
                    </Text>
                  </View>
                </View>

                <Text className="text-amber-400 text-center text-lg font-semibold mb-4">
                  Lista para pagar
                </Text>

                <Text className="text-gray-300 text-center mb-6">
                  Usa el botón QR del menú inferior para ver tu carrito y
                  proceder con el pago, o responde la encuesta de satisfacción.
                </Text>

                {/* Botones circulares: QR y Encuesta */}
                <View className="w-full mb-6">
                  <View
                    className="flex-row justify-around items-center"
                    style={{ paddingHorizontal: 60 }}
                  >
                    {/* Botón QR para pagar */}
                    <View className="items-center">
                      <View
                        className="bg-yellow-600 w-16 h-16 rounded-full items-center justify-center mb-2"
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
                      <View style={{ height: 32, justifyContent: "center" }}>
                        <Text className="text-white text-center text-xs font-medium">
                          Pagar usando{"\n"}QR
                        </Text>
                      </View>
                    </View>

                    {/* Encuesta */}
                    <View className="items-center">
                      <TouchableOpacity
                        onPress={() => {
                          if (occupiedTable) {
                            navigation.navigate("Survey", {
                              tableId: occupiedTable.id,
                              waiterId: occupiedTable.id_waiter || "",
                            });
                          }
                        }}
                        className="bg-blue-600 w-16 h-16 rounded-full items-center justify-center mb-2"
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
                      <View style={{ height: 32, justifyContent: "center" }}>
                        <Text className="text-white text-center text-xs font-medium">
                          Encuesta
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            ) : /* Si el table_status es 'confirmed', mostrar acceso directo a juegos/encuestas */
            deliveryConfirmationStatus === "confirmed" ? (
              <>
                {/* Header con ícono a la izquierda y textos a la derecha */}
                <View className="flex-row items-center mb-2 w-full justify-center px-2">
                  <CheckCircle size={58} color="#10b981" />
                  <View className="ml-4">
                    <Text className="text-white text-2xl font-bold">
                      ¡Pedido Confirmado!
                    </Text>
                    <Text className="text-gray-300 text-lg">
                      Mesa {occupiedTable?.number}
                    </Text>
                  </View>
                </View>

                <Text className="text-green-400 text-center text-lg font-semibold mb-4">
                  Acceso completo desbloqueado
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
                        onPress={() => {
                          if (occupiedTable) {
                            navigation.navigate("Survey", {
                              tableId: occupiedTable.id,
                              waiterId: occupiedTable.id_waiter || "",
                            });
                          }
                        }}
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
                    {/* Header con ícono a la izquierda y textos a la derecha */}
                    <View className="flex-row items-center mb-2 w-full justify-center px-2">
                      <Package size={58} color="#22c55e" />
                      <View className="ml-4" style={{ maxWidth: 200 }}>
                        <Text className="text-white text-2xl font-bold">
                          ¡Pedido en Mesa!
                        </Text>
                        <Text className="text-gray-300 text-lg">
                          Mesa {occupiedTable?.number}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-green-400 text-center text-lg font-semibold mb-2">
                      {deliveryStatus.totalItems}{" "}
                      {deliveryStatus.totalItems === 1
                        ? "Producto entregado"
                        : "Productos entregados"}
                    </Text>

                    <Text className="text-gray-300 text-center text-lg mb-6">
                      Tu pedido está completo. Usa el botón QR inferior para
                      abrir tu carrito y confirmar la recepción.
                    </Text>
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

                {/* Botones para estado seated - Ver Menú, Chat y Juegos */}
                <View className="w-full mb-6">
                  <View className="flex-row justify-around items-center">
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
                      <View style={{ height: 32, justifyContent: "center" }}>
                        <Text className="text-white text-center text-xs font-medium">
                          Juegos
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
              ></TouchableOpacity>
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
    <View
      className="bg-gray-900 px-6 pt-6 pb-3 mt-3"
      style={{ borderRadius: 16 }}
    >
      {renderStateContent()}
    </View>
  );
};

export default ClientFlowNavigation;
