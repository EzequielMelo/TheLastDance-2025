import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import { View, Text, TextInput, TouchableOpacity, ToastAndroid } from "react-native";
import { useEffect, useState } from "react";
import { ChefHat, Lock, Eye, EyeOff, Mail } from "lucide-react-native";
import { useAuthActions } from "../../auth/useAuthActions";
import FormLayout from "../../Layouts/formLayout";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const { actionLoading, actionError, handleLogin: login } = useAuthActions();

  useEffect(() => {
    if (actionError) {
      ToastAndroid.show(actionError, ToastAndroid.LONG);
    }
  }, [actionError]);

  const validateEmail = (v: string) =>
    !v ? "El correo es obligatorio" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Correo no válido";
  const validatePassword = (v: string) =>
    !v ? "La contraseña es obligatoria" : v.length < 6 ? "Mínimo 6 caracteres" : "";

  const handleLogin = () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (!eErr && !pErr) {
      login({ email, password });
    }else {
      ToastAndroid.show("Revisá los campos resaltados", ToastAndroid.SHORT);
    }
  };

  return (
    <FormLayout
      title="Bienvenido"
      subtitle="Inicia sesión en Bella Tavola"
      icon={<ChefHat size={60} color="#d4af37" strokeWidth={1.5} />}
      submitLabel="Iniciar Sesión"
      onSubmit={handleLogin}
      loading={actionLoading}
      bottomText="¿No tienes cuenta?"
      bottomLinkText="Regístrate"
      onBottomLinkPress={() => navigation.push("Registro")}
    >
      {/* Email */}
      <View className="mb-5">
        <View className={`flex-row items-center rounded-xl border px-4 h-14 bg-white/10 border-white/20 ${emailFocused ? "border-[#d4af37] bg-[#d4af371a]" : ""}`}>
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
        {!!emailError && <Text className="text-red-500 text-sm mt-1">{emailError}</Text>}
      </View>

      {/* Password */}
      <View className="mb-5">
        <View className={`flex-row items-center rounded-xl border px-4 h-14 bg-white/10 border-white/20 ${passwordFocused ? "border-[#d4af37] bg-[#d4af371a]" : ""}`}>
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
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="absolute right-4 p-1">
            {showPassword ? <EyeOff size={20} color="#888" /> : <Eye size={20} color="#888" />}
          </TouchableOpacity>
        </View>
        {!!passwordError && <Text className="text-red-500 text-sm mt-1">{passwordError}</Text>}
      </View>

      <TouchableOpacity className="self-end mb-2">
        <Text className="text-[#d4af37] text-sm">¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>
    </FormLayout>
  );
};
