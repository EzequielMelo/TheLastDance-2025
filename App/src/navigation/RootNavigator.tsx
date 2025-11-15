import React from "react";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { useAuth } from "../auth/AuthContext";
import NavigationNotificationHandler from "../components/NavigationNotificationHandler";
import HomeScreen from "../screens/HomeScreen";
import SplashScreen from "../screens/SplashScreen";
import { LoginScreen } from "../screens/auth-screens/LoginScreen";
import { RegisterScreen } from "../screens/auth-screens/RegisterScreen";
import { RegisterAnonymousScreen } from "../screens/auth-screens/RegisterAnonymousScreen";
import { CompleteOAuthRegistrationScreen } from "../screens/auth-screens/CompleteOAuthRegistrationScreen";
import CreateMenuItemScreen from "../screens/menu-screens/CreateMenuItemScreen";
import ClientsScreen from "../screens/admin-screens/UsersList";
import { AddStaffScreen } from "../screens/admin-screens/AddStaffScreen";
import CreateTableScreen from "../screens/admin-screens/CreateTableScreen";
import ManageWaitingListScreen from "../screens/table-screens/ManageWaitingListScreen";
import GenerateWaitingListQRScreen from "../screens/table-screens/GenerateWaitingListQRScreen";
import ScanQRScreen from "../screens/table-screens/ScanQRScreen";
import ScanTableQRScreen from "../screens/table-screens/ScanTableQRScreen";
import ScanOrderQRScreen from "../screens/table-screens/ScanOrderQRScreen";
import QRScannerScreen from "../screens/QRScannerScreen";
import JoinWaitingListScreen from "../screens/table-screens/JoinWaitingListScreen";
import MyWaitingPositionScreen from "../screens/table-screens/MyWaitingPositionScreen";
import MenuScreen from "../screens/menu-screens/MenuScreen";
import GamesScreen from "../screens/games/GamesScreen";
import SurveyScreen from "../screens/SurveyScreen";
import SurveyStatsScreen from "../screens/SurveyStatsScreen";
import { CartProvider } from "../context/CartContext";
import { BottomNavProvider } from "../context/BottomNavContext";
import WaiterDashboardScreen from "../screens/waiter-screens/WaiterDashboardScreen";
import AllWaitersScreen from "../screens/admin-screens/AllWaitersScreen";
import TableChatScreen from "../screens/chat/TableChatScreen";
import DeliveryChatScreen from "../screens/chat/DeliveryChatScreen";
import BillPaymentScreen from "../screens/table-screens/BillPaymentScreen";
import InvoiceViewScreen from "../screens/table-screens/InvoiceViewScreen";
import WaiterOrdersScreen from "../components/orders/WaiterOrdersScreen";
import KitchenDashboardScreen from "../screens/kitchen-screens/KitchenDashboardScreen";
import KitchenMenuScreen from "../screens/kitchen-screens/KitchenMenuScreen";
import BartenderDashboardScreen from "../screens/bar-screens/BartenderDashboardScreen";
import BarMenuScreen from "../screens/bar-screens/BarMenuScreen";
import MemoryGame from "../screens/games/MemoryGame";
import FastMathGame from "../screens/games/FastMathGame";
import PuzzleGame from "../screens/games/PuzzleGame";
import MakeReservationScreen from "../screens/reservation-screens/MakeReservationScreen";
import ManageReservationsScreen from "../screens/reservation-screens/ManageReservationsScreen";
import MyReservationsScreen from "../screens/MyReservationsScreen";
// 🚚 Delivery Screens
import DeliveryLocationScreen from "../screens/delivery-screens/DeliveryLocationScreen";
import DeliveryTrackingScreen from "../screens/delivery-screens/DeliveryTrackingScreen";
import DeliveryHistoryScreen from "../screens/delivery-screens/DeliveryHistoryScreen";
import DriverDeliveriesScreen from "../screens/delivery-screens/DriverDeliveriesScreen";
import MyDeliveriesScreen from "../screens/delivery-screens/MyDeliveriesScreen";
import DeliveryOrdersManagementScreen from "../screens/admin-screens/DeliveryOrdersManagementScreen";
import DeliveryQRScreen from "../screens/delivery-screens/DeliveryQRScreen";
import DeliveryCashConfirmScreen from "../screens/delivery-screens/DeliveryCashConfirmScreen";
import PaymentQRScanner from "../screens/delivery-screens/PaymentQRScanner";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Componente interno que tiene acceso a la navegación
function NavigatorContent() {
  const { token, isLoading } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowSplash(false), 3000); // 3s mínimo
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (showSplash || isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      {/* Componente que configura handlers de notificación con navegación */}
      <NavigationNotificationHandler />

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
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateTable"
              component={CreateTableScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ManageWaitingList"
              component={ManageWaitingListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GenerateWaitingListQR"
              component={GenerateWaitingListQRScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ScanQR"
              component={ScanQRScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ScanTableQR"
              component={ScanTableQRScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ScanOrderQR"
              component={ScanOrderQRScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="QRScanner"
              component={QRScannerScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Games"
              component={GamesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Memory"
              component={MemoryGame}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="FastMath"
              component={FastMathGame}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="Puzzle"
              component={PuzzleGame}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Survey"
              component={SurveyScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SurveyStats"
              component={SurveyStatsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="JoinWaitingList"
              component={JoinWaitingListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MyWaitingPosition"
              component={MyWaitingPositionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Menu"
              component={MenuScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WaiterDashboard"
              component={WaiterDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WaiterOrders"
              component={WaiterOrdersScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AllWaiters"
              component={AllWaitersScreen}
              options={{ title: "Distribución de Meseros", headerShown: false }}
            />
            <Stack.Screen
              name="TableChat"
              component={TableChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeliveryChat"
              component={DeliveryChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BillPayment"
              component={BillPaymentScreen}
              options={{ title: "Pagar Cuenta", headerBackTitle: "Volver" }}
            />
            <Stack.Screen
              name="InvoiceView"
              component={InvoiceViewScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="KitchenDashboard"
              component={KitchenDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="KitchenMenu"
              component={KitchenMenuScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BartenderDashboard"
              component={BartenderDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BarMenu"
              component={BarMenuScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MakeReservation"
              component={MakeReservationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ManageReservations"
              component={ManageReservationsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MyReservations"
              component={MyReservationsScreen}
              options={{ headerShown: false }}
            />
            {/* 🚚 Sistema de Delivery */}
            <Stack.Screen
              name="DeliveryLocation"
              component={DeliveryLocationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeliveryTracking"
              component={DeliveryTrackingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeliveryHistory"
              component={DeliveryHistoryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DriverDeliveries"
              component={DriverDeliveriesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MyDeliveries"
              component={MyDeliveriesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeliveryOrdersManagement"
              component={DeliveryOrdersManagementScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeliveryPaymentQR"
              component={DeliveryQRScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeliveryCashConfirm"
              component={DeliveryCashConfirmScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PaymentQRScanner"
              component={PaymentQRScanner}
              options={{ headerShown: false }}
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
            <Stack.Screen
              name="CompleteOAuthRegistration"
              component={CompleteOAuthRegistrationScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <CartProvider>
        <BottomNavProvider>
          <NavigatorContent />
        </BottomNavProvider>
      </CartProvider>
    </NavigationContainer>
  );
}
