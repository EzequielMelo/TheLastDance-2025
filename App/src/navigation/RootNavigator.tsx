import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { useAuth } from "../auth/useAuth";
import HomeScreen from "../screens/HomeScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, isLoading } = useAuth();

  // 🔹 Mientras se cargan los datos del storage, mostramos Splash
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: "#151F2E",
          },
          headerTintColor: "#fff",
        }}
      >
        {token ? (
          // 🔹 Usuario autenticado → App principal
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          // 🔹 Usuario no autenticado → Pantallas de auth
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
