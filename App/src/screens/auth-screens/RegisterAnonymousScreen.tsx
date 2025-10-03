import React, { useState } from "react";
import { Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import FormLayout from "../../Layouts/formLayout";
import TextField from "../../components/form/TextField";
import ImageField from "../../components/form/ImageField";
import { useRegisterForm, FormDataType } from "../../Hooks/register/useRegisterForm";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/axios";

type Props = NativeStackScreenProps<RootStackParamList, "RegistroAnonimo">;

export const RegisterAnonymousScreen = ({ navigation }: Props) => {
  const { login } = useAuth();

  const onSubmit = async (data: FormDataType) => {
    const fd = new FormData();
    fd.append("first_name", data.first_name.trim());
    fd.append("last_name",  data.last_name.trim());
    fd.append("profile_code", "cliente_anonimo");
    if (data.file) fd.append("image", data.file as any);

    const resp = await fetch(`${api.defaults.baseURL}/auth/anonymous`, { method: "POST", body: fd });
    if (!resp.ok) throw new Error((await resp.text()) || `HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json?.token || !json?.user) throw new Error("Respuesta inválida");

    await login(json.token, json.user);
    // No hacer navegación manual - el NavigationContainer se recargará automáticamente
    // cuando el estado de autenticación cambie
  };

  const { formData, errors, loading, handleInputChange, handleBlur, pickImage, handleSubmit } =
    useRegisterForm(onSubmit, "anon");

  const [focused, setFocused] = useState<string>("");

  return (
    <FormLayout
      title="Continuar sin cuenta"
      subtitle="Perfil anónimo"
      submitLabel={loading ? "Creando..." : "Entrar"}
      onSubmit={handleSubmit}
      loading={loading}
      bottomText="¿Ya tienes cuenta?"
      bottomLinkText="Inicia sesión"
      onBottomLinkPress={() => navigation.replace("Login")}
    >
      <TextField
        placeholder="Nombre"
        value={formData.first_name}
        onChangeText={v => handleInputChange("first_name", v)}
        onBlur={() => handleBlur("first_name")}
        focused={focused === "first_name"}
        onFocus={() => setFocused("first_name")}
        error={errors.first_name}
      />

      <TextField
        placeholder="Apellido"
        value={formData.last_name}
        onChangeText={v => handleInputChange("last_name", v)}
        onBlur={() => handleBlur("last_name")}
        focused={focused === "last_name"}
        onFocus={() => setFocused("last_name")}
        error={errors.last_name}
      />

      <ImageField
        label="Foto"
        image={formData.file}
        onPick={pickImage}
        onClear={() => { handleInputChange("file", null); }}
        error={errors.file}
        focused={focused === "file"}
      />

      <Text className="text-gray-400 text-xs">
        Este sistema de cuenta todavía está en desarrollo.
      </Text>
    </FormLayout>
  );
};