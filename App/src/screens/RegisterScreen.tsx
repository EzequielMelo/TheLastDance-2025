import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ChefHat,
} from "lucide-react-native";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, "Registro">;

export const RegisterScreen = ({ navigation }: Props) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState("");

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleRegister = () => {
    console.log("Register:", formData);
  };

  const renderInput = (
    field: string,
    placeholder: string,
    icon: React.ReactNode,
    keyboardType = "default",
    secureTextEntry = false,
    showPasswordToggle = false,
  ) => {
    const isFocused = focusedField === field;

    return (
      <View className="mb-4">
        <View
          className={`
            flex-row items-center h-13 rounded-xl border px-4
            bg-white/10 border-white/20
            ${isFocused ? "border-[#d4af37] bg-[#d4af37]/10" : ""}
          `}
        >
          {icon}
          <TextInput
            className={`flex-1 text-white text-base py-4 ${showPasswordToggle ? "pr-10" : ""}`}
            placeholder={placeholder}
            placeholderTextColor="#888"
            value={formData[field as keyof typeof formData]}
            onChangeText={value => handleInputChange(field, value)}
            keyboardType={keyboardType as any}
            autoCapitalize={field === "email" ? "none" : "words"}
            secureTextEntry={secureTextEntry}
            onFocus={() => setFocusedField(field)}
            onBlur={() => setFocusedField("")}
          />
          {showPasswordToggle && (
            <TouchableOpacity
              onPress={() => {
                if (field === "password") {
                  setShowPassword(!showPassword);
                } else {
                  setShowConfirmPassword(!showConfirmPassword);
                }
              }}
              className="absolute right-4 p-1"
            >
              {(field === "password" ? showPassword : showConfirmPassword) ? (
                <EyeOff size={20} color="#888" />
              ) : (
                <Eye size={20} color="#888" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          className="px-8 py-8"
        >
          {/* Header */}
          <View className="items-center mb-10">
            <ChefHat size={50} color="#d4af37" strokeWidth={1.5} />
            <Text className="text-white text-2xl font-light mt-4 tracking-wide">
              Únete a Nosotros
            </Text>
            <Text className="text-gray-300 text-sm mt-2 text-center">
              Crea tu cuenta en Bella Tavola
            </Text>
          </View>

          {/* Form */}
          {renderInput(
            "name",
            "Nombre completo",
            <User
              size={20}
              color={focusedField === "name" ? "#d4af37" : "#888"}
              className="mr-3"
            />,
          )}

          {renderInput(
            "email",
            "Correo electrónico",
            <Mail
              size={20}
              color={focusedField === "email" ? "#d4af37" : "#888"}
              className="mr-3"
            />,
            "email-address",
          )}

          {renderInput(
            "phone",
            "Número de teléfono",
            <Phone
              size={20}
              color={focusedField === "phone" ? "#d4af37" : "#888"}
              className="mr-3"
            />,
            "phone-pad",
          )}

          {renderInput(
            "password",
            "Contraseña",
            <Lock
              size={20}
              color={focusedField === "password" ? "#d4af37" : "#888"}
              className="mr-3"
            />,
            "default",
            !showPassword,
            true,
          )}

          {renderInput(
            "confirmPassword",
            "Confirmar contraseña",
            <Lock
              size={20}
              color={focusedField === "confirmPassword" ? "#d4af37" : "#888"}
              className="mr-3"
            />,
            "default",
            !showConfirmPassword,
            true,
          )}

          <View className="my-5">
            <Text className="text-gray-300 text-xs text-center leading-5">
              Al registrarte aceptas nuestros{" "}
              <Text className="text-[#d4af37] underline">
                Términos de Servicio
              </Text>{" "}
              y{" "}
              <Text className="text-[#d4af37] underline">
                Política de Privacidad
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            className="overflow-hidden rounded-xl"
            onPress={handleRegister}
          >
            <LinearGradient
              colors={["#d4af37", "#b8941f", "#d4af37"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-14 justify-center items-center shadow-lg"
            >
              <Text className="text-[#1a1a1a] text-lg font-semibold tracking-wide">
                Crear Cuenta
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-px bg-white/20" />
            <Text className="text-gray-400 px-5 text-sm">o</Text>
            <View className="flex-1 h-px bg-white/20" />
          </View>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="items-center"
          >
            <Text className="text-gray-300 text-sm">
              ¿Ya tienes cuenta?{" "}
              <Text className="text-[#d4af37] font-semibold">
                Inicia Sesión
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};
