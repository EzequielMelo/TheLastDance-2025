import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ToastAndroid,
  Modal,
  FlatList,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import ChefLoading from "../components/common/ChefLoading";
import { useAuth } from "../auth/useAuth";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomNav } from "../context/BottomNavContext";
import { useClientState } from "../Hooks/useClientState";
import api from "../api/axios";
import {
  Menu,
  User as UserIcon,
  Users,
  QrCode,
  UtensilsCrossed,
  Wine,
  BookOpen,
  CheckCircle,
  Clock,
  BottleWine,
  Hamburger,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "../types/User";
import ClientFlowNavigation from "../components/navigation/ClientFlowNavigation";
import Sidebar from "../components/navigation/Sidebar";
import BottomNavbar from "../components/navigation/BottomNavbar";
import CartModal from "../components/cart/CartModal";
import ActionCard from "../components/common/ActionCard";
import UserProfileCard from "../components/common/UserProfileCard";
import {
  getDishesForKitchen,
  getDrinksForBar,
  MenuItem,
} from "../services/menuService";
import { getWaiterPendingPayments, confirmPayment } from "../api/orders";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation, route }: Props) {
  const { user, token, logout, isLoading } = useAuth();
  const { activeTab, setActiveTab } = useBottomNav();
  const { state: clientState } = useClientState();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuType, setMenuType] = useState<"platos" | "bebidas">("platos");
  // Estado para el status en la lista de espera
  const [waitingListStatus, setWaitingListStatus] = useState<string | null>(
    null,
  );
  // Estados para items listos para entregar (mozos)
  const [readyItems, setReadyItems] = useState<any[]>([]);
  const [loadingReadyItems, setLoadingReadyItems] = useState(false);
  const [deliveringItems, setDeliveringItems] = useState<Set<string>>(
    new Set(),
  );
  // Estados para mesas con pago pendiente (mozos)
  const [pendingPaymentTables, setPendingPaymentTables] = useState<any[]>([]);
  const [loadingPaymentTables, setLoadingPaymentTables] = useState(false);
  const [confirmingPayments, setConfirmingPayments] = useState<Set<string>>(
    new Set(),
  );
  const [deliveringTables, setDeliveringTables] = useState<Set<string>>(
    new Set(),
  );
  // Estado para manejar refresh del cliente
  const [clientRefreshTrigger, setClientRefreshTrigger] = useState(0);
  // Estado para pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);

  // Estados específicos para dueño/supervisor
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(false);

  // Estado para información del mozo (cuando cliente está esperando confirmación)
  const [waiterInfo, setWaiterInfo] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    profile_image?: string;
  } | null>(null);

  // Función para verificar el estado en la lista de espera
  const checkWaitingListStatus = useCallback(async () => {
    if (!token || !user) return;

    try {
      const response = await api.get("/tables/my-status");
      setWaitingListStatus(response.data.status);
    } catch (error) {
      console.error("Error checking table status:", error);
      // Si hay error, asumimos que no está en la lista
      setWaitingListStatus("not_in_queue");
    }
  }, [token, user]);

  // Función para cargar items listos para entregar (solo para mozos)
  const loadReadyItems = useCallback(async () => {
    if (!user || user.position_code !== "mozo") {
      return;
    }

    try {
      setLoadingReadyItems(true);
      const response = await api.get("/orders/waiter/ready-items");

      if (response.data.success) {
        setReadyItems(response.data.data || []);
      }
    } catch (error: any) {
      console.error("Error loading ready items:", error);
      ToastAndroid.show(
        error.response?.data?.error || "Error al cargar productos listos",
        ToastAndroid.SHORT,
      );
    } finally {
      setLoadingReadyItems(false);
    }
  }, [user]);

  // Función para cargar mesas con pago pendiente (solo para mozos)
  const loadPendingPaymentTables = useCallback(async () => {
    if (!user || user.position_code !== "mozo") {
      return;
    }

    try {
      setLoadingPaymentTables(true);
      const tables = await getWaiterPendingPayments();
      setPendingPaymentTables(tables || []);
    } catch (error: any) {
      // Solo mostrar error si es un error real de red/servidor, no cuando simplemente no hay mesas
      console.warn("Error loading pending payment tables:", error);
      // No mostrar toast para errores silenciosos
      if (
        error.message &&
        !error.message.includes("No hay") &&
        !error.message.includes("no encontr")
      ) {
        ToastAndroid.show(
          "Error al cargar información de pagos",
          ToastAndroid.SHORT,
        );
      }
    } finally {
      setLoadingPaymentTables(false);
    }
  }, [user]);

  // Función para obtener información del mozo (para clientes en confirm_pending)
  const loadWaiterInfo = useCallback(async () => {
    console.log("🔍 loadWaiterInfo iniciado");

    if (!user || user.position_code) {
      console.log(
        "❌ loadWaiterInfo - Usuario no válido o tiene position_code",
      );
      return;
    }

    try {
      // Obtener información de la mesa actual del cliente
      const response = await api.get("/tables/my-status");

      if (
        response.data.status === "confirm_pending" &&
        response.data.table?.id
      ) {
        // Si ya tenemos el id_waiter en la respuesta de my-status, usarlo directamente
        if (response.data.table.id_waiter) {
          // Obtener información del mozo directamente
          const waiterResponse = await api.get(
            `/users/${response.data.table.id_waiter}`,
          );

          if (waiterResponse.data.success) {
            setWaiterInfo(waiterResponse.data.data);
          }
        } else {
          console.log("❌ Mesa no tiene mozo asignado");
        }
      } else {
        console.log(
          "❌ Cliente no está en confirm_pending o no tiene table.id",
        );
        setWaiterInfo(null);
      }
    } catch (error: any) {
      console.error("❌ Error loading waiter info:", error);
      setWaiterInfo(null);
    }
  }, [user]);

  // Cargar items listos y pagos pendientes para mozos
  useEffect(() => {
    if (user && user.position_code === "mozo") {
      loadReadyItems();
      loadPendingPaymentTables();
    }
  }, [user, loadReadyItems, loadPendingPaymentTables]);

  // Escuchar parámetros de navegación para refrescar cuando sea necesario
  useEffect(() => {
    if (route.params?.refresh && user && token) {
      setTimeout(() => {
        checkWaitingListStatus();
        // Triggear refresh del cliente
        setClientRefreshTrigger(prev => prev + 1);
      }, 300);
    }
  }, [route.params?.refresh, user, token, checkWaitingListStatus]);

  // Refrescar items ready y pagos pendientes cada 30 segundos para mozos
  useEffect(() => {
    if (user?.position_code !== "mozo") return;

    const interval = setInterval(() => {
      loadReadyItems();
      loadPendingPaymentTables();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, loadReadyItems, loadPendingPaymentTables]);

  const handleNavigate = (screenName: string, params?: any) => {
    navigation.navigate(screenName as any, params);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleOpenCart = () => {
    if (isCliente) {
      setActiveTab("cart");
    }
    setCartModalVisible(true);
  };

  const handleCloseCart = () => {
    setCartModalVisible(false);
    if (isCliente && activeTab === "cart") {
      setActiveTab("home"); // Volver a home cuando se cierre el cart
    }
  };

  const handleClientRefresh = () => {
    setClientRefreshTrigger(prev => prev + 1);
  };

  // Función para manejar pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refrescar estado del cliente
      await checkWaitingListStatus();

      // Refrescar items ready y pagos pendientes si es mozo
      if (user?.position_code === "mozo") {
        await loadReadyItems();
        await loadPendingPaymentTables();
      }

      // Refrescar usuarios pendientes si es dueño/supervisor
      if (user && ["dueno", "supervisor"].includes(user.profile_code)) {
        await loadPendingUsers();
      }

      // Triggear refresh del cliente
      setClientRefreshTrigger(prev => prev + 1);

      ToastAndroid.show("Estado actualizado", ToastAndroid.SHORT);
    } catch (error) {
      console.error("Error al refrescar:", error);
    } finally {
      setRefreshing(false);
    }
  }, [checkWaitingListStatus, loadReadyItems, user]);

  // Función para cargar usuarios pendientes (dueño/supervisor)
  const loadPendingUsers = useCallback(async () => {
    if (!user || !["dueno", "supervisor"].includes(user.profile_code)) return;

    try {
      setLoadingPendingUsers(true);
      const response = await api.get("/admin/clients?state=pendiente");
      setPendingUsers(response.data || []);
    } catch (error) {
      console.error("Error cargando usuarios pendientes:", error);
    } finally {
      setLoadingPendingUsers(false);
    }
  }, [user]);

  // Función para aprobar usuario
  const approveUser = async (userId: string, userName: string) => {
    try {
      await api.post(`/admin/clients/${userId}/approve`);
      ToastAndroid.show(`✅ Usuario ${userName} aprobado`, ToastAndroid.SHORT);
      await loadPendingUsers(); // Recargar lista
    } catch (error: any) {
      console.error("Error aprobando usuario:", error);
      ToastAndroid.show(
        error.response?.data?.error || "Error al aprobar usuario",
        ToastAndroid.SHORT,
      );
    }
  };

  // Función para rechazar usuario
  const rejectUser = async (
    userId: string,
    userName: string,
    reason?: string,
  ) => {
    try {
      const response = await api.post(`/admin/clients/${userId}/reject`, {
        reason: reason || "",
      });

      console.log("✅ [FRONTEND] Respuesta recibida:", response.data);
      ToastAndroid.show(`❌ Usuario ${userName} rechazado`, ToastAndroid.SHORT);
      await loadPendingUsers(); // Recargar lista
    } catch (error: any) {
      console.error("❌ [FRONTEND] Error rechazando usuario:", error);
      console.error("❌ [FRONTEND] Detalles del error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        },
      });
      ToastAndroid.show(
        error.response?.data?.error || "Error al rechazar usuario",
        ToastAndroid.SHORT,
      );
    }
  };

  // Cargar usuarios pendientes para dueño/supervisor
  useEffect(() => {
    if (user && ["dueno", "supervisor"].includes(user.profile_code)) {
      loadPendingUsers();
    }
  }, [user, loadPendingUsers]);

  // Cargar información del mozo para clientes en confirm_pending
  useEffect(() => {
    if (
      user &&
      !user.position_code &&
      waitingListStatus === "confirm_pending"
    ) {
      loadWaiterInfo();
    } else if (waitingListStatus !== "confirm_pending") {
      setWaiterInfo(null);
    }
  }, [user, waitingListStatus, loadWaiterInfo]);

  // Función para manejar el escaneo exitoso del QR de la mesa
  const handleOrderStatusQRScan = async (tableId: string) => {
    if (!user || user.position_code) {
      ToastAndroid.show(
        "Esta función es solo para clientes",
        ToastAndroid.SHORT,
      );
      return;
    }

    try {
      // Verificar que el QR escaneado corresponda a la mesa del cliente
      const response = await api.get("/tables/my-table");

      if (!response.data.hasOccupiedTable) {
        ToastAndroid.show(
          "No tienes una mesa ocupada actualmente",
          ToastAndroid.LONG,
        );
        return;
      }

      const myTableNumber = response.data.table.number.toString();
      const myTableId = response.data.table.id.toString();

      // El QR puede contener el number o el id de la mesa, verificamos ambos
      if (tableId !== myTableNumber && tableId !== myTableId) {
        ToastAndroid.show(
          `Este QR no corresponde a tu mesa. Tu mesa es la #${response.data.table.number}`,
          ToastAndroid.LONG,
        );
        return;
      }

      // Si el QR es correcto, abrir el CartModal
      setCartModalVisible(true);
      ToastAndroid.show(
        "✅ Mesa verificada - Consultando tus productos...",
        ToastAndroid.SHORT,
      );
    } catch (error: any) {
      console.error("Error validando mesa:", error);

      let errorMessage = "Error verificando tu mesa";
      if (error.response?.status === 401) {
        errorMessage = "Debes iniciar sesión para usar esta función";
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      ToastAndroid.show(errorMessage, ToastAndroid.LONG);
    }
  };

  const navigateToQRScanner = () => {
    navigation.navigate("QRScanner", {
      mode: "order_status",
      onScanSuccess: handleOrderStatusQRScan,
    });
  };

  // Funciones para el BottomNavbar de clientes
  const handleBottomNavHome = () => {
    setActiveTab("home");
    // Ya estamos en Home, solo cambiar tab
  };

  const handleBottomNavMenu = () => {
    setActiveTab("menu");
    navigation.navigate("Menu");
  };

  const handleBottomNavQR = () => {
    // Si el cliente tiene una mesa asignada pero no está sentado, escanear para confirmar llegada
    if (clientState === "assigned") {
      navigation.navigate("ScanTableQR");
    } else {
      // Para otros estados, usar el escáner general
      navigateToQRScanner();
    }
  };

  const handleBottomNavCart = () => {
    setActiveTab("cart");
    setCartModalVisible(true);
  };

  const handleBottomNavSidebar = () => {
    setSidebarVisible(true);
  };

  const loadDishesMenu = () => {
    // Navegar directamente a la pantalla de menú de platos
    handleNavigate("KitchenMenu");
  };

  const loadDrinksMenu = () => {
    // Navegar directamente a la pantalla de menú de bebidas
    handleNavigate("BarMenu");
  };

  // Función para marcar item como entregado
  const handleDeliverItem = async (itemId: string, itemName: string) => {
    try {
      ToastAndroid.show(`📋 Entregando "${itemName}"...`, ToastAndroid.SHORT);

      setDeliveringItems(prev => new Set([...prev, itemId]));

      await api.put(`/orders/waiter/item/${itemId}/delivered`);

      ToastAndroid.show(
        "✅ Producto marcado como entregado",
        ToastAndroid.SHORT,
      );

      // Recargar la lista de items listos y pagos pendientes
      await loadReadyItems();
      await loadPendingPaymentTables();
    } catch (error: any) {
      console.error("Error delivering item:", error);
      ToastAndroid.show(
        error.response?.data?.error || "Error al marcar como entregado",
        ToastAndroid.SHORT,
      );
    } finally {
      setDeliveringItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // Función para entregar todos los items de una mesa
  const handleDeliverAllItems = async (
    tableId: string,
    items: any[],
    customerName: string,
    tableNumber: string,
  ) => {
    try {
      setDeliveringTables(prev => new Set([...prev, tableId]));

      // Entregar todos los items de la mesa
      for (const item of items) {
        await api.put(`/orders/waiter/item/${item.id}/delivered`);
      }

      // Mostrar confirmación con ChefLoading por 2 segundos
      setTimeout(() => {
        setDeliveringTables(prev => {
          const newSet = new Set(prev);
          newSet.delete(tableId);
          return newSet;
        });
        ToastAndroid.show(
          `✅ Pedido completo entregado - Mesa ${tableNumber}`,
          ToastAndroid.SHORT,
        );
      }, 2000);

      // Recargar la lista de items listos y pagos pendientes
      await loadReadyItems();
      await loadPendingPaymentTables();
    } catch (error: any) {
      console.error("Error delivering all items:", error);
      setDeliveringTables(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableId);
        return newSet;
      });
      ToastAndroid.show(
        error.response?.data?.error || "Error al entregar pedido completo",
        ToastAndroid.SHORT,
      );
    }
  };

  // Función para confirmar pago de una mesa
  const handleConfirmPayment = async (
    tableId: string,
    tableName: string,
    customerName: string,
  ) => {
    try {
      setConfirmingPayments(prev => new Set([...prev, tableId]));

      await confirmPayment(tableId);

      // Mostrar confirmación con ChefLoading por 2 segundos
      setTimeout(() => {
        setConfirmingPayments(prev => {
          const newSet = new Set(prev);
          newSet.delete(tableId);
          return newSet;
        });
        ToastAndroid.show(
          "✅ Pago confirmado y mesa liberada",
          ToastAndroid.SHORT,
        );
      }, 2000);

      // Recargar las listas
      await loadReadyItems();
      await loadPendingPaymentTables();
    } catch (error: any) {
      console.error("Error confirmando pago:", error);
      setConfirmingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableId);
        return newSet;
      });
      ToastAndroid.show(
        error.message || "Error al confirmar pago",
        ToastAndroid.SHORT,
      );
    }
  };

  const isCliente =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

  // Efecto para resetear activeTab cuando se vuelve a Home
  useFocusEffect(
    useCallback(() => {
      if (isCliente) {
        setActiveTab("home");
      }
    }, [isCliente]),
  );

  const getProfileLabel = (profileCode: string, positionCode?: string) => {
    const profileLabels: { [key: string]: string } = {
      dueno: "Dueño",
      supervisor: "Supervisor",
      empleado: "Empleado",
      cliente_registrado: "Cliente Registrado",
      cliente_anonimo: "Cliente Anónimo",
    };

    const positionLabels: { [key: string]: string } = {
      cocinero: "Cocinero",
      bartender: "Bartender",
      maitre: "Maître",
      mozo: "Mozo",
    };

    let label = profileLabels[profileCode] || profileCode;
    if (positionCode && positionLabels[positionCode]) {
      label += ` - ${positionLabels[positionCode]}`;
    }
    return label;
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ChefLoading size="large" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <View className="px-6 pt-8 pb-8 flex-1">
        {/* Header con menú hamburguesa - Solo para empleados */}
        {!isCliente && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <View>
              <Text style={{ color: "white", fontSize: 24, fontWeight: "600" }}>
                TheLastDance
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 14 }}>
                {user ? `¡Hola, ${user.first_name}!` : "Bienvenido"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setSidebarVisible(true)}
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Menu size={24} color="#d4af37" />
            </TouchableOpacity>
          </View>
        )}

        {/* Header simple para clientes */}
        {isCliente && (
          <View style={{ marginBottom: 24, alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "600" }}>
              TheLastDance
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 14 }}>
              {user ? `¡Hola, ${user.first_name}!` : "Bienvenido"}
            </Text>
          </View>
        )}

        {/* Contenido principal basado en rol */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: isCliente ? 100 : 20, // Más padding para clientes por el navbar
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#d4af37"]}
              tintColor="#d4af37"
            />
          }
        >
          {isCliente ? (
            <View>
              {/* Card del usuario */}
              <UserProfileCard user={user!} getProfileLabel={getProfileLabel} />

              <ClientFlowNavigation
                onRefresh={handleClientRefresh}
                refreshTrigger={clientRefreshTrigger}
              />

              {/* Card del mozo cuando el pago está pendiente de confirmación */}
              {(() => {
                return null;
              })()}

              {waitingListStatus === "confirm_pending" && waiterInfo && (
                <View
                  style={{
                    backgroundColor: "rgba(251, 191, 36, 0.1)",
                    borderRadius: 16,
                    padding: 20,
                    marginTop: 16,
                    borderWidth: 1,
                    borderColor: "rgba(251, 191, 36, 0.3)",
                    alignItems: "center",
                  }}
                >
                  {/* Foto circular del mozo */}
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: "#f59e0b",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                      borderWidth: 3,
                      borderColor: "#fbbf24",
                    }}
                  >
                    {waiterInfo.profile_image ? (
                      <Image
                        source={{ uri: waiterInfo.profile_image }}
                        style={{
                          width: 74,
                          height: 74,
                          borderRadius: 37,
                        }}
                      />
                    ) : (
                      <UserIcon size={40} color="white" />
                    )}
                  </View>

                  {/* Nombre del mozo */}
                  <Text
                    style={{
                      color: "#fbbf24",
                      fontSize: 18,
                      fontWeight: "700",
                      marginBottom: 4,
                      textAlign: "center",
                    }}
                  >
                    {waiterInfo.first_name} {waiterInfo.last_name}
                  </Text>

                  {/* Mensaje de espera */}
                  <Text
                    style={{
                      color: "white",
                      fontSize: 16,
                      fontWeight: "600",
                      marginBottom: 8,
                      textAlign: "center",
                    }}
                  >
                    Esperando confirmación del mozo
                  </Text>

                  {/* Mensaje descriptivo */}
                  <Text
                    style={{
                      color: "#ccc",
                      fontSize: 14,
                      textAlign: "center",
                      lineHeight: 20,
                    }}
                  >
                    Tu pago fue procesado exitosamente. El mozo confirmará la
                    recepción y liberará tu mesa en breve.
                  </Text>

                  {/* Indicador de carga animado */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 12,
                    }}
                  >
                    <ChefLoading size="small" />
                    <Text
                      style={{
                        color: "#fbbf24",
                        fontSize: 14, // Aumentado de 12 a 14
                        marginLeft: 8,
                      }}
                    >
                      Procesando...
                    </Text>
                  </View>
                </View>
              )}

              {/* Info sobre el sidebar para clientes */}
              <View
                style={{
                  backgroundColor: "rgba(212, 175, 55, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(212, 175, 55, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: "#d4af37",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  💡 Consejo
                </Text>
                <Text style={{ color: "white", fontSize: 14, lineHeight: 18 }}>
                  También puedes acceder a estas funciones desde el menú lateral
                  (☰) según tu estado actual
                </Text>
              </View>
            </View>
          ) : user?.position_code === "cocinero" ? (
            <View>
              {/* Card del usuario */}
              <UserProfileCard user={user!} getProfileLabel={getProfileLabel} />

              {/* Panel de acceso rápido para cocinero */}
              <ActionCard
                title="Panel de Cocina"
                description="Ver pedidos pendientes y actualizar el estado de preparación"
                icon={UtensilsCrossed}
                onPress={() => handleNavigate("KitchenDashboard")}
              />

              {/* Acceso a crear platos */}
              <ActionCard
                title="Agregar plato al menú"
                description="Crear nuevos platos para el restaurante"
                icon={Hamburger}
                onPress={() =>
                  handleNavigate("CreateMenuItem", { initialCategory: "plato" })
                }
              />

              {/* Ver menú de platos */}
              <ActionCard
                title="Ver menú de platos"
                description="Consultar todos los platos del menú"
                icon={BookOpen}
                onPress={loadDishesMenu}
              />

              {/* Info adicional para cocineros */}
              <View
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(59, 130, 246, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: "#3b82f6",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  ℹ️ Información
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  Los pedidos aparecen aquí cuando los mozos los aprueban. Solo
                  verás productos de categoría "plato"
                </Text>
              </View>
            </View>
          ) : user?.position_code === "bartender" ? (
            <View>
              {/* Card del usuario */}
              <UserProfileCard user={user!} getProfileLabel={getProfileLabel} />

              {/* Panel de acceso rápido para bartender */}
              <ActionCard
                title="Panel de Bar"
                description="Ver bebidas pendientes y actualizar el estado de preparación"
                icon={Wine}
                onPress={() => handleNavigate("BartenderDashboard")}
              />

              {/* Acceso a crear bebidas */}
              <ActionCard
                variant="secondary"
                title="Agregar bebida al menú"
                description="Crear nuevas bebidas para el restaurante"
                icon={BottleWine}
                onPress={() =>
                  handleNavigate("CreateMenuItem", {
                    initialCategory: "bebida",
                  })
                }
                style={{ marginBottom: 12 }}
              />

              {/* Ver menú de bebidas */}
              <ActionCard
                variant="secondary"
                title="Ver menú de bebidas"
                description="Consultar todas las bebidas del menú"
                icon={BookOpen}
                onPress={loadDrinksMenu}
              />

              {/* Info adicional para bartenders */}
              <View
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(59, 130, 246, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: "#3b82f6",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  ℹ️ Información
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  Los pedidos aparecen aquí cuando los mozos los aprueban. Solo
                  verás productos de categoría "bebida"
                </Text>
              </View>
            </View>
          ) : user?.position_code === "maitre" ? (
            <View>
              {/* Card del usuario */}
              <UserProfileCard user={user!} getProfileLabel={getProfileLabel} />

              {/* Gestión de lista de espera */}
              <ActionCard
                title="📋 Gestionar Lista de Espera"
                description="Administrar reservas y asignación de mesas"
                icon={Users}
                onPress={() => handleNavigate("ManageWaitingList")}
              />

              {/* Generar QR */}
              <ActionCard
                title="📱 Generar Código QR"
                description="Crear QR para que clientes se unan a la lista"
                icon={QrCode}
                onPress={() => handleNavigate("GenerateWaitingListQR")}
              />

              {/* Info adicional para maître */}
              <View
                style={{
                  backgroundColor: "rgba(168, 85, 247, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(168, 85, 247, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: "#a855f7",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  ℹ️ Información
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  Como maître, gestionas el flujo de clientes, asignas mesas y
                  coordinas la experiencia del cliente desde su llegada.
                </Text>
              </View>
            </View>
          ) : user?.position_code === "mozo" ? (
            <View>
              {/* Card del usuario */}
              <UserProfileCard user={user!} getProfileLabel={getProfileLabel} />

              {/* Lista de mesas con items ready */}
              {readyItems.length > 0 && (
                <View
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <Text
                    style={{
                      color: "#10b981",
                      fontSize: 16,
                      fontWeight: "600",
                      marginBottom: 12,
                    }}
                  >
                    � Mesas con pedidos listos
                  </Text>

                  <View>
                    {readyItems.map(table => (
                      <View
                        key={table.table_id}
                        style={{
                          backgroundColor: "#1a1a1a",
                          borderRadius: 8,
                          padding: 16,
                          marginBottom: 12,
                          borderLeftWidth: 4,
                          borderLeftColor: "#10b981",
                        }}
                      >
                        {/* Header de la mesa */}
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: "#d4af37",
                              fontSize: 18,
                              fontWeight: "700",
                            }}
                          >
                            Mesa #{table.table_number}
                          </Text>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={{ color: "#999", fontSize: 14 }}>
                              {table.customer_name}
                            </Text>
                            <Text style={{ color: "#10b981", fontSize: 12 }}>
                              {table.items.length} item
                              {table.items.length === 1 ? "" : "s"} listo
                              {table.items.length === 1 ? "" : "s"}
                            </Text>
                          </View>
                        </View>

                        {/* Botón entregar todo (solo si hay más de un item) */}
                        {table.items.length > 1 && (
                          <TouchableOpacity
                            onPress={async () =>
                              await handleDeliverAllItems(
                                table.table_id,
                                table.items,
                                table.customer_name,
                                table.table_number.toString(),
                              )
                            }
                            disabled={deliveringTables.has(table.table_id)}
                            style={{
                              backgroundColor: deliveringTables.has(
                                table.table_id,
                              )
                                ? "#10b981aa"
                                : "#10b981",
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              borderRadius: 8,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              marginBottom: 12,
                              opacity: deliveringTables.has(table.table_id)
                                ? 0.7
                                : 1,
                            }}
                          >
                            {deliveringTables.has(table.table_id) ? (
                              <ChefLoading size="small" />
                            ) : (
                              <>
                                <CheckCircle size={18} color="white" />
                                <Text
                                  style={{
                                    color: "white",
                                    fontSize: 14,
                                    marginLeft: 8,
                                    fontWeight: "600",
                                  }}
                                >
                                  Entregar Todo
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}

                        {/* Lista de items de la mesa */}
                        {table.items.map((item: any, index: number) => (
                          <View
                            key={item.id}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              paddingVertical: 12,
                              borderTopWidth: index > 0 ? 1 : 0,
                              borderTopColor: "#333",
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 12 }}>
                              <Text
                                style={{
                                  color: "white",
                                  fontSize: 15,
                                  fontWeight: "600",
                                  marginBottom: 4,
                                }}
                              >
                                {item.menu_item.name}
                              </Text>
                              <Text
                                style={{
                                  color: "#999",
                                  fontSize: 13,
                                  marginBottom: 2,
                                }}
                              >
                                {item.menu_item.description}
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#d4af37",
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  Cantidad: {item.quantity}
                                </Text>
                                <Text
                                  style={{
                                    color: "#666",
                                    fontSize: 11,
                                    marginLeft: 8,
                                    backgroundColor: "#333",
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                  }}
                                >
                                  {item.menu_item.category}
                                </Text>
                              </View>
                            </View>

                            {/* Botón entregar */}
                            <TouchableOpacity
                              onPress={async () =>
                                await handleDeliverItem(
                                  item.id,
                                  item.menu_item.name,
                                )
                              }
                              disabled={deliveringItems.has(item.id)}
                              style={{
                                backgroundColor: "#10b981",
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 8,
                                flexDirection: "row",
                                alignItems: "center",
                                opacity: deliveringItems.has(item.id) ? 0.7 : 1,
                                minWidth: 90,
                                justifyContent: "center",
                              }}
                            >
                              {deliveringItems.has(item.id) ? (
                                <ChefLoading size="small" />
                              ) : (
                                <>
                                  <CheckCircle size={16} color="white" />
                                  <Text
                                    style={{
                                      color: "white",
                                      fontSize: 13,
                                      marginLeft: 6,
                                      fontWeight: "600",
                                    }}
                                  >
                                    Entregar
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Lista de mesas con pago pendiente de confirmación */}
              {pendingPaymentTables.length > 0 && (
                <View
                  style={{
                    backgroundColor: "rgba(251, 191, 36, 0.1)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "rgba(251, 191, 36, 0.3)",
                  }}
                >
                  <Text
                    style={{
                      color: "#fbbf24",
                      fontSize: 16,
                      fontWeight: "600",
                      marginBottom: 12,
                    }}
                  >
                    💰 Pagos pendientes de confirmación
                  </Text>

                  <View>
                    {pendingPaymentTables.map(table => (
                      <View
                        key={table.table_id}
                        style={{
                          backgroundColor: "#1a1a1a",
                          borderRadius: 8,
                          padding: 16,
                          marginBottom: 12,
                          borderLeftWidth: 4,
                          borderLeftColor: "#fbbf24",
                        }}
                      >
                        {/* Monto total del pedido */}
                        <View
                          style={{
                            alignItems: "flex-end",
                            marginBottom: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: "#fbbf24",
                              fontSize: 16,
                              fontWeight: "700",
                            }}
                          >
                            Total: ${table.total_amount || 0}
                          </Text>
                        </View>

                        {/* Header de la mesa */}
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
                          <View>
                            <Text
                              style={{
                                color: "#fbbf24",
                                fontSize: 18,
                                fontWeight: "700",
                              }}
                            >
                              Mesa #{table.table_number}
                            </Text>
                            <Text
                              style={{
                                color: "#ccc",
                                fontSize: 14,
                                marginTop: 2,
                              }}
                            >
                              {table.customer_name}
                            </Text>
                          </View>

                          {/* Botón confirmar pago */}
                          <TouchableOpacity
                            onPress={async () =>
                              await handleConfirmPayment(
                                table.table_id,
                                table.table_number.toString(),
                                table.customer_name,
                              )
                            }
                            disabled={confirmingPayments.has(table.table_id)}
                            style={{
                              backgroundColor: confirmingPayments.has(
                                table.table_id,
                              )
                                ? "#fbbf24aa"
                                : "#fbbf24",
                              paddingHorizontal: 20,
                              paddingVertical: 12,
                              borderRadius: 8,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 80,
                            }}
                          >
                            {confirmingPayments.has(table.table_id) ? (
                              <ChefLoading size="small" />
                            ) : (
                              <CheckCircle size={18} color="white" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Otros accesos del mozo */}
              <ActionCard
                title="📋 Panel del Mesero"
                description="Gestionar tus mesas asignadas"
                icon={Clock}
                onPress={() => handleNavigate("WaiterDashboard")}
              />

              {/* Info para mozos */}
              <View
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(16, 185, 129, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: "#10b981",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  ℹ️ Información
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  Los items aparecen aquí cuando la cocina/bar los marca como
                  "listos". Solo verás items de tus mesas asignadas. Presiona
                  "Entregar" cuando le des el plato al cliente.
                </Text>
              </View>
            </View>
          ) : user?.profile_code === "dueno" ||
            user?.profile_code === "supervisor" ? (
            <View>
              {/* Card del usuario */}
              <UserProfileCard user={user!} getProfileLabel={getProfileLabel} />

              {/* Usuarios Pendientes */}
              {loadingPendingUsers ? (
                <View
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                    alignItems: "center",
                  }}
                >
                  <ChefLoading
                    size="small"
                    text="Cargando usuarios pendientes..."
                  />
                </View>
              ) : pendingUsers.length > 0 ? (
                <View
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <Users size={20} color="#d4af37" />
                    <Text
                      style={{
                        color: "#d4af37",
                        fontSize: 16,
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      Usuarios Pendientes ({pendingUsers.length})
                    </Text>
                  </View>

                  {pendingUsers.map((pendingUser: any, index: number) => (
                    <View
                      key={pendingUser.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 12,
                        borderTopWidth: index > 0 ? 1 : 0,
                        borderTopColor: "#333",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "white",
                            fontSize: 15,
                            fontWeight: "600",
                            marginBottom: 2,
                          }}
                        >
                          {pendingUser.first_name} {pendingUser.last_name}
                        </Text>
                        <Text
                          style={{
                            color: "#999",
                            fontSize: 12,
                          }}
                        >
                          {new Date(
                            pendingUser.created_at,
                          ).toLocaleDateString()}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() =>
                            approveUser(
                              pendingUser.id,
                              `${pendingUser.first_name} ${pendingUser.last_name}`,
                            )
                          }
                          style={{
                            backgroundColor: "#22c55e",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              color: "white",
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            ✓ Aprobar
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              "Rechazar Usuario",
                              `¿Estás seguro de que quieres rechazar a ${pendingUser.first_name} ${pendingUser.last_name}?`,
                              [
                                { text: "Cancelar", style: "cancel" },
                                {
                                  text: "Rechazar sin motivo",
                                  style: "destructive",
                                  onPress: () =>
                                    rejectUser(
                                      pendingUser.id,
                                      `${pendingUser.first_name} ${pendingUser.last_name}`,
                                      "",
                                    ),
                                },
                                {
                                  text: "Rechazar con motivo",
                                  style: "destructive",
                                  onPress: () =>
                                    rejectUser(
                                      pendingUser.id,
                                      `${pendingUser.first_name} ${pendingUser.last_name}`,
                                      "Información incompleta o incorrecta",
                                    ),
                                },
                              ],
                            );
                          }}
                          style={{
                            backgroundColor: "#ef4444",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              color: "white",
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            ✕ Rechazar
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    alignItems: "center",
                  }}
                >
                  <CheckCircle size={24} color="#22c55e" />
                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 14,
                      fontWeight: "600",
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    ✨ No hay usuarios pendientes
                  </Text>
                  <Text
                    style={{
                      color: "white",
                      fontSize: 12,
                      marginTop: 4,
                      textAlign: "center",
                      opacity: 0.8,
                    }}
                  ></Text>
                </View>
              )}

              {/* Cards de Acciones Principales */}
              <ActionCard
                title={
                  user?.profile_code === "dueno"
                    ? "👥 Añadir Personal"
                    : "👤 Añadir Empleado"
                }
                description={
                  user?.profile_code === "dueno"
                    ? "Crear empleados y supervisores"
                    : "Crear nuevos empleados"
                }
                icon={UserIcon}
                onPress={() =>
                  handleNavigate("AddStaff", { userRole: user?.profile_code })
                }
              />

              <ActionCard
                title="🪑 Crear Mesa"
                description="Agregar nueva mesa al restaurante"
                icon={QrCode}
                onPress={() => handleNavigate("CreateTable")}
              />

              <ActionCard
                title="👨‍💼 Distribución de Meseros"
                description="Supervisar meseros y sus mesas asignadas"
                icon={Users}
                onPress={() => handleNavigate("AllWaiters")}
              />

              {/* Info adicional */}
              <View
                style={{
                  backgroundColor: "rgba(212, 175, 55, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "rgba(212, 175, 55, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: "#d4af37",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  💼 Panel de Administración
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  Desde aquí puedes gestionar todo el restaurante: aprobar
                  usuarios, crear personal, configurar mesas y supervisar el
                  equipo de trabajo.
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </ScrollView>
      </View>

      {/* Sidebar */}
      <Sidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        user={user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onOpenCart={handleOpenCart}
      />

      {/* Cart Modal */}
      <CartModal visible={cartModalVisible} onClose={handleCloseCart} />

      {/* Modal del Menú */}
      <Modal
        visible={showMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMenu(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.8)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "90%",
              maxHeight: "80%",
              backgroundColor: "#1a1a1a",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#333",
            }}
          >
            {/* Header del Modal */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: "#333",
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#ffffff",
                }}
              >
                Menú de {menuType === "platos" ? "Platos" : "Bebidas"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowMenu(false)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#333",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Lista del Menú */}
            <FlatList
              data={menuItems}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <View
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: "#333",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#ffffff",
                      marginBottom: 4,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#999",
                      marginBottom: 8,
                    }}
                  >
                    {item.description}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: "#d4af37",
                      }}
                    >
                      ${item.price}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#666",
                        backgroundColor: "#333",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 4,
                      }}
                    >
                      {item.category}
                    </Text>
                  </View>
                </View>
              )}
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View
                  style={{
                    padding: 40,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#999",
                      fontSize: 16,
                      textAlign: "center",
                    }}
                  >
                    No hay {menuType} disponibles en el menú
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* BottomNavbar para clientes */}
      {isCliente && (
        <BottomNavbar
          onNavigateHome={handleBottomNavHome}
          onNavigateMenu={handleBottomNavMenu}
          onScanQR={handleBottomNavQR}
          onOpenCart={handleBottomNavCart}
          onOpenSidebar={handleBottomNavSidebar}
          activeTab={activeTab}
        />
      )}

      <CartModal visible={cartModalVisible} onClose={handleCloseCart} />
    </LinearGradient>
  );
}
