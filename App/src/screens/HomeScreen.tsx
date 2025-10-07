import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ToastAndroid,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { AuthContext } from "../auth/AuthContext";
import api from "../api/axios";
import {
  Martini,
  UtensilsCrossed,
  LogOut,
  Table,
  Users,
  QrCode,
  Camera,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "../types/User";
import { PlusCircle } from "lucide-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { token, logout } = useContext(AuthContext);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar perfil desde backend (usa el Authorization del interceptor)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!token) return;
        const { data } = await api.get("/auth/validate-token");
        const u: User = data?.user ?? data;
        if (mounted) setUser(u);
      } catch (err: any) {
        ToastAndroid.show("No se pudo cargar tu perfil", ToastAndroid.SHORT);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleLogout = async () => {
    await logout();
  };

  const goCreate = (initialCategory: "plato" | "bebida") => {
    navigation.navigate("CreateMenuItem", { initialCategory });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  const isCocinero = user?.position_code === "cocinero";
  const isBartender = user?.position_code === "bartender";
  const isMaitre = user?.position_code === "maitre";
  const isDueno = user?.profile_code === "dueno";
  const isSupervisor = user?.profile_code === "supervisor";
  const isCliente =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <View className="px-6 pt-14 pb-8 flex-1">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-white text-2xl font-light">
            ¡Hola{user?.first_name ? `, ${user.first_name}` : ""}!
          </Text>
          <Text className="text-gray-400 mt-1">
            {user?.position_code
              ? `Estás logueado como ${user.position_code}`
              : "Bienvenido a Last Dance"}
          </Text>
        </View>

        {/* Acciones por rol */}
        <View className="gap-4">
          {isDueno && (
            <ActionTile
              title="Añadir empleado/supervisor"
              subtitle="Crear nuevos perfiles del equipo"
              onPress={() =>
                navigation.navigate("AddStaff", { userRole: "dueno" })
              }
              icon={<PlusCircle size={26} color="#1a1a1a" />}
            />
          )}

          {isSupervisor && (
            <ActionTile
              title="Añadir empleado"
              subtitle="Crear nuevos empleados del equipo"
              onPress={() =>
                navigation.navigate("AddStaff", { userRole: "supervisor" })
              }
              icon={<PlusCircle size={26} color="#1a1a1a" />}
            />
          )}

          {isCocinero && (
            <ActionTile
              title="Agregar plato"
              subtitle="Publicá un nuevo plato en el menú"
              onPress={() => goCreate("plato")}
              icon={<UtensilsCrossed size={26} color="#1a1a1a" />}
            />
          )}

          {isBartender && (
            <ActionTile
              title="Agregar bebida"
              subtitle="Sumá una nueva bebida al menú"
              onPress={() => goCreate("bebida")}
              icon={<Martini size={26} color="#1a1a1a" />}
            />
          )}

          {(isDueno || isSupervisor) && (
            <ActionTile
              title="Crear mesa"
              subtitle="Agregá una nueva mesa al restaurante"
              onPress={() => navigation.navigate("CreateTable")}
              icon={<Table size={26} color="#1a1a1a" />}
            />
          )}

          {isMaitre && (
            <>
              <ActionTile
                title="Gestionar Lista de Espera"
                subtitle="Administrá las reservas y asignación de mesas"
                onPress={() => navigation.navigate("ManageWaitingList")}
                icon={<Users size={26} color="#1a1a1a" />}
              />
              <ActionTile
                title="Generar Código QR"
                subtitle="Crear QR para que clientes se unan a la lista"
                onPress={() => navigation.navigate("GenerateWaitingListQR")}
                icon={<QrCode size={26} color="#1a1a1a" />}
              />
            </>
          )}

          {isCliente && (
            <>
              <ActionTile
                title="Unirse a Lista de Espera"
                subtitle="Escanea el QR del maitre para hacer tu reserva"
                onPress={() => navigation.navigate("ScanQR")}
                icon={<Camera size={26} color="#1a1a1a" />}
              />
              <ActionTile
                title="Ver Mi Posición"
                subtitle="Consulta tu lugar en la lista de espera"
                onPress={() => navigation.navigate("MyWaitingPosition")}
                icon={<Users size={26} color="#1a1a1a" />}
              />
            </>
          )}

          {isDueno && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Clients")}
              className="flex-row items-center p-4 bg-white/10 rounded-lg mb-4"
            >
              <Text className="text-white text-lg font-medium">
                Gestionar Usuarios Pendientes
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center justify-center rounded-xl h-12 bg-white/10 border border-white/20"
        >
          <LogOut size={18} color="#fff" />
          <Text className="text-white ml-2">Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

/** Tarjeta/CTA simple */
function ActionTile({
  title,
  subtitle,
  onPress,
  icon,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  icon: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-2xl overflow-hidden"
      activeOpacity={0.92}
    >
      <LinearGradient
        colors={["#d4af37", "#b8941f", "#d4af37"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="p-4"
      >
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-xl bg-[#1a1a1a] items-center justify-center">
            {icon}
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[#1a1a1a] text-base font-semibold">
              {title}
            </Text>
            <Text className="text-[#1a1a1a] opacity-80 text-xs">
              {subtitle}
            </Text>
          </View>
          <Text className="text-[#1a1a1a] text-xl">›</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
