import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ToastAndroid,
  Modal,
  Image,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import {
  Users,
  Clock,
  User,
  Phone,
  Crown,
  CheckCircle,
  XCircle,
  Table as TableIcon,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  QrCode,
} from "lucide-react-native";
import api from "../../api/axios";
import type {
  WaitingListEntry,
  TableStatus,
  AssignTableRequest,
  WaitingListResponse,
  TablesStatusResponse,
} from "../../types/WaitingList";
import { useAuth } from "../../auth/AuthContext";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ManageWaitingListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<WaitingListEntry | null>(
    null,
  );
  const [assigningTable, setAssigningTable] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [freeingTable, setFreeingTable] = useState<string | null>(null);
  const [averageWaitTime, setAverageWaitTime] = useState<number | undefined>();
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [showTablesModal, setShowTablesModal] = useState(false);

  // Verificar permisos
  const canManage =
    user?.position_code === "maitre" ||
    user?.profile_code === "dueno" ||
    user?.profile_code === "supervisor";

  const loadData = useCallback(async () => {
    try {
      const [waitingResponse, tablesResponse] = await Promise.all([
        api.get<WaitingListResponse>("/tables/waiting-list"),
        api.get<TablesStatusResponse>("/tables/status"),
      ]);

      const waitingData = waitingResponse.data;
      const tablesData = tablesResponse.data;

      setWaitingList(waitingData.waiting_list || []);
      setTotalWaiting(waitingData.total_waiting || 0);
      setAverageWaitTime(waitingData.average_wait_time);

      setTables(tablesData.tables || []);
      setOccupiedCount(tablesData.occupied_count || 0);
      setAvailableCount(tablesData.available_count || 0);

      // Debug: verificar estructura de mesas ocupadas
      const occupiedTables =
        tablesData.tables?.filter(t => t.is_occupied) || [];
    } catch (error: any) {
      console.error("Error loading data:", error);
      ToastAndroid.show("Error al cargar datos", ToastAndroid.SHORT);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Animated pan responder para permitir arrastrar el modal hacia abajo y cerrarlo
  const pan = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get("window").height;
  const [isPanning, setIsPanning] = useState(false);
  const panValue = useRef(0);

  // Mantener un listener para conocer el valor actual de `pan` desde JS
  useEffect(() => {
    const id = pan.addListener(({ value }) => {
      panValue.current = value;
    });
    return () => {
      pan.removeListener(id);
    };
  }, [pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dy, dx } = gestureState;
        // Solo activar si:
        // 1. El movimiento es principalmente vertical (más dy que dx)
        // 2. El movimiento es hacia abajo (dy > 0)
        // 3. El ScrollView está en el tope (scrollOffset <= 0)
        // 4. Supera un umbral mínimo
        const isVertical = Math.abs(dy) > Math.abs(dx);
        const isDownward = dy > 3;
        const isScrollAtTop = scrollOffset <= 0;

        return isVertical && isDownward && isScrollAtTop;
      },
      onPanResponderGrant: () => {
        pan.stopAnimation();
        const current = panValue.current || 0;
        pan.setOffset(current);
        pan.setValue(0);
        setIsPanning(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const { dy } = gestureState;
        if (dy > 0) {
          const clamped = Math.max(0, Math.min(dy, screenHeight));
          pan.setValue(clamped);
        } else {
          pan.setValue(0);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        const shouldClose = dy > 120 || vy > 0.8;

        pan.flattenOffset();

        if (shouldClose) {
          Animated.timing(pan, {
            toValue: screenHeight,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            pan.setValue(0);
            pan.setOffset(0);
            setShowAssignModal(false);
            setSelectedClient(null);
            setIsPanning(false);
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }).start(() => {
            pan.setValue(0);
            pan.setOffset(0);
            setIsPanning(false);
          });
        }
      },
    }),
  ).current;

  // Resetear la animación cuando se abra/cierre el modal
  useEffect(() => {
    pan.setValue(0);
    pan.setOffset(0);
  }, [showAssignModal]);

  // translateY derivado de pan pero clampado entre 0 y screenHeight
  const translateY = pan.interpolate
    ? pan.interpolate({
        inputRange: [0, screenHeight],
        outputRange: [0, screenHeight],
        extrapolate: "clamp",
      })
    : pan;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAssignTable = (client: WaitingListEntry) => {
    setSelectedClient(client);
    setShowAssignModal(true);
  };

  const confirmAssignTable = async (tableId: string) => {
    if (!selectedClient) return;

    setAssigningTable(true);
    try {
      const assignData: AssignTableRequest = {
        waiting_list_id: selectedClient.id,
        table_id: tableId,
      };

      await api.post("/tables/assign", assignData);

      ToastAndroid.show("Cliente asignado exitosamente", ToastAndroid.SHORT);
      setShowAssignModal(false);
      setSelectedClient(null);
      loadData(); // Recargar datos
    } catch (error: any) {
      console.error("Error assigning table:", error);
      const message = error.response?.data?.error || "Error al asignar mesa";
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } finally {
      setAssigningTable(false);
    }
  };

  const handleFreeTable = async (tableId: string) => {
    // Encontrar la mesa en los datos para mostrar información específica
    const table = tables.find(t => t.id === tableId);
    const tableNumber = table?.number || "desconocida";

    // Si la mesa tiene una reserva próxima, mostrar opción de cancelar reserva
    if (table?.reservation) {
      Alert.alert(
        "🔒 Mesa Reservada",
        `La mesa ${tableNumber} tiene una reserva aprobada:\n\n` +
          `Hora: ${table.reservation.time}\n` +
          `Personas: ${table.reservation.party_size}\n\n` +
          `¿Qué deseas hacer?`,
        [
          {
            text: "Volver",
            style: "cancel",
          },
          {
            text: "Cancelar Reserva",
            style: "destructive",
            onPress: async () => {
              setFreeingTable(tableId);
              try {
                await api.post(`/tables/${tableId}/cancel-reservation`);
                ToastAndroid.show(
                  `Reserva cancelada para mesa ${tableNumber}`,
                  ToastAndroid.LONG,
                );
                await loadData();
              } catch (error: any) {
                const message =
                  error.response?.data?.error || "Error al cancelar reserva";
                ToastAndroid.show(message, ToastAndroid.LONG);
                console.error("Error cancelando reserva:", error);
              } finally {
                setFreeingTable(null);
              }
            },
          },
        ],
      );
      return;
    }

    // Flujo normal para mesas sin reserva
    const clientName = table?.client
      ? `${table.client.first_name} ${table.client.last_name}`
      : "Sin cliente asignado";

    Alert.alert(
      "⚠️ Liberar Mesa",
      `¿Estás seguro que quieres liberar la mesa ${tableNumber}?\n\n` +
        `Esta acción:\n` +
        `• Liberará la mesa inmediatamente\n` +
        `• Removerá al cliente actual de la mesa\n` +
        `• No se puede deshacer\n\n` +
        `${
          table?.is_occupied
            ? "La mesa está actualmente ocupada por el cliente."
            : table?.client
              ? "La mesa está asignada pero el cliente aún no la ha confirmado."
              : "La mesa está disponible."
        }`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "SÍ, LIBERAR",
          style: "destructive",
          onPress: async () => {
            setFreeingTable(tableId);
            try {
              await api.post(`/tables/${tableId}/free`);
              ToastAndroid.show(
                `Mesa ${tableNumber} liberada correctamente`,
                ToastAndroid.LONG,
              );
              await loadData();
            } catch (error: any) {
              ToastAndroid.show(
                `Error al liberar mesa ${tableNumber}`,
                ToastAndroid.LONG,
              );
              console.error("Error liberando mesa:", error);
            } finally {
              setFreeingTable(null);
            }
          },
        },
      ],
    );
  };

  if (!canManage) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <XCircle size={64} color="#ef4444" />
        <Text className="text-white text-lg mt-4 font-semibold">
          Acceso denegado
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          Solo los maitre, supervisores y dueños pueden gestionar la lista de
          espera
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-[#d4af37] px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-black font-semibold">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <RefreshCw size={32} color="#d4af37" />
        <Text className="text-white mt-2">Cargando datos...</Text>
      </View>
    );
  }

  // Separar VIPs y clientes regulares, ordenados correctamente
  const vipClients = waitingList
    .filter(client => client.priority > 0)
    .sort((a, b) => {
      // Primero por prioridad (descendente), luego por hora de llegada (ascendente)
      if (a.priority !== b.priority) return b.priority - a.priority;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });

  const regularClients = waitingList
    .filter(client => client.priority === 0)
    .sort(
      (a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    );

  const availableTables = tables.filter(
    table => !table.is_occupied && !table.client && !table.reservation,
  );
  const assignedTables = tables.filter(
    table => !table.is_occupied && table.client,
  );
  const occupiedTables = tables.filter(table => table.is_occupied);
  const reservedTables = tables.filter(
    table => !table.is_occupied && !table.client && table.reservation,
  );

  function TablesStatusModal({
    visible,
    onClose,
    tables,
    onFreeTable,
    freeingTable,
  }: {
    visible: boolean;
    onClose: () => void;
    tables: TableStatus[];
    onFreeTable: (tableId: string) => void;
    freeingTable: string | null;
  }) {
    const pan = useRef(new Animated.Value(0)).current;
    const screenHeight = Dimensions.get("window").height;
    const [isPanning, setIsPanning] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const panValue = useRef(0);

    useEffect(() => {
      const id = pan.addListener(({ value }) => {
        panValue.current = value;
      });
      return () => {
        pan.removeListener(id);
      };
    }, [pan]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const { dy, dx } = gestureState;
          const isVertical = Math.abs(dy) > Math.abs(dx);
          const isDownward = dy > 3;
          const isScrollAtTop = scrollOffset <= 0;

          return isVertical && isDownward && isScrollAtTop;
        },
        onPanResponderGrant: () => {
          pan.stopAnimation();
          const current = panValue.current || 0;
          pan.setOffset(current);
          pan.setValue(0);
          setIsPanning(true);
        },
        onPanResponderMove: (_, gestureState) => {
          const { dy } = gestureState;
          if (dy > 0) {
            const clamped = Math.max(0, Math.min(dy, screenHeight));
            pan.setValue(clamped);
          } else {
            pan.setValue(0);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dy, vy } = gestureState;
          const shouldClose = dy > 120 || vy > 0.8;

          pan.flattenOffset();

          if (shouldClose) {
            Animated.timing(pan, {
              toValue: screenHeight,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              pan.setValue(0);
              pan.setOffset(0);
              onClose();
              setIsPanning(false);
            });
          } else {
            Animated.spring(pan, {
              toValue: 0,
              friction: 8,
              useNativeDriver: true,
            }).start(() => {
              pan.setValue(0);
              pan.setOffset(0);
              setIsPanning(false);
            });
          }
        },
      }),
    ).current;

    useEffect(() => {
      pan.setValue(0);
      pan.setOffset(0);
    }, [visible]);

    const translateY = pan.interpolate
      ? pan.interpolate({
          inputRange: [0, screenHeight],
          outputRange: [0, screenHeight],
          extrapolate: "clamp",
        })
      : pan;

    const availableTables = tables.filter(
      table => !table.is_occupied && !table.client && !table.reservation,
    );
    const assignedTables = tables.filter(
      table => !table.is_occupied && table.client,
    );
    const occupiedTables = tables.filter(table => table.is_occupied);
    const reservedTables = tables.filter(
      table => !table.is_occupied && !table.client && table.reservation,
    );

    return (
      <Modal
        visible={visible}
        transparent={false}
        animationType="none"
        onRequestClose={onClose}
      >
        <Animated.View
          className="flex-1 bg-[#1a1a1a]"
          style={{
            transform: [{ translateY: translateY }],
          }}
        >
          {/* Header draggable */}
          <View
            {...panResponder.panHandlers}
            className="bg-[#1a1a1a] px-6 pt-12 pb-4"
          >
            {/* Indicador de arrastre */}
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 rounded-full bg-gray-600" />
            </View>

            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <TableIcon size={24} color="#d4af37" />
                <Text className="text-white text-xl font-semibold ml-2">
                  Estado de Mesas
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <XCircle size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Estadísticas rápidas */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              <View className="flex-1 min-w-[100px] bg-green-500/20 rounded-xl p-3 border border-green-500/30">
                <Text className="text-green-400 text-2xl font-bold">
                  {availableTables.length}
                </Text>
                <Text className="text-green-400 text-xs">Disponibles</Text>
              </View>
              <View className="flex-1 min-w-[100px] bg-yellow-500/20 rounded-xl p-3 border border-yellow-500/30">
                <Text className="text-yellow-400 text-2xl font-bold">
                  {assignedTables.length}
                </Text>
                <Text className="text-yellow-400 text-xs">Asignadas</Text>
              </View>
              <View className="flex-1 min-w-[100px] bg-purple-500/20 rounded-xl p-3 border border-purple-500/30">
                <Text className="text-purple-400 text-2xl font-bold">
                  {reservedTables.length}
                </Text>
                <Text className="text-purple-400 text-xs">Reservadas</Text>
              </View>
              <View className="flex-1 min-w-[100px] bg-red-500/20 rounded-xl p-3 border border-red-500/30">
                <Text className="text-red-400 text-2xl font-bold">
                  {occupiedTables.length}
                </Text>
                <Text className="text-red-400 text-xs">Ocupadas</Text>
              </View>
            </View>
          </View>

          {/* ScrollView - contenido */}
          <ScrollView
            className="flex-1 px-6"
            scrollEnabled={!isPanning}
            onScroll={e => setScrollOffset(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
          >
            {/* Mesas Ocupadas */}
            {occupiedTables.length > 0 && (
              <View className="mb-6">
                <Text className="text-white text-base font-semibold mb-3">
                  Mesas Ocupadas ({occupiedTables.length})
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {occupiedTables.map(table => (
                    <TableCard
                      key={table.id}
                      table={table}
                      onFree={() => onFreeTable(table.id)}
                      isFreeing={freeingTable === table.id}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Mesas Asignadas */}
            {assignedTables.length > 0 && (
              <View className="mb-6">
                <Text className="text-white text-base font-semibold mb-3">
                  Mesas Asignadas ({assignedTables.length})
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {assignedTables.map(table => (
                    <TableCard
                      key={table.id}
                      table={table}
                      onFree={() => onFreeTable(table.id)}
                      isFreeing={freeingTable === table.id}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Mesas Reservadas */}
            {reservedTables.length > 0 && (
              <View className="mb-6">
                <Text className="text-white text-base font-semibold mb-3">
                  🔒 Mesas Reservadas ({reservedTables.length})
                </Text>
                <Text className="text-gray-400 text-xs mb-3">
                  Estas mesas tienen reservas confirmadas para hoy
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {reservedTables.map(table => (
                    <TableCard
                      key={table.id}
                      table={table}
                      onFree={() => onFreeTable(table.id)}
                      isFreeing={freeingTable === table.id}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Mesas Disponibles */}
            {availableTables.length > 0 && (
              <View className="mb-6">
                <Text className="text-white text-base font-semibold mb-3">
                  Mesas Disponibles ({availableTables.length})
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {availableTables.map(table => (
                    <TableCard
                      key={table.id}
                      table={table}
                      onFree={() => onFreeTable(table.id)}
                      isFreeing={freeingTable === table.id}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Espaciado al final */}
            <View className="h-8" />
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      {/* Header fijo con título */}
      <View className="px-4 pt-12 pb-4 border-b border-gray-800">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Users size={28} color="#d4af37" />
            <Text className="text-white text-2xl font-bold ml-3">
              Gestión de Espera
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="bg-white/10 rounded-full p-2"
          >
            <XCircle size={24} color="#d4af37" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d4af37"
          />
        }
      >
        {/* Header Statistics */}
        <View className="flex-row justify-between mb-6">
          <StatCard
            title="En Espera"
            value={totalWaiting.toString()}
            icon={<Users size={20} color="#d4af37" />}
            bgColor="bg-yellow-500/20"
          />
          <StatCard
            title="Mesas Libres"
            value={availableCount.toString()}
            icon={<TableIcon size={20} color="#22c55e" />}
            bgColor="bg-green-500/20"
          />
          <StatCard
            title="Ocupadas"
            value={occupiedCount.toString()}
            icon={<TableIcon size={20} color="#ef4444" />}
            bgColor="bg-red-500/20"
          />
        </View>

        {/* Average Wait Time */}
        {averageWaitTime && (
          <View className="bg-blue-500/20 rounded-xl p-4 mb-6">
            <View className="flex-row items-center">
              <Clock size={18} color="#3b82f6" />
              <Text className="text-blue-400 ml-2 font-medium">
                Tiempo promedio de espera: {averageWaitTime} minutos
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => setShowTablesModal(true)}
          className="bg-[#d4af37] rounded-xl p-4 mb-6 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <TableIcon size={20} color="#1a1a1a" />
            <Text className="text-black text-base font-semibold ml-2">
              Ver Estado de Mesas
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className="bg-black/10 rounded-full px-2 py-1 mr-2">
              <Text className="text-black text-xs font-bold">
                {tables.length}
              </Text>
            </View>
            <ArrowRight size={20} color="#1a1a1a" />
          </View>
        </TouchableOpacity>

        {/* VIP Clients Section */}
        {vipClients.length > 0 && (
          <Section
            title="Clientes VIP"
            icon={<Crown size={20} color="#d4af37" />}
          >
            {vipClients.map(client => (
              <ClientCard
                key={client.id}
                client={client}
                onAssign={() => handleAssignTable(client)}
                isVip={true}
              />
            ))}
          </Section>
        )}

        {/* Regular Clients Section */}
        <Section
          title="Lista de Espera"
          icon={<Clock size={20} color="#d4af37" />}
        >
          {regularClients.length > 0 ? (
            regularClients.map((client, index) => (
              <ClientCard
                key={client.id}
                client={client}
                onAssign={() => handleAssignTable(client)}
                position={index + 1}
              />
            ))
          ) : (
            <View className="bg-white/5 rounded-xl p-6 items-center">
              <Users size={32} color="#6b7280" />
              <Text className="text-gray-400 mt-2">
                No hay clientes esperando
              </Text>
            </View>
          )}
        </Section>
        <View className="h-8" />
      </ScrollView>

      {/* Floating QR Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("GenerateWaitingListQR")}
        className="absolute bottom-6 right-6 bg-[#d4af37] rounded-full p-4 shadow-lg"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <QrCode size={24} color="#1a1a1a" />
      </TouchableOpacity>

      {/* Modal de Estado de Mesas */}
      <TablesStatusModal
        visible={showTablesModal}
        onClose={() => setShowTablesModal(false)}
        tables={tables}
        onFreeTable={handleFreeTable}
        freeingTable={freeingTable}
      />

      {/* Assign Table Modal */}
      <Modal
        visible={showAssignModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <Animated.View
          className="flex-1 bg-[#1a1a1a]"
          style={{
            transform: [{ translateY: translateY }],
          }}
        >
          {/* Header draggable */}
          <View
            {...panResponder.panHandlers}
            className="bg-[#1a1a1a] px-6 pt-12 pb-4"
          >
            {/* Indicador de arrastre (handle) */}
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 rounded-full bg-gray-600" />
            </View>

            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-xl font-semibold">
                Asignar Mesa
              </Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <XCircle size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedClient && (
              <View className="bg-white/5 rounded-xl p-4 mb-4">
                <View className="flex-row items-center">
                  {selectedClient.users.profile_image ? (
                    <Image
                      source={{ uri: selectedClient.users.profile_image }}
                      className="w-12 h-12 rounded-full mr-3"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        marginRight: 12,
                      }}
                    />
                  ) : (
                    <View
                      className="w-12 h-12 rounded-full mr-3 bg-gray-700 items-center justify-center"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        marginRight: 12,
                      }}
                    >
                      <Text className="text-white font-bold">
                        {`${(selectedClient.users.first_name || "").charAt(0)}${(selectedClient.users.last_name || "").charAt(0)}`.toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View className="flex-1">
                    <Text
                      className="text-white font-medium"
                      style={{ fontSize: 16 }}
                    >
                      {selectedClient.users.first_name}{" "}
                      {selectedClient.users.last_name}
                    </Text>
                    <Text className="text-gray-400" style={{ marginTop: 2 }}>
                      {selectedClient.party_size} personas •{" "}
                      {selectedClient.preferred_table_type || "Sin preferencia"}
                    </Text>
                  </View>
                </View>

                {selectedClient.special_requests && (
                  <Text className="text-gray-400 italic mt-3">
                    "{selectedClient.special_requests}"
                  </Text>
                )}
              </View>
            )}

            <Text className="text-white text-base font-medium">
              Mesas Disponibles:
            </Text>
          </View>

          {/* ScrollView - resto del contenido */}
          <ScrollView
            className="flex-1 px-6"
            scrollEnabled={!isPanning}
            onScroll={e => setScrollOffset(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
          >
            {availableTables.length > 0 ? (
              availableTables
                .filter(
                  table =>
                    !selectedClient ||
                    table.capacity >= selectedClient.party_size,
                )
                .map(table => (
                  <TouchableOpacity
                    key={table.id}
                    onPress={() => confirmAssignTable(table.id)}
                    disabled={assigningTable}
                    className={`bg-white/10 rounded-xl p-4 mb-3 flex-row items-center justify-between ${
                      assigningTable ? "opacity-50" : ""
                    }`}
                  >
                    <View>
                      <Text className="text-white font-medium text-base">
                        Mesa {table.number}
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        {table.capacity} personas{" • "}
                        {table.type}
                      </Text>
                    </View>
                    <ArrowRight size={20} color="#d4af37" />
                  </TouchableOpacity>
                ))
            ) : (
              <View className="py-12 items-center">
                <AlertCircle size={40} color="#6b7280" />
                <Text className="text-gray-400 text-center mt-3 text-base">
                  No hay mesas disponibles
                </Text>
              </View>
            )}

            {/* Espaciado al final */}
            <View className="h-8" />
          </ScrollView>

          {assigningTable && (
            <View className="items-center py-6 bg-[#1a1a1a]">
              <RefreshCw size={24} color="#d4af37" />
              <Text className="text-gray-400 mt-2 text-base">
                Asignando mesa...
              </Text>
            </View>
          )}
        </Animated.View>
      </Modal>
    </LinearGradient>
  );
}

function StatCard({
  title,
  value,
  icon,
  bgColor,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <View className={`${bgColor} rounded-xl p-4 flex-1 mx-1`}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-white text-2xl font-bold">{value}</Text>
          <Text className="text-gray-300 text-xs">{title}</Text>
        </View>
        {icon}
      </View>
    </View>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-3">
        {icon}
        <Text className="text-white text-lg font-semibold ml-2">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ClientCard({
  client,
  onAssign,
  isVip = false,
  position,
}: {
  client: WaitingListEntry;
  onAssign: () => void;
  isVip?: boolean;
  position?: number;
}) {
  const waitingTime = Math.floor(
    (Date.now() - new Date(client.joined_at).getTime()) / (1000 * 60),
  );

  return (
    <View
      className={`rounded-xl p-4 mb-3 ${isVip ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-white/5"}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row flex-1">
          {/* Avatar */}
          {client.users.profile_image ? (
            <Image
              source={{ uri: client.users.profile_image }}
              className="w-14 h-14 rounded-full mr-4"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                marginRight: 12,
              }}
            />
          ) : (
            <View
              className="w-14 h-14 rounded-full mr-4 bg-gray-700 items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                marginRight: 12,
              }}
            >
              <Text className="text-white font-bold">
                {`${(client.users.first_name || "").charAt(0)}${(client.users.last_name || "").charAt(0)}`.toUpperCase()}
              </Text>
            </View>
          )}

          <View className="flex-1">
            <View className="flex-row items-center">
              {isVip && <Crown size={18} color="#d4af37" />}
              <Text
                className={`font-bold ${isVip ? "text-yellow-400 ml-2 text-lg" : "text-white text-lg ml-2"}`}
                style={{ fontSize: 18 }}
              >
                {client.users.first_name} {client.users.last_name}
              </Text>
              {client.users.profile_code === "cliente_anonimo" && (
                <View className="bg-orange-500/20 rounded-full px-2 py-1 ml-2">
                  <Text className="text-orange-400 text-xs font-medium">
                    ANÓNIMO
                  </Text>
                </View>
              )}
              {!isVip && position && (
                <View className="bg-gray-600 rounded-full px-2 py-1 ml-2">
                  <Text className="text-white text-xs">#{position}</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center py-1 flex-wrap">
              <View className="flex-row items-center mr-4 mb-2">
                <User size={16} color="#9ca3af" />
                <Text
                  className="text-gray-100 text-sm ml-2"
                  style={{ fontSize: 14 }}
                >
                  {client.party_size} •{" "}
                  {client.preferred_table_type
                    ? client.preferred_table_type
                    : "—"}
                </Text>
              </View>

              <View className="flex-row items-center mr-4">
                <Clock size={16} color="#9ca3af" />
                <Text
                  className="text-gray-100 text-sm ml-2"
                  style={{ fontSize: 14 }}
                >
                  {waitingTime} min
                </Text>
              </View>
            </View>

            {client.special_requests && (
              <Text
                className="text-gray-100 text-sm mt-2 italic"
                style={{ fontSize: 13 }}
              >
                "{client.special_requests}"
              </Text>
            )}
          </View>
        </View>

        <View className="ml-3">
          <TouchableOpacity
            onPress={onAssign}
            className="bg-green-600 rounded-lg px-3 py-2 flex-row items-center"
          >
            <CheckCircle size={16} color="white" />
            <Text className="text-white text-sm ml-1 font-medium">Asignar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function TableCard({
  table,
  onFree,
  isFreeing = false,
}: {
  table: TableStatus;
  onFree: () => void;
  isFreeing?: boolean;
}) {
  // Determinar el estado de la mesa
  const getTableState = () => {
    if (table.is_occupied) return "occupied";
    if (table.client) return "assigned";
    if (table.reservation) return "reserved"; // Nueva categoría para mesas con reserva próxima
    return "available";
  };

  const tableState = getTableState();

  // Configuración de colores según el estado
  const stateConfig = {
    occupied: {
      bg: "bg-red-500/20 border border-red-500/30",
      text: "text-red-400",
    },
    assigned: {
      bg: "bg-yellow-500/20 border border-yellow-500/30",
      text: "text-yellow-400",
    },
    reserved: {
      bg: "bg-purple-500/20 border border-purple-500/30",
      text: "text-purple-400",
    },
    available: {
      bg: "bg-green-500/20 border border-green-500/30",
      text: "text-green-400",
    },
  };

  return (
    <View
      className={`rounded-xl p-4 min-w-[140px] ${stateConfig[tableState].bg}`}
    >
      <View className="items-center">
        <Text className={`font-bold text-2xl ${stateConfig[tableState].text}`}>
          {table.number}
        </Text>
        <Text className="text-gray-400 text-sm mt-1">{table.capacity} personas</Text>
        <Text className="text-gray-400 text-sm">{table.type}</Text>

        {tableState === "occupied" ? (
          <>
            {table.client && (
              <>
                <Text className="text-gray-300 text-sm mt-1 text-center font-medium">
                  {table.client.first_name} {table.client.last_name}
                </Text>
                {table.client.profile_code === "cliente_anonimo" && (
                  <Text className="text-orange-400 text-sm text-center font-medium">
                    ANÓNIMO
                  </Text>
                )}
              </>
            )}
            <TouchableOpacity
              onPress={onFree}
              disabled={isFreeing}
              className={`rounded px-4 py-2 mt-2 border ${
                isFreeing
                  ? "bg-gray-600 border-gray-500"
                  : "bg-red-600 hover:bg-red-700 border-red-500"
              }`}
            >
              <Text className="text-white text-sm font-semibold">
                {isFreeing ? "🔄 Liberando..." : "⚠️ Liberar"}
              </Text>
            </TouchableOpacity>
          </>
        ) : tableState === "assigned" ? (
          <>
            {table.client && (
              <>
                <Text className="text-gray-300 text-sm mt-1 text-center font-medium">
                  {table.client.first_name} {table.client.last_name}
                </Text>
                {table.client.profile_code === "cliente_anonimo" && (
                  <Text className="text-orange-400 text-sm text-center font-medium">
                    ANÓNIMO
                  </Text>
                )}
              </>
            )}
            <Text className="text-yellow-400 text-sm mt-1 font-medium">Asignada</Text>
            <Text className="text-gray-400 text-sm">
              Esperando confirmación
            </Text>
            <TouchableOpacity
              onPress={onFree}
              disabled={isFreeing}
              className={`rounded px-4 py-2 mt-2 border ${
                isFreeing
                  ? "bg-gray-600 border-gray-500"
                  : "bg-yellow-600 hover:bg-yellow-700 border-yellow-500"
              }`}
            >
              <Text className="text-white text-sm font-semibold">
                {isFreeing ? "🔄 Liberando..." : "↩️ Reasignar"}
              </Text>
            </TouchableOpacity>
          </>
        ) : tableState === "reserved" ? (
          <>
            {table.reservation && (
              <>
                <Text className="text-purple-400 text-sm mt-1 font-semibold">
                  🔒 Reservada
                </Text>
                <Text className="text-gray-300 text-sm text-center">
                  {table.reservation.time}
                </Text>
                <Text className="text-gray-400 text-sm">
                  {table.reservation.party_size} personas
                </Text>
              </>
            )}
            <TouchableOpacity
              onPress={onFree}
              disabled={isFreeing}
              className={`rounded px-4 py-2 mt-2 border ${
                isFreeing
                  ? "bg-gray-600 border-gray-500"
                  : "bg-purple-600 hover:bg-purple-700 border-purple-500"
              }`}
            >
              <Text className="text-white text-sm font-semibold">
                {isFreeing ? "🔄 Cancelando..." : "❌ Cancelar Reserva"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text className="text-green-400 text-sm mt-1 font-medium">Disponible</Text>
        )}
      </View>
    </View>
  );
}
