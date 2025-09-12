import React, { useEffect, useState, useContext } from "react";
import { View, Text, ActivityIndicator, Button } from "react-native";
import { AuthContext } from "../auth/AuthContext";
/*import { fetchUserData } from "../services/user";*/
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { User } from "../types/User";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

// eslint-disable-next-line no-unused-vars
export default function HomeScreen({ navigation }: Props) {
  const { token, logout } = useContext(AuthContext);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (!token) return;
        /* Lógica para obtener datos del usuario */
        /*
        const fetchedUser = await fetchUserData(token);
        setUser(fetchedUser);
        */
      } catch (error) {
        console.error("Error fetching user data", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18 }}>¡Bienvenido!</Text>
      {user && <Text style={{ marginTop: 10 }}>Email: {user.email}</Text>}
      <Button title="Cerrar sesión" onPress={handleLogout} />
    </View>
  );
}
