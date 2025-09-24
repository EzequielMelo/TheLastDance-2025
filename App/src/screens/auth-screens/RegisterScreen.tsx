import React, { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import FormLayout from "../../Layouts/formLayout";
import TextField from "../../components/form/TextField";
import ImageField from "../../components/form/ImageField";
import { useRegisterForm, FormDataType } from "../../Hooks/register/useRegisterForm";
import { useAuthActions } from "../../auth/useAuthActions";

type Props = NativeStackScreenProps<RootStackParamList, "Registro">;

export const RegisterScreen = ({ navigation }: Props) => {
  const { actionLoading, handleRegister: register } = useAuthActions();

  const onSubmit = async (data: FormDataType) => {
    const fd = new FormData();
    fd.append("first_name", data.first_name.trim());
    fd.append("last_name",  data.last_name.trim());
    fd.append("email",      data.email.trim());
    fd.append("password",   data.password);
    fd.append("dni",        data.dni.trim());
    fd.append("cuil",       data.cuil.trim());
    fd.append("profile_code", "cliente_registrado");
    if (data.file) fd.append("file", data.file as any);

    const result = await register(fd);
    if (result?.success) navigation.navigate("Login");
  };

  const { formData, errors, loading, handleInputChange, handleBlur, pickImage, handleSubmit } =
    useRegisterForm(onSubmit, "registered");

  const [focused, setFocused] = useState<string>("");

  return (
    <FormLayout
      title="Únete a Nosotros"
      subtitle="Crea tu cuenta en Last Dance"
      submitLabel="Crear Cuenta"
      onSubmit={handleSubmit}
      loading={loading || actionLoading}
      bottomText="¿Ya tienes cuenta?"
      bottomLinkText="Inicia Sesión"
      onBottomLinkPress={() => navigation.goBack()}
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

      <TextField
        placeholder="Correo electrónico"
        value={formData.email}
        onChangeText={v => handleInputChange("email", v)}
        onBlur={() => handleBlur("email")}
        keyboardType="email-address"
        focused={focused === "email"}
        onFocus={() => setFocused("email")}
        error={errors.email}
      />

      <TextField
        placeholder="Contraseña"
        value={formData.password}
        onChangeText={v => handleInputChange("password", v)}
        onBlur={() => handleBlur("password")}
        secureTextEntry
        focused={focused === "password"}
        onFocus={() => setFocused("password")}
        error={errors.password}
      />

      <TextField
        placeholder="DNI"
        value={formData.dni}
        onChangeText={v => handleInputChange("dni", v)}
        onBlur={() => handleBlur("dni")}
        keyboardType="phone-pad"
        focused={focused === "dni"}
        onFocus={() => setFocused("dni")}
        error={errors.dni}
      />

      <TextField
        placeholder="CUIL"
        value={formData.cuil}
        onChangeText={v => handleInputChange("cuil", v)}
        onBlur={() => handleBlur("cuil")}
        keyboardType="phone-pad"
        focused={focused === "cuil"}
        onFocus={() => setFocused("cuil")}
        error={errors.cuil}
      />

      <ImageField
        label="Foto"
        image={formData.file}
        onPick={pickImage}
        onClear={() => { handleInputChange("file", null); }}
        error={errors.file}
        focused={focused === "file"}
      />
    </FormLayout>
  );
};