import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { useAuth } from "../auth/useAuth";
import HomeScreen from "../screens/HomeScreen";
import SplashScreen from "../screens/SplashScreen";
import { LoginScreen } from "../screens/auth-screens/LoginScreen";
import { RegisterScreen } from "../screens/auth-screens/RegisterScreen";
import  CreateMenuItemScreen  from "../screens/menu-screens/CreateMenuItemScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, isLoading } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowSplash(false), 2000); // 2s mínimo
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#151F2E" },
          headerTintColor: "#fff",
        }}
        initialRouteName={token ? "Home" : "Login"}
      >
        {token ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            {/* 🔒 Solo disponible logueado */}
            <Stack.Screen name="CreateMenuItem" component={CreateMenuItemScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Registro" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
