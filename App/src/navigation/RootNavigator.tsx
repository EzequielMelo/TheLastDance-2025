import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { useAuth } from "../auth/useAuth";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen"; // Ensure the file exists at this path or update the path if necessary
import SplashScreen from "../screens/SplashScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: {
            backgroundColor: "#151F2E",
          },
          headerTintColor: "#fff",
        }}
      >
        {token ? (
          /* Si hay token, mostrar pantalla principal */
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <>
            {/* Si no hay token, mostrar pantallas de autenticación */}
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
              options={{ headerShown: false }}
            />
            {/*
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Registro" component={RegisterScreen} />
                */}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
