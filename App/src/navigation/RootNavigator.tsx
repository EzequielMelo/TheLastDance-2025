import React from "react";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { useAuth } from "../auth/AuthContext";
import HomeScreen from "../screens/HomeScreen";
import SplashScreen from "../screens/SplashScreen";
import { LoginScreen } from "../screens/auth-screens/LoginScreen";
import { RegisterScreen } from "../screens/auth-screens/RegisterScreen";
import { RegisterAnonymousScreen } from "../screens/auth-screens/RegisterAnonymousScreen";
import CreateMenuItemScreen from "../screens/menu-screens/CreateMenuItemScreen";
import ClientsScreen from "../screens/admin-screens/UsersList";
import { AddStaffScreen } from "../screens/admin-screens/AddStaffScreen";
import CreateTableScreen from "../screens/admin-screens/CreateTableScreen";
import ManageWaitingListScreen from "../screens/table-screens/ManageWaitingListScreen";
import GenerateWaitingListQRScreen from "../screens/table-screens/GenerateWaitingListQRScreen";
import ScanQRScreen from "../screens/table-screens/ScanQRScreen";
import ScanTableQRScreen from "../screens/table-screens/ScanTableQRScreen";
import JoinWaitingListScreen from "../screens/table-screens/JoinWaitingListScreen";
import MyWaitingPositionScreen from "../screens/table-screens/MyWaitingPositionScreen";
import MenuScreen from "../screens/menu-screens/MenuScreen";
import WaiterDashboardScreen from "../screens/waiter-screens/WaiterDashboardScreen";
import AllWaitersScreen from "../screens/admin-screens/AllWaitersScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Componente interno que tiene acceso a la navegación
function NavigatorContent() {
  const { token, isLoading } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowSplash(false), 2000); // 2s mínimo
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Debug: mostrar estado
  console.log(
    "RootNavigator - isLoading:",
    isLoading,
    "token:",
    !!token,
    "showSplash:",
    showSplash,
  );

  if (showSplash || isLoading) {
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
          <Stack.Screen
            name="AddStaff"
            component={AddStaffScreen}
            options={{ title: "Añadir miembro" }}
          />
          <Stack.Screen
            name="CreateTable"
            component={CreateTableScreen}
            options={{ title: "Nueva Mesa", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="ManageWaitingList"
            component={ManageWaitingListScreen}
            options={{ title: "Lista de Espera", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="GenerateWaitingListQR"
            component={GenerateWaitingListQRScreen}
            options={{ title: "Generar QR", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="ScanQR"
            component={ScanQRScreen}
            options={{ title: "Escanear QR", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="ScanTableQR"
            component={ScanTableQRScreen}
            options={{ title: "Confirmar Mesa", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="JoinWaitingList"
            component={JoinWaitingListScreen}
            options={{ title: "Unirse a Lista", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="MyWaitingPosition"
            component={MyWaitingPositionScreen}
            options={{ title: "Mi Posición", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="Menu"
            component={MenuScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WaiterDashboard"
            component={WaiterDashboardScreen}
            options={{ title: "Panel del Mesero", headerBackTitle: "Volver" }}
          />
          <Stack.Screen
            name="AllWaiters"
            component={AllWaitersScreen}
            options={{ title: "Gestión de Meseros", headerBackTitle: "Volver" }}
          />
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
