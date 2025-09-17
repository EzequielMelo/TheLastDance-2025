import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ChefHat, Lock, Eye, EyeOff, Mail } from "lucide-react-native";
import { useAuthActions } from "../Hooks/useAuthActions";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const {
    user,
    actionLoading,
    actionError,
    handleLogin: login,
  } = useAuthActions();

  useEffect(() => {
    if (actionError) {
      ToastAndroid.show(actionError, ToastAndroid.LONG);
    }
  }, [actionError]);

  const handleLogin = () => login({ email, password });

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-12">
          {/* Header */}
          <View className="items-center mb-12">
            <ChefHat size={60} color="#d4af37" strokeWidth={1.5} />
            <Text className="text-white text-4xl font-light mt-5 tracking-wide">
              Bienvenido
            </Text>
            <Text className="text-gray-300 text-base mt-2 text-center">
              Inicia sesión en Bella Tavola
            </Text>
          </View>

          {/* Formulario */}
          <View className="w-full">
            {/* Email */}
            <View className="mb-5">
              <View
                className={`flex-row items-center rounded-xl border px-4 h-14
                 bg-white/10 border-white/20
                 ${emailFocused ? "border-[#d4af37] bg-[#d4af371a]" : ""}`}
              >
                <Mail size={20} color={emailFocused ? "#d4af37" : "#888"} />
                <TextInput
                  className="flex-1 ml-2 text-white text-base p-0"
                  placeholder="Correo electrónico"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password */}
            <View className="mb-5">
              <View
                className={`flex-row items-center rounded-xl border px-4 h-14
                 bg-white/10 border-white/20
                 ${passwordFocused ? "border-[#d4af37] bg-[#d4af371a]" : ""}`}
              >
                <Lock size={20} color={passwordFocused ? "#d4af37" : "#888"} />
                <TextInput
                  className="flex-1 ml-2 text-white text-base p-0 pr-10"
                  placeholder="Contraseña"
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-4 p-1"
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#888" />
                  ) : (
                    <Eye size={20} color="#888" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity className="self-end mb-7">
              <Text className="text-[#d4af37] text-sm">
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            {/* Botón login */}
            <TouchableOpacity
              className="overflow-hidden rounded-xl"
              onPress={handleLogin}
            >
              <LinearGradient
                colors={["#d4af37", "#b8941f", "#d4af37"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-14 justify-center items-center shadow-lg"
              >
                {actionLoading ? (
                  <ActivityIndicator size={35} className="text-[#1a1a1a]" />
                ) : (
                  <Text className="text-[#1a1a1a] text-lg font-semibold tracking-wide">
                    Iniciar Sesión
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-8">
              <View className="flex-1 h-px bg-white/20" />
              <Text className="text-gray-400 px-5 text-sm">o</Text>
              <View className="flex-1 h-px bg-white/20" />
            </View>

            {/* Link registro */}
            <TouchableOpacity
              className="items-center"
              onPress={() => navigation.push("Registro")}
            >
              <Text className="text-gray-300 text-base">
                ¿No tienes cuenta?{" "}
                <Text className="text-[#d4af37] font-semibold">Regístrate</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};
