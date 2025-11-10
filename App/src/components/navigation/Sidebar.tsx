import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  LogOut,
  Users,
  QrCode,
  User as UserIcon,
  X,
  Clock,
  CheckCircle,
  MapPin,
  RefreshCcw,
  AlertCircle,
  MessageCircle,
  UtensilsCrossed,
  Wine,
  Gamepad2,
} from "lucide-react-native";
import { User } from "../../types/User";
import { useClientState } from "../../Hooks/useClientState";
import { useCart } from "../../context/CartContext";
import { getAnonymousOrderData } from "../../api/orders";

const { width } = Dimensions.get("window");
const SIDEBAR_WIDTH = width * 0.85;

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  user: User | null;
  onLogout: () => void;
  onNavigate: (screen: string, params?: any) => void;
  onOpenCart?: () => void; // Nueva prop para abrir el carrito
}

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  roles: string[];
  positions?: string[];
}

export default function Sidebar({ visible, onClose, user, onLogout, onNavigate, onOpenCart }: SidebarProps) {
  const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  
  // Solo usar el hook si el usuario es cliente
  const isClient = user?.profile_code === "cliente_registrado" || user?.profile_code === "cliente_anonimo";
  const clientState = useClientState();
  
  // Hook del carrito para obtener información de items
  const { cartCount, pendingOrderCount, hasPendingOrder } = useCart();
  
  // Estado para verificar si usuario anónimo tiene pedido pagado
  const [hasAnonymousPaidOrder, setHasAnonymousPaidOrder] = React.useState(false);
  
  // Extraer datos del cliente si corresponde
  const { state, waitingPosition, assignedTable, occupiedTable, refresh } = isClient ? clientState : {
    state: null,
    waitingPosition: null,
    assignedTable: null,
    occupiedTable: null,
    refresh: () => {}
  };

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Verificar si usuario anónimo tiene pedido pagado cuando se abre el sidebar
  React.useEffect(() => {
    if (visible && user?.profile_code === "cliente_anonimo") {
      getAnonymousOrderData()
        .then(result => setHasAnonymousPaidOrder(result.hasOrder))
        .catch(() => setHasAnonymousPaidOrder(false));
    }
  }, [visible, user?.profile_code]);

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

  const getProfileColor = (profileCode: string) => {
    const colors: { [key: string]: string } = {
      dueno: "#430fa6",
      supervisor: "#ea580c",
      empleado: "#2563eb",
      cliente_registrado: "#16a34a",
      cliente_anonimo: "#6b7280",
    };
    return colors[profileCode] || "#6b7280";
  };

  const IMGS = {
    newStaff: require("../../../assets/new-staff.png"),
    churrasco: require("../../../assets/churrasco.png"),
    fernet: require("../../../assets/fernet.png"),
    mesa: require("../../../assets/mesa-circular.png"),
    user_pending: require("../../../assets/user-pending.png"),
    mozo: require("../../../assets/mozo.png"),
  };

  const actionItems: ActionItem[] = [
    // Maître
    {
      id: "manage-waiting-list",
      title: "Gestionar Lista de Espera",
      subtitle: "Administrá las reservas y asignación de mesas",
      icon: <Users size={20} color="#374151" />,
      onPress: () => onNavigate("ManageWaitingList"),
      roles: ["empleado"],
      positions: ["maitre"],
    },
    {
      id: "generate-qr",
      title: "Generar Código QR",
      subtitle: "Crear QR para que clientes se unan a la lista",
      icon: <QrCode size={20} color="#374151" />,
      onPress: () => onNavigate("GenerateWaitingListQR"),
      roles: ["empleado"],
      positions: ["maitre"],
    },

    // Mozo
    {
      id: "waiter-dashboard",
      title: "Panel del Mesero",
      subtitle: "Gestioná tus mesas asignadas (máximo 3)",
      icon: <Image source={IMGS.mesa} style={{ width: 20, height: 20 }} />,
      onPress: () => onNavigate("WaiterDashboard"),
      roles: ["empleado"],
      positions: ["mozo"],
    },
  ];

  const getFilteredActions = () => {
    if (!user) return [];
    
    let actions = actionItems.filter(item => {
      const hasRole = item.roles.includes(user.profile_code);
      if (!hasRole) return false;
      
      if (item.positions && user.position_code) {
        return item.positions.includes(user.position_code);
      }
      
      return true;
    });

    // Agregar acciones específicas de cliente según su estado
    if (isClient && state) {
      const clientActions = getClientActions();
      actions = [...actions, ...clientActions];
    }

    return actions;
  };

  const getClientActions = (): ActionItem[] => {
    if (!state) return [];

    const clientActions: ActionItem[] = [];

    switch (state) {
      case "not_in_queue":
        // Para clientes registrados: mostrar "Reservar Mesa" y "Mis Reservas"
        if (user?.profile_code === "cliente_registrado") {
          clientActions.push(
            {
              id: "make-reservation",
              title: "Reservar Mesa",
              subtitle: "Reservá una mesa para una fecha y horario específico",
              icon: <Users size={20} color="#374151" />,
              onPress: () => onNavigate("MakeReservation"),
              roles: ["cliente_registrado"],
            },
            {
              id: "my-reservations",
              title: "Mis Reservas",
              subtitle: "Ver y gestionar tus reservas",
              icon: <Clock size={20} color="#374151" />,
              onPress: () => onNavigate("MyReservations"),
              roles: ["cliente_registrado"],
            }
          );
        }
        // Para clientes anónimos (sin pedido pagado): mantener "Unirse a Lista de Espera"
        else if (user?.profile_code === "cliente_anonimo" && !hasAnonymousPaidOrder) {
          clientActions.push({
            id: "join-queue",
            title: "Unirse a Lista de Espera",
            subtitle: "Escanea el QR para reservar una mesa",
            icon: <Users size={20} color="#374151" />,
            onPress: () => onNavigate("ScanQR"),
            roles: ["cliente_anonimo"],
          });
        }
        break;

      case "in_queue":
        clientActions.push(
          {
            id: "view-position",
            title: "Ver Mi Posición",
            subtitle: `Posición actual: #${waitingPosition || "..."}`,
            icon: <Clock size={20} color="#374151" />,
            onPress: () => onNavigate("MyWaitingPosition"),
            roles: ["cliente_registrado", "cliente_anonimo"],
          },
          {
            id: "refresh-queue",
            title: "Actualizar Estado",
            subtitle: "Verificar cambios en la lista",
            icon: <RefreshCcw size={20} color="#374151" />,
            onPress: () => {
              refresh();
              onClose();
            },
            roles: ["cliente_registrado", "cliente_anonimo"],
          }
        );
        break;

      case "assigned":
        clientActions.push({
          id: "confirm-table",
          title: "Confirmar Llegada",
          subtitle: `Mesa #${assignedTable?.number || "..."} asignada`,
          icon: <QrCode size={20} color="#374151" />,
          onPress: () => onNavigate("ScanTableQR"),
          roles: ["cliente_registrado", "cliente_anonimo"],
        });
        break;

      case "seated":
        // Chat con mesero si hay mesa ocupada
        if (occupiedTable) {
          clientActions.push({
            id: "table-chat",
            title: "Chat con Mesero",
            subtitle: `Mesa #${occupiedTable.number} - Comunícate con tu mesero`,
            icon: <MessageCircle size={20} color="#374151" />,
            onPress: () => onNavigate("TableChat", { tableId: occupiedTable.id }),
            roles: ["cliente_registrado", "cliente_anonimo"],
          });
        }

        // Agregar opción de juegos para clientes sentados
        clientActions.push({
          id: "games",
          title: "Juegos",
          subtitle: "Disfruta mientras esperas tu pedido y gana descuentos",
          icon: <Gamepad2 size={20} color="#374151" />,
          onPress: () => onNavigate("Games"),
          roles: ["cliente_registrado", "cliente_anonimo"],
        });
        break;

      case "displaced":
        clientActions.push(
          {
            id: "new-reservation",
            title: "Nueva Reserva",
            subtitle: "Tu mesa fue liberada, únete nuevamente",
            icon: <Users size={20} color="#374151" />,
            onPress: () => onNavigate("ScanQR"),
            roles: ["cliente_registrado", "cliente_anonimo"],
          },
          {
            id: "refresh-displaced",
            title: "Actualizar Estado",
            subtitle: "Verificar tu situación actual",
            icon: <RefreshCcw size={20} color="#374151" />,
            onPress: () => {
              refresh();
              onClose();
            },
            roles: ["cliente_registrado", "cliente_anonimo"],
          }
        );
        break;

      case "error":
        clientActions.push({
          id: "retry-connection",
          title: "Reintentar Conexión",
          subtitle: "Error de conexión, intenta nuevamente",
          icon: <AlertCircle size={20} color="#ef4444" />,
          onPress: () => {
            refresh();
            onClose();
          },
          roles: ["cliente_registrado", "cliente_anonimo"],
        });
        break;
    }

    return clientActions;
  };

  const getClientStatusDisplay = () => {
    if (!state) return null;

    const getStatusInfo = () => {
      switch (state) {
        case "loading":
          return {
            icon: <RefreshCcw size={20} color="#374151" />,
            title: "Verificando estado...",
            subtitle: "Conectando con el servidor",
            color: "#d4af37"
          };
        case "not_in_queue":
          return {
            icon: <Users size={20} color="#6b7280" />,
            title: "Sin reserva",
            subtitle: "Únete a la lista de espera",
            color: "#6b7280"
          };
        case "in_queue":
          return {
            icon: <Clock size={20} color="#374151" />,
            title: `Posición #${waitingPosition || "..."}`,
            subtitle: "En lista de espera",
            color: "#d4af37"
          };
        case "assigned":
          return {
            icon: <MapPin size={20} color="#22c55e" />,
            title: `Mesa #${assignedTable?.number || "..."}`,
            subtitle: "Mesa asignada - confirma tu llegada",
            color: "#22c55e"
          };
        case "seated":
          return {
            icon: <CheckCircle size={20} color="#22c55e" />,
            title: `Mesa #${occupiedTable?.number || "..."}`,
            subtitle: "Sentado - ¡disfruta tu experiencia!",
            color: "#22c55e"
          };
        case "displaced":
          return {
            icon: <AlertCircle size={20} color="#f59e0b" />,
            title: "Mesa liberada",
            subtitle: "Tu sesión fue interrumpida",
            color: "#f59e0b"
          };
        case "error":
          return {
            icon: <AlertCircle size={20} color="#ef4444" />,
            title: "Error de conexión",
            subtitle: "No se pudo verificar tu estado",
            color: "#ef4444"
          };
        default:
          return {
            icon: <AlertCircle size={20} color="#6b7280" />,
            title: "Estado desconocido",
            subtitle: "Actualiza para verificar",
            color: "#6b7280"
          };
      }
    };

    const statusInfo = getStatusInfo();

    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: `${statusInfo.color}20`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}>
          {statusInfo.icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            {statusInfo.title}
          </Text>
          <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 2 }}>
            {statusInfo.subtitle}
          </Text>
        </View>
      </View>
    );
  };

  const filteredActions = getFilteredActions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Sidebar */}
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: SIDEBAR_WIDTH,
            transform: [{ translateX: slideAnim }],
          }}
        >
          <LinearGradient
            colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View
              style={{
                paddingTop: 50,
                paddingHorizontal: 20,
                paddingBottom: 20,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.1)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "white", fontSize: 22, fontWeight: "600" }}>
                  Menú
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <X size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {/* User Profile */}
            {user && (
              <View style={{ padding: 20 }}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {/* Profile Image */}
                    <View style={{ position: "relative" }}>
                      {user.photo_url ? (
                        <Image
                          source={{ uri: user.photo_url }}
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            resizeMode: "cover",
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: "#6b7280",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <UserIcon size={24} color="#d1d5db" />
                        </View>
                      )}
                      {/* Status Indicator */}
                      <View
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: getProfileColor(user.profile_code),
                          borderWidth: 2,
                          borderColor: "#1a1a1a",
                        }}
                      />
                    </View>

                    {/* User Info */}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>
                        {user.first_name} {user.last_name}
                      </Text>
                      <View
                        style={{
                          backgroundColor: getProfileColor(user.profile_code),
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          marginTop: 4,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ color: "white", fontSize: 12, fontWeight: "500" }}>
                          {getProfileLabel(user.profile_code, user.position_code || undefined)}
                        </Text>
                      </View>
                      {user.email && (
                        <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>
                          {user.email}
                        </Text>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Client Status Section */}
            {isClient && state && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{
                  color: "#9ca3af",
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 12,
                  textTransform: "uppercase",
                }}>
                  Estado actual
                </Text>
                
                <View style={{
                  backgroundColor: "rgba(212, 175, 55, 0.1)",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: "rgba(212, 175, 55, 0.3)",
                }}>
                  {getClientStatusDisplay()}
                </View>
              </View>
            )}

            {/* Actions */}
            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
              <Text style={{
                color: "#9ca3af",
                fontSize: 16,
                fontWeight: "600",
                marginBottom: 12,
                textTransform: "uppercase",
              }}>
                {isClient ? "Acciones disponibles" : "Acciones disponibles"}
              </Text>

              {filteredActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  onPress={() => {
                    action.onPress();
                    onClose();
                  }}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: "#d4af37",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {action.icon}
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
                        {action.title}
                      </Text>
                      <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 2 }}>
                        {action.subtitle}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Espaciado adicional */}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Footer - Logout */}
            <View
              style={{
                padding: 20,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.1)",
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  onLogout();
                  onClose();
                }}
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.3)",
                }}
              >
                <LogOut size={18} color="#ef4444" />
                <Text style={{ color: "#ef4444", marginLeft: 8, fontWeight: "600", fontSize: 16 }}>
                  Cerrar sesión
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}