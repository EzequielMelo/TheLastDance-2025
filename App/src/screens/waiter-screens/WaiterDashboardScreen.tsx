import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../auth/useAuth";
import { API_BASE_URL } from "../../api/config";
import { Logger } from "../../utils/Logger";
import ChefLoading from "../../components/common/ChefLoading";
import { useChatNotifications } from "../../Hooks/useChatNotifications";
import { ChatNotificationBadge } from "../../components/chat/ChatNotificationBadge";

interface WaiterTable {
  id: string;
  number: number;
  capacity: number;
  type: string;
  is_occupied: boolean;
  id_client: string | null;
  id_waiter: string | null;
  photo_url: string;
  qr_url: string;
}

interface WaiterInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_image?: string;
  assigned_tables: WaiterTable[];
  available_slots: number;
}

export default function WaiterDashboardScreen() {
  const { user, token } = useAuth();
  const navigation = useNavigation();
  const [waiterInfo, setWaiterInfo] = useState<WaiterInfo | null>(null);
  const [availableTables, setAvailableTables] = useState<WaiterTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAvailableTables, setShowAvailableTables] = useState(false);

  // Hook para notificaciones de chat
  const { getUnreadCount, markTableAsRead, refreshNotifications } =
    useChatNotifications();

  useEffect(() => {
    if (user?.position_code === "mozo") {
      loadWaiterData();
    }
  }, [user]);

  const loadWaiterData = async () => {
    if (!token) return;

    try {
      setLoading(true);
      await Promise.all([loadWaiterInfo(), loadAvailableTables()]);
    } catch (error) {
      Logger.error("Error cargando datos del mesero:", error);
      Alert.alert("Error", "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const loadWaiterInfo = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/waiter/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWaiterInfo(data.data);
      }
    } catch (error) {
      Logger.error("Error cargando información del mesero:", error);
    }
  };

  const loadAvailableTables = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/waiter/available-tables`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableTables(data.data);
      }
    } catch (error) {
      Logger.error("Error cargando mesas disponibles:", error);
    }
  };

  const assignTable = async (tableId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/waiter/assign-table`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tableId }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("¡Éxito!", "Mesa asignada correctamente");
        await loadWaiterData(); // Recargar datos
      } else {
        Alert.alert("Error", data.message || "No se pudo asignar la mesa");
      }
    } catch (error) {
      Logger.error("Error asignando mesa:", error);
      Alert.alert("Error", "Error de conexión");
    }
  };

  const unassignTable = async (tableId: string) => {
    if (!token) return;

    // Primero verificar si se puede desasignar
    try {
      const checkResponse = await fetch(
        `${API_BASE_URL}/waiter/can-unassign/${tableId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const checkData = await checkResponse.json();

      if (!checkData.data.canUnassign) {
        Alert.alert("No se puede desasignar", checkData.data.message);
        return;
      }

      // Confirmar con el usuario
      Alert.alert(
        "Confirmar desasignación",
        "¿Estás seguro de que quieres desasignar esta mesa?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Desasignar",
            style: "destructive",
            onPress: async () => {
              try {
                const response = await fetch(
                  `${API_BASE_URL}/waiter/unassign-table/${tableId}`,
                  {
                    method: "DELETE",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                  },
                );

                const data = await response.json();

                if (response.ok) {
                  Alert.alert("¡Éxito!", "Mesa desasignada correctamente");
                  await loadWaiterData(); // Recargar datos
                } else {
                  Alert.alert(
                    "Error",
                    data.message || "No se pudo desasignar la mesa",
                  );
                }
              } catch (error) {
                Logger.error("Error desasignando mesa:", error);
                Alert.alert("Error", "Error de conexión");
              }
            },
          },
        ],
      );
    } catch (error) {
      Logger.error("Error verificando desasignación:", error);
      Alert.alert("Error", "Error de conexión");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadWaiterData(), refreshNotifications()]);
    setRefreshing(false);
  };

  const renderAssignedTable = ({ item }: { item: WaiterTable }) => (
    <View style={styles.tableCard}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableNumber}>Mesa {item.number}</Text>
        <Text style={styles.tableCapacity}>{item.capacity} personas</Text>
      </View>

      <View style={styles.tableInfo}>
        <Text style={styles.tableType}>Tipo: {item.type}</Text>
        <Text
          style={[
            styles.tableStatus,
            item.is_occupied ? styles.occupiedStatus : styles.availableStatus,
          ]}
        >
          {item.is_occupied ? "🔴 Ocupada" : "🟢 Libre"}
        </Text>
      </View>

      {item.id_client && (
        <Text style={styles.clientInfo}>👤 Con cliente asignado</Text>
      )}

      {item.is_occupied && item.id_client && (
        <View style={styles.chatButtonContainer}>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => {
              // Marcar como leído y navegar
              markTableAsRead(item.id);
              (navigation as any).navigate("TableChat", { tableId: item.id });
            }}
          >
            <Text style={styles.chatButtonText}>💬 Chat con Cliente</Text>
          </TouchableOpacity>

          {/* Notificación de mensajes no leídos */}
          <ChatNotificationBadge count={getUnreadCount(item.id)} size="small" />
        </View>
      )}

      <TouchableOpacity
        style={styles.unassignButton}
        onPress={() => unassignTable(item.id)}
        disabled={item.is_occupied || !!item.id_client}
      >
        <Text
          style={[
            styles.unassignButtonText,
            (item.is_occupied || !!item.id_client) && styles.disabledButtonText,
          ]}
        >
          Desasignar Mesa
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderAvailableTable = ({ item }: { item: WaiterTable }) => (
    <View style={styles.availableTableCard}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableNumber}>Mesa {item.number}</Text>
        <Text style={styles.tableCapacity}>{item.capacity} personas</Text>
      </View>

      <Text style={styles.tableType}>Tipo: {item.type}</Text>

      <TouchableOpacity
        style={styles.assignButton}
        onPress={() => assignTable(item.id)}
        disabled={!waiterInfo || waiterInfo.available_slots <= 0}
      >
        <Text
          style={[
            styles.assignButtonText,
            (!waiterInfo || waiterInfo.available_slots <= 0) &&
              styles.disabledButtonText,
          ]}
        >
          Asignar Mesa
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (user?.position_code !== "mozo") {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>
          Solo los meseros pueden acceder a esta pantalla
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ChefLoading size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[{ key: "content" }]}
        renderItem={() => (
          <View>
            {/* Header del mesero */}
            <View style={styles.header}>
              <Text style={styles.title}>Panel del Mesero</Text>
              {waiterInfo && (
                <Text style={styles.subtitle}>
                  {waiterInfo.first_name} {waiterInfo.last_name}
                </Text>
              )}
            </View>

            {/* Estadísticas */}
            {waiterInfo && (
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>
                    {waiterInfo.assigned_tables.length}
                  </Text>
                  <Text style={styles.statLabel}>Mesas Asignadas</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>
                    {waiterInfo.available_slots}
                  </Text>
                  <Text style={styles.statLabel}>Espacios Libres</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>
                    {
                      waiterInfo.assigned_tables.filter(t => t.is_occupied)
                        .length
                    }
                  </Text>
                  <Text style={styles.statLabel}>Mesas Ocupadas</Text>
                </View>
              </View>
            )}

            {/* Mesas asignadas */}
            <Text style={styles.sectionTitle}>Mis Mesas Asignadas</Text>
            {waiterInfo && waiterInfo.assigned_tables.length > 0 ? (
              waiterInfo.assigned_tables.map(table => (
                <View key={table.id}>
                  {renderAssignedTable({ item: table })}
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No tienes mesas asignadas</Text>
            )}

            {/* Botón para mostrar mesas disponibles */}
            {waiterInfo && waiterInfo.available_slots > 0 && (
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowAvailableTables(!showAvailableTables)}
              >
                <Text style={styles.toggleButtonText}>
                  {showAvailableTables ? "Ocultar" : "Ver"} Mesas Disponibles
                </Text>
              </TouchableOpacity>
            )}

            {/* Mesas disponibles */}
            {showAvailableTables && (
              <View>
                <Text style={styles.sectionTitle}>Mesas Disponibles</Text>
                {availableTables.length > 0 ? (
                  availableTables.map(table => (
                    <View key={table.id}>
                      {renderAvailableTable({ item: table })}
                    </View>
                  ))
                ) : (
                  <Text style={styles.noDataText}>
                    No hay mesas disponibles
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#d4af37"]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#d4af37",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#fff",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#2d2d2d",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 80,
    borderColor: "#d4af37",
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d4af37",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#ccc",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#d4af37",
    marginBottom: 16,
    marginTop: 8,
  },
  tableCard: {
    backgroundColor: "#2d2d2d",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderColor: "#d4af37",
    borderWidth: 1,
  },
  availableTableCard: {
    backgroundColor: "#2d2d2d",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderColor: "#4a5568",
    borderWidth: 1,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  tableCapacity: {
    fontSize: 14,
    color: "#ccc",
  },
  tableInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tableType: {
    fontSize: 14,
    color: "#ccc",
  },
  tableStatus: {
    fontSize: 14,
    fontWeight: "bold",
  },
  occupiedStatus: {
    color: "#e53e3e",
  },
  availableStatus: {
    color: "#38a169",
  },
  clientInfo: {
    fontSize: 14,
    color: "#d4af37",
    marginBottom: 8,
  },
  chatButtonContainer: {
    position: "relative",
    marginBottom: 8,
  },
  chatButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  chatButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  unassignButton: {
    backgroundColor: "#e53e3e",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  unassignButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  assignButton: {
    backgroundColor: "#38a169",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  assignButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  disabledButtonText: {
    color: "#666",
  },
  toggleButton: {
    backgroundColor: "#d4af37",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 16,
  },
  toggleButtonText: {
    color: "#1a1a1a",
    fontWeight: "bold",
    fontSize: 16,
  },
  noDataText: {
    textAlign: "center",
    color: "#666",
    fontSize: 16,
    marginVertical: 24,
  },
  errorText: {
    textAlign: "center",
    color: "#e53e3e",
    fontSize: 18,
    marginTop: 50,
  },
});
