import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/useAuth";
import { API_BASE_URL } from "../../api/config";
import { Logger } from "../../utils/Logger";

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

export default function AllWaitersScreen() {
  const { user, token } = useAuth();
  const [waiters, setWaiters] = useState<WaiterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && ["dueno", "supervisor"].includes(user.profile_code)) {
      loadWaiters();
    }
  }, [user]);

  const loadWaiters = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/waiter/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWaiters(data.data);
      } else {
        const errorData = await response.json();
        Alert.alert(
          "Error",
          errorData.message || "No se pudieron cargar los meseros",
        );
      }
    } catch (error) {
      Logger.error("Error cargando meseros:", error);
      Alert.alert("Error", "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWaiters();
    setRefreshing(false);
  };

  const renderWaiter = ({ item }: { item: WaiterInfo }) => (
    <View style={styles.waiterCard}>
      <View style={styles.waiterHeader}>
        <Text style={styles.waiterName}>
          {item.first_name} {item.last_name}
        </Text>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            {item.assigned_tables.length}/3 mesas
          </Text>
          <Text
            style={[
              styles.availabilityText,
              item.available_slots > 0 ? styles.available : styles.full,
            ]}
          >
            {item.available_slots > 0
              ? `${item.available_slots} libres`
              : "Completo"}
          </Text>
        </View>
      </View>

      {item.assigned_tables.length > 0 ? (
        <View style={styles.tablesContainer}>
          <Text style={styles.tablesTitle}>Mesas asignadas:</Text>
          {item.assigned_tables.map(table => (
            <View key={table.id} style={styles.tableRow}>
              <Text style={styles.tableInfo}>
                Mesa {table.number} ({table.capacity}p, {table.type})
              </Text>
              <Text
                style={[
                  styles.tableStatus,
                  table.is_occupied ? styles.occupiedStatus : styles.freeStatus,
                ]}
              >
                {table.is_occupied ? "🔴 Ocupada" : "🟢 Libre"}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noTablesText}>Sin mesas asignadas</Text>
      )}
    </View>
  );

  if (!user || !["dueno", "supervisor"].includes(user.profile_code)) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>
          Solo administradores y supervisores pueden acceder a esta pantalla
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#d4af37" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Meseros</Text>
        <Text style={styles.subtitle}>
          {waiters.length} mesero{waiters.length !== 1 ? "s" : ""} en total
        </Text>
      </View>

      <FlatList
        data={waiters}
        renderItem={renderWaiter}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#d4af37"]}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay meseros registrados</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    padding: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d4af37",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#ccc",
  },
  listContainer: {
    padding: 16,
  },
  waiterCard: {
    backgroundColor: "#2d2d2d",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderColor: "#d4af37",
    borderWidth: 1,
  },
  waiterHeader: {
    marginBottom: 12,
  },
  waiterName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statText: {
    fontSize: 14,
    color: "#ccc",
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  available: {
    color: "#38a169",
  },
  full: {
    color: "#e53e3e",
  },
  tablesContainer: {
    marginTop: 8,
  },
  tablesTitle: {
    fontSize: 14,
    color: "#d4af37",
    fontWeight: "bold",
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#3d3d3d",
    borderRadius: 6,
    marginBottom: 4,
  },
  tableInfo: {
    fontSize: 13,
    color: "#fff",
    flex: 1,
  },
  tableStatus: {
    fontSize: 12,
    fontWeight: "bold",
  },
  occupiedStatus: {
    color: "#e53e3e",
  },
  freeStatus: {
    color: "#38a169",
  },
  noTablesText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    fontSize: 16,
    marginTop: 50,
  },
  errorText: {
    textAlign: "center",
    color: "#e53e3e",
    fontSize: 18,
    marginTop: 50,
    paddingHorizontal: 20,
  },
});
