import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  ToastAndroid,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  IdCardIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChefHat,
  User,
  ImagePlus,
} from "lucide-react-native";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootStackParamList";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useAuthActions } from "../Hooks/useAuthActions";

type Props = NativeStackScreenProps<RootStackParamList, "Registro">;

export const RegisterScreen = ({ navigation }: Props) => {
  const [formData, setFormData] = useState<{
    first_name: string;
    last_name: string;
    profile_code: string;
    position_code: string;
    dni: string;
    cuil: string;
    email: string;
    password: string;
    file: File | null;
    file_uri?: string;
  }>({
    first_name: "",
    last_name: "",
    profile_code: "",
    position_code: "",
    dni: "",
    cuil: "",
    email: "",
    password: "",
    file: null,
    file_uri: undefined,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState("");

  const {
    actionLoading,
    actionError,
    handleRegister: register,
  } = useAuthActions();

  const validateField = (field: string, value: string | File | null) => {
    switch (field) {
      case "first_name":
      case "last_name":
      case "dni":
      case "cuil":
        if (!value || (typeof value === "string" && value.trim() === ""))
          return "Campo obligatorio";
        break;
      case "email":
        if (
          !value ||
          (typeof value === "string" &&
            !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value))
        )
          return "Email inválido";
        break;
      case "password":
        if (!value || (typeof value === "string" && value.length < 6))
          return "Mínimo 6 caracteres";
        break;
      case "file":
        if (!value || !(value instanceof File))
          return "Debes seleccionar una imagen";
        break;
      case "profile_code":
        if (!value || value === "") return "Seleccione un perfil";
        break;
      case "position_code":
        if (formData.profile_code === "empleado" && (!value || value === ""))
          return "Seleccione un cargo";
        break;
      default:
        return "";
    }
    return "";
  };

  const handleInputChange = (field: string, value: string | File) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleRegister = async () => {
    const newErrors: { [key: string]: string } = {};
    let valid = true;
    Object.entries(formData).forEach(([key, value]) => {
      const error = validateField(key, value);
      if (error) {
        valid = false;
        newErrors[key] = error;
      }
    });
    setErrors(newErrors);
    if (!valid) return;

    await register(formData);
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
          className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${
            isFocused ? "border-[#d4af37] bg-[#d4af37]/10" : ""
          }`}
        >
          {icon}
          <TextInput
            className={`flex-1 text-white text-base py-4 ${showPasswordToggle ? "pr-10" : ""}`}
            placeholder={placeholder}
            placeholderTextColor="#888"
            value={(formData[field as keyof typeof formData] as string) || ""}
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
                if (field === "password") setShowPassword(!showPassword);
                else setShowConfirmPassword(!showConfirmPassword);
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
        {errors[field] && (
          <Text className="text-red-500 text-sm mt-1">{errors[field]}</Text>
        )}
      </View>
    );
  };

  const renderDropdown = (
    field: string,
    icon: React.ReactNode,
    options: string[],
  ) => {
    const isFocused = focusedField === field;
    return (
      <View className="mb-4">
        <View
          className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${
            isFocused ? "border-[#d4af37] bg-[#d4af37]/10" : ""
          }`}
        >
          {icon}
          <Picker
            selectedValue={formData[field as keyof typeof formData] || ""}
            style={{
              flex: 1,
              color: formData[field as keyof typeof formData]
                ? "white"
                : "#aaa",
            }}
            dropdownIconColor="#888"
            onFocus={() => setFocusedField(field)}
            onBlur={() => setFocusedField("")}
            onValueChange={value => handleInputChange(field, value)}
          >
            <Picker.Item
              label="Seleccione uno"
              value=""
              enabled={false}
              color="#aaa"
            />
            {options.map(opt => (
              <Picker.Item
                key={opt}
                label={opt.charAt(0).toUpperCase() + opt.slice(1)}
                value={opt}
              />
            ))}
          </Picker>
        </View>
        {errors[field] && (
          <Text className="text-red-500 text-sm mt-1">{errors[field]}</Text>
        )}
      </View>
    );
  };

  const renderImagePicker = (
    field: string,
    placeholder: string,
    icon: React.ReactNode,
  ) => {
    const isFocused = focusedField === field;

    const pickImage = async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("Se necesita permiso para acceder a la galería");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const fileName = uri.split("/").pop()!;
        const fileType = `image/${fileName.split(".").pop()}`;
        const file = new File(
          [await fetch(uri).then(r => r.blob())],
          fileName,
          { type: fileType },
        );

        setFormData(prev => ({ ...prev, file, file_uri: uri }));

        const error = validateField("file", file);
        setErrors(prev => ({ ...prev, file: error }));
      }
    };

    return (
      <View className="mb-4">
        <TouchableOpacity
          onPress={pickImage}
          className={`flex-row items-center h-13 rounded-xl border px-4 py-4 bg-white/10 border-white/20 ${
            isFocused ? "border-[#d4af37] bg-[#d4af37]/10" : ""
          }`}
          onFocus={() => setFocusedField(field)}
          onBlur={() => setFocusedField("")}
        >
          {icon}
          {formData.file_uri ? (
            <Image
              source={{ uri: formData.file_uri }}
              className="h-10 w-10 rounded-lg ml-3"
            />
          ) : (
            <Text className="flex-1 text-white text-base ml-3">
              {placeholder}
            </Text>
          )}
        </TouchableOpacity>
        {errors.file && (
          <Text className="text-red-500 text-sm mt-1">{errors.file}</Text>
        )}
      </View>
    );
  };

  useEffect(() => {
    if (actionError) {
      ToastAndroid.show(actionError, ToastAndroid.LONG);
    }
  }, [actionError]);

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
          <View className="items-center mb-10">
            <ChefHat size={50} color="#d4af37" strokeWidth={1.5} />
            <Text className="text-white text-2xl font-light mt-4 tracking-wide">
              Únete a Nosotros
            </Text>
            <Text className="text-gray-300 text-sm mt-2 text-center">
              Crea tu cuenta en Bella Tavola
            </Text>
          </View>

          {renderInput(
            "first_name",
            "Nombre",
            <User
              size={20}
              color={focusedField === "first_name" ? "#d4af37" : "#888"}
              className="mr-3"
            />,
          )}
          {renderInput(
            "last_name",
            "Apellido",
            <User
              size={20}
              color={focusedField === "last_name" ? "#d4af37" : "#888"}
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
          {renderDropdown("profile_code", <User size={20} color={"#888"} />, [
            "dueño",
            "supervisor",
            "empleado",
            "cliente",
          ])}
          {formData.profile_code === "empleado" &&
            renderDropdown("position_code", <User size={20} color={"#888"} />, [
              "maître",
              "mozo",
              "cocinero",
              "bartender",
            ])}
          {renderInput(
            "dni",
            "DNI",
            <IdCardIcon
              size={20}
              color={focusedField === "dni" ? "#d4af37" : "#888"}
              className="mr-3"
            />,
            "phone-pad",
          )}
          {renderInput(
            "cuil",
            "CUIL",
            <IdCardIcon
              size={20}
              color={focusedField === "cuil" ? "#d4af37" : "#888"}
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
          {renderImagePicker(
            "file",
            "Selecciona una imagen",
            <ImagePlus size={20} color="#888" />,
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
              {actionLoading ? (
                <ActivityIndicator size={35} className="text-[#1a1a1a]" />
              ) : (
                <Text className="text-[#1a1a1a] text-lg font-semibold tracking-wide">
                  Crear Cuenta
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-px bg-white/20" />
            <Text className="text-gray-400 px-5 text-sm">o</Text>
            <View className="flex-1 h-px bg-white/20" />
          </View>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="items-center mb-20"
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
