import React from "react";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { useAuth } from "../auth/useAuth";
import { NotificationService } from "../services/notificationService";
import HomeScreen from "../screens/HomeScreen";
import SplashScreen from "../screens/SplashScreen";
import { LoginScreen } from "../screens/auth-screens/LoginScreen";
import { RegisterScreen } from "../screens/auth-screens/RegisterScreen";
import { RegisterAnonymousScreen } from "../screens/auth-screens/RegisterAnonymousScreen";
import CreateMenuItemScreen from "../screens/menu-screens/CreateMenuItemScreen";
import ClientsScreen from "../screens/admin-screens/UsersList";
import { AddStaffScreen } from "../screens/admin-screens/AddStaffScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Componente interno que tiene acceso a la navegación
function NavigatorContent() {
  const { token, isLoading } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);
  const navigation = useNavigation();

  React.useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowSplash(false), 2000); // 2s mínimo
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Configurar listeners de notificaciones cuando el navegador esté listo
  React.useEffect(() => {
    const setupNotificationListeners = async () => {
      // Configurar listener para cuando se toca una notificación
      const notificationListener = NotificationService.setupNotificationListener((data: any) => {
        console.log('Notification tapped:', data);
        
        // Navegar según el tipo de notificación
        if (data.type === 'new_client_registration') {
          (navigation as any).navigate('Clients');
        }
      });

      // Configurar listener para notificaciones en primer plano
      const foregroundListener = NotificationService.setupForegroundListener((notification) => {
        console.log('Notification received in foreground:', notification);
      });

      return () => {
        notificationListener?.remove?.();
        foregroundListener?.remove?.();
      };
    };

    setupNotificationListeners();
  }, [navigation]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#151F2E" },
        headerTintColor: "#fff",
      }}
      initialRouteName={token ? "Home" : "Login"}
    >
      {token ? (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          {/* 🔒 Solo disponible logueado */}
          <Stack.Screen
            name="CreateMenuItem"
            component={CreateMenuItemScreen}
            options={{ title: "Agregar al menú", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="Clients"
            component={ClientsScreen}
            options={{
              title: "Usuarios Pendientes",
              headerBackTitle: "Volver",
            }}
          />
          <Stack.Screen name="AddStaff" component={AddStaffScreen} options={{ title: "Añadir miembro" }} />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Registro"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RegistroAnonimo"
            component={RegisterAnonymousScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <NavigatorContent />
    </NavigationContainer>
  );
}
