import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ToastAndroid,
  Modal,
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
  const [averageWaitTime, setAverageWaitTime] = useState<number | undefined>();
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);

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
    Alert.alert("Liberar Mesa", "¿Confirmas que quieres liberar esta mesa?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Liberar",
        onPress: async () => {
          try {
            await api.post(`/tables/${tableId}/free`);
            ToastAndroid.show("Mesa liberada", ToastAndroid.SHORT);
            loadData();
          } catch (error: any) {
            ToastAndroid.show("Error al liberar mesa", ToastAndroid.SHORT);
          }
        },
      },
    ]);
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

  const availableTables = tables.filter(table => !table.is_occupied);
  const occupiedTables = tables.filter(table => table.is_occupied);

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 px-4 pt-4"
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

        {/* Tables Status Section */}
        <Section
          title="Estado de Mesas"
          icon={<TableIcon size={20} color="#d4af37" />}
        >
          <View className="flex-row flex-wrap gap-2">
            {tables.map(table => (
              <TableCard
                key={table.id}
                table={table}
                onFree={() => handleFreeTable(table.id)}
              />
            ))}
          </View>
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

      {/* Assign Table Modal */}
      <Modal
        visible={showAssignModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#1a1a1a] rounded-t-3xl p-6 max-h-[70%]">
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
                <Text className="text-white font-medium">
                  {selectedClient.users.first_name}{" "}
                  {selectedClient.users.last_name}
                </Text>
                <Text className="text-gray-400">
                  {selectedClient.party_size} personas •{" "}
                  {selectedClient.preferred_table_type || "Sin preferencia"}
                </Text>
                {selectedClient.special_requests && (
                  <Text className="text-gray-400 italic mt-1">
                    "{selectedClient.special_requests}"
                  </Text>
                )}
              </View>
            )}

            <Text className="text-white mb-3">Mesas Disponibles:</Text>
            <ScrollView className="max-h-80">
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
                      className={`bg-white/10 rounded-xl p-4 mb-2 flex-row items-center justify-between ${
                        assigningTable ? "opacity-50" : ""
                      }`}
                    >
                      <View>
                        <Text className="text-white font-medium">
                          Mesa {table.number}
                        </Text>
                        <Text className="text-gray-400">
                          {table.capacity} personas • {table.type}
                        </Text>
                      </View>
                      <ArrowRight size={20} color="#d4af37" />
                    </TouchableOpacity>
                  ))
              ) : (
                <View className="py-8 items-center">
                  <AlertCircle size={32} color="#6b7280" />
                  <Text className="text-gray-400 text-center mt-2">
                    No hay mesas disponibles
                  </Text>
                </View>
              )}
            </ScrollView>

            {assigningTable && (
              <View className="items-center mt-4">
                <RefreshCw size={20} color="#d4af37" />
                <Text className="text-gray-400 mt-2">Asignando mesa...</Text>
              </View>
            )}
          </View>
        </View>
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
        <View className="flex-1">
          <View className="flex-row items-center">
            {isVip && <Crown size={16} color="#d4af37" />}
            <Text
              className={`font-semibold ${isVip ? "text-yellow-400 ml-1" : "text-white"}`}
            >
              {client.users.first_name} {client.users.last_name}
            </Text>
            {!isVip && position && (
              <View className="bg-gray-600 rounded-full px-2 py-1 ml-2">
                <Text className="text-white text-xs">#{position}</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center mt-1 flex-wrap">
            <View className="flex-row items-center mr-4">
              <User size={14} color="#9ca3af" />
              <Text className="text-gray-400 text-sm ml-1">
                {client.party_size}
              </Text>
            </View>

            <View className="flex-row items-center mr-4">
              <Clock size={14} color="#9ca3af" />
              <Text className="text-gray-400 text-sm ml-1">
                {waitingTime}min
              </Text>
            </View>
          </View>

          {client.preferred_table_type && (
            <Text className="text-gray-400 text-sm mt-1">
              Prefiere: {client.preferred_table_type}
            </Text>
          )}

          {client.special_requests && (
            <Text className="text-gray-400 text-sm mt-1 italic">
              "{client.special_requests}"
            </Text>
          )}
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
}: {
  table: TableStatus;
  onFree: () => void;
}) {
  return (
    <View
      className={`rounded-xl p-3 min-w-[120px] ${
        table.is_occupied
          ? "bg-red-500/20 border border-red-500/30"
          : "bg-green-500/20 border border-green-500/30"
      }`}
    >
      <View className="items-center">
        <Text
          className={`font-bold text-lg ${table.is_occupied ? "text-red-400" : "text-green-400"}`}
        >
          {table.number}
        </Text>
        <Text className="text-gray-400 text-xs">{table.capacity} personas</Text>
        <Text className="text-gray-400 text-xs">{table.type}</Text>

        {table.is_occupied ? (
          <>
            {table.client && (
              <Text className="text-gray-300 text-xs mt-1 text-center">
                {table.client.first_name} {table.client.last_name}
              </Text>
            )}
            <TouchableOpacity
              onPress={onFree}
              className="bg-red-600 rounded px-2 py-1 mt-2"
            >
              <Text className="text-white text-xs">Liberar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text className="text-green-400 text-xs mt-1">Disponible</Text>
        )}
      </View>
    </View>
  );
}
