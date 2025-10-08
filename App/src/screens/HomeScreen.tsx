import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ToastAndroid,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { AuthContext } from "../auth/AuthContext";
import api from "../api/axios";
import { LogOut, Users, QrCode, User as UserIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "../types/User";
import ClientFlowNavigation from "../components/navigation/ClientFlowNavigation";

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
      dueno: "#430fa6", // aura
      supervisor: "#ea580c", // naranja
      empleado: "#2563eb", // azul
      cliente_registrado: "#16a34a", // verde
      cliente_anonimo: "#6b7280", // gris
    };
    return colors[profileCode] || "#6b7280";
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
  const IMGS = {
    newStaff: require("../../assets/new-staff.png"),
    churrasco: require("../../assets/churrasco.png"),
    fernet: require("../../assets/fernet.png"),
    mesa: require("../../assets/mesa-circular.png"),
    user_pending: require("../../assets/user-pending.png"),
  };

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <View className="px-6 pt-14 pb-8 flex-1">
        {/* User Profile Card */}
        <View className="mt-10 mb-8">
          <LinearGradient
            colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
            className="rounded-2xl p-4"
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <View className="flex-row items-center">
              {/* Profile Image */}
              <View className="relative">
                {user?.photo_url ? (
                  <Image
                    source={{ uri: user.photo_url }}
                    className="w-16 h-16 rounded-full"
                    style={{ resizeMode: "cover" }}
                  />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-gray-600 items-center justify-center">
                    <UserIcon size={32} color="#d1d5db" />
                  </View>
                )}
                {/* Status Indicator */}
                <View 
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#1a1a1a]"
                  style={{ backgroundColor: getProfileColor(user?.profile_code || "") }}
                />
              </View>

              {/* User Info */}
              <View className="ml-4 flex-1">
                <Text className="text-white text-lg font-semibold">
                  {user?.first_name} {user?.last_name}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View 
                    className="px-2 py-1 rounded-md"
                    style={{ backgroundColor: getProfileColor(user?.profile_code || "") }}
                  >
                    <Text className="text-white text-xs font-medium">
                      {getProfileLabel(user?.profile_code || "", user?.position_code || undefined)}
                    </Text>
                  </View>
                </View>
                {user?.email && (
                  <Text className="text-gray-400 text-sm mt-1">
                    {user.email}
                  </Text>
                )}
              </View>
            </View>
          </LinearGradient>
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
              icon={
                <Image
                  source={IMGS.newStaff}
                  style={{ width: 26, height: 26 }}
                />
              }
            />
          )}

          {isSupervisor && (
            <ActionTile
              title="Añadir empleado"
              subtitle="Crear nuevos empleados del equipo"
              onPress={() =>
                navigation.navigate("AddStaff", { userRole: "supervisor" })
              }
              icon={
                <Image
                  source={IMGS.newStaff}
                  style={{ width: 26, height: 26 }}
                />
              }
            />
          )}

          {isCocinero && (
            <ActionTile
              title="Agregar plato"
              subtitle="Publicá un nuevo plato en el menú"
              onPress={() => goCreate("plato")}
              icon={
                <Image
                  source={IMGS.churrasco}
                  style={{ width: 26, height: 26 }}
                />
              }
            />
          )}

          {isBartender && (
            <ActionTile
              title="Agregar bebida"
              subtitle="Sumá una nueva bebida al menú"
              onPress={() => goCreate("bebida")}
              icon={
                <Image source={IMGS.fernet} style={{ width: 26, height: 26 }} />
              }
            />
          )}

          {((isDueno || isSupervisor) ) && (
            <ActionTile
              title="Crear mesa"
              subtitle="Agregá una nueva mesa al restaurante"
              onPress={() => navigation.navigate("CreateTable")}
              icon={<Image source={IMGS.mesa} style={{ width: 26, height: 26 }} />}
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

          {isCliente && <ClientFlowNavigation />}

          {(isDueno || isSupervisor) && (
            <ActionTile
              title="Gestionar Usuarios Pendientes"
              subtitle="Administrá usuarios y solicitudes pendientes"
              onPress={() => navigation.navigate("Clients")}
              icon={<Image source={IMGS.user_pending} style={{ width: 26, height: 26 }} />}
            />
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
