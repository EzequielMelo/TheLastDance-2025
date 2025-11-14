import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ToastAndroid,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useState } from "react";
import { ChefHat, Lock, Eye, EyeOff, Mail } from "lucide-react-native";
import { useAuthActions } from "../../auth/useAuthActions";
import { useSocialAuth } from "../../Hooks/auth/useSocialAuth";
import CustomAlert from "../../components/common/CustomAlert";
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
  const { signInWithGoogle, loading: socialLoading } = useSocialAuth();

  // CustomAlert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as "success" | "error" | "warning" | "info",
    buttons: [] as Array<{
      text: string;
      onPress?: () => void;
      style?: "cancel" | "destructive";
    }>,
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "info",
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "cancel" | "destructive";
    }>,
  ) => {
    setAlertConfig({
      title,
      message,
      type,
      buttons: buttons || [
        { text: "OK", onPress: () => setAlertVisible(false) },
      ],
    });
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
  };

  useEffect(() => {
    if (actionError) {
      ToastAndroid.show(actionError, ToastAndroid.LONG);
    }
  }, [actionError]);

  const validateEmail = (v: string) =>
    !v
      ? "El correo es obligatorio"
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        ? ""
        : "Correo no válido";
  const validatePassword = (v: string) =>
    !v
      ? "La contraseña es obligatoria"
      : v.length < 6
        ? "Mínimo 6 caracteres"
        : "";

  const handleLogin = () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (!eErr && !pErr) {
      login({ email, password });
    } else {
      ToastAndroid.show("Revisá los campos resaltados", ToastAndroid.SHORT);
    }
  };

  // Manejar autenticación social
  const handleSocialSignIn = async () => {
    const result = await signInWithGoogle();

    if (result.success) {
      if (
        result.requires_completion &&
        result.session_id &&
        result.user_preview
      ) {
        // Usuario nuevo: navegar a pantalla para completar DNI y CUIL
        navigation.navigate("CompleteOAuthRegistration", {
          session_id: result.session_id,
          user_preview: result.user_preview,
        });
      }
      // Usuario existente: el contexto ya se actualizó, la navegación será automática
    } else {
      showAlert(
        "Error",
        result.error || "Error al iniciar sesión con Google",
        "error",
      );
    }
  };

  return (
    <FormLayout
      title="Bienvenido"
      subtitle="Inicia sesión en Last Dance"
      icon={<ChefHat size={60} color="#d4af37" strokeWidth={1.5} />}
      submitLabel="Iniciar Sesión"
      onSubmit={handleLogin}
      loading={actionLoading}
      bottomText="¿No tienes cuenta?"
      bottomLinkText="Regístrate"
      onBottomLinkPress={() => navigation.push("Registro")}
      footerContent={
        <TouchableOpacity
          onPress={() => navigation.push("RegistroAnonimo")}
          className="px-4 py-2 rounded-full bg-white/10 border border-white/20"
        >
          <Text className="text-white">Continuar sin cuenta</Text>
        </TouchableOpacity>
      }
    >
      {/* Email */}
      <View className="mb-5">
        <View
          className={`flex-row items-center rounded-xl border px-4 h-14 bg-white/10 border-white/20 ${emailFocused ? "border-[#d4af37] bg-[#d4af371a]" : ""}`}
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
        {!!emailError && (
          <Text className="text-red-500 text-sm mt-1">{emailError}</Text>
        )}
      </View>

      {/* Password */}
      <View className="mb-5">
        <View
          className={`flex-row items-center rounded-xl border px-4 h-14 bg-white/10 border-white/20 ${passwordFocused ? "border-[#d4af37] bg-[#d4af371a]" : ""}`}
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
        {!!passwordError && (
          <Text className="text-red-500 text-sm mt-1">{passwordError}</Text>
        )}
      </View>

      <TouchableOpacity className="self-end mb-2">
        <Text className="text-[#d4af37] text-sm">
          ¿Olvidaste tu contraseña?
        </Text>
      </TouchableOpacity>

      {/* Separador */}
      <View className="flex-row items-center my-6">
        <View className="flex-1 h-px bg-white/20" />
        <Text className="mx-4 text-white/60 text-sm">O continúa con</Text>
        <View className="flex-1 h-px bg-white/20" />
      </View>

      {/* Botón de Google */}
      <TouchableOpacity
        onPress={handleSocialSignIn}
        disabled={socialLoading || actionLoading}
        className="flex-row items-center justify-center px-4 py-3 mb-6 rounded-xl bg-white border border-white/20"
        style={{ opacity: socialLoading || actionLoading ? 0.6 : 1 }}
      >
        <View className="mr-3">
          <Text style={{ fontSize: 20 }}>G</Text>
        </View>
        <Text className="text-gray-700 font-semibold">
          {socialLoading ? "Conectando..." : "Continuar con Google"}
        </Text>
      </TouchableOpacity>

      {/* Ingresos Rápidos */}
      <View className="mb-6">
        <Text className="text-white text-center mb-3 text-sm opacity-70">
          Ingresos Rápidos
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4 }}
          className="flex-row"
        >
          <TouchableOpacity
            onPress={() => {
              setEmail("julian9@gmail.com");
              setPassword("123456");
              login({ email: "julian9@gmail.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-blue-600/20 border border-blue-500/30 min-w-[120px]"
          >
            <Text className="text-blue-300 text-center text-sm">
              👤 Cliente registrado
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setEmail("franco@gmail.com");
              setPassword("123456");
              login({ email: "franco@gmail.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-cyan-600/20 border border-cyan-500/30 min-w-[120px]"
          >
            <Text className="text-cyan-300 text-center text-sm">💁‍♂️ Mozo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setEmail("pachu@gmail.com");
              setPassword("123456");
              login({ email: "pachu@gmail.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-amber-600/20 border border-amber-500/30 min-w-[120px]"
          >
            <Text className="text-amber-300 text-center text-sm">
              💂 Maitre
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setEmail("momo@gmail.com");
              setPassword("123456");
              login({ email: "momo@gmail.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-orange-600/20 border border-orange-500/30 min-w-[120px]"
          >
            <Text className="text-orange-300 text-center text-sm">
              👨‍🍳 Cocinero
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setEmail("messi10@gmail.com");
              setPassword("123456");
              login({ email: "messi10@gmail.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-purple-600/20 border border-purple-500/30 min-w-[120px]"
          >
            <Text className="text-purple-300 text-center text-sm">
              🍷 Bartender
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setEmail("coscu@gmail.com");
              setPassword("123456");
              login({ email: "coscu@gmail.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-green-600/20 border border-green-500/30 min-w-[120px]"
          >
            <Text className="text-green-300 text-center text-sm">
              👔 Supervisor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setEmail("admin@example.com");
              setPassword("123456");
              login({ email: "admin@example.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-red-600/20 border border-red-500/30 min-w-[120px]"
          >
            <Text className="text-red-300 text-center text-sm">👑 Dueño</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setEmail("davo@email.com");
              setPassword("123456");
              login({ email: "davo@email.com", password: "123456" });
            }}
            className="px-3 py-2 mx-1 rounded-lg bg-red-600/20 border border-red-500/30 min-w-[120px]"
          >
            <Text className="text-red-300 text-center text-sm">
              🏍️ Repartidor
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* CustomAlert Component */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={closeAlert}
      />
    </FormLayout>
  );
};
