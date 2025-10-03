import React, { useState } from "react";
import { ToastAndroid, View, Text, TouchableOpacity } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";

import FormLayout from "../../Layouts/formLayout";
import TextField from "../../components/form/TextField";
import ImageField from "../../components/form/ImageField";
import api from "../../api/axios";

import {useRegisterForm, FormDataType} from "../../Hooks/register/useRegisterForm";

type Props = NativeStackScreenProps<RootStackParamList, "AddStaff">;

const POSITIONS = ["bartender", "cocinero", "maitre", "mozo"] as const;

export default function AddStaffScreen({ navigation }: Props) {
  // onSubmit: construye FormData y pega al endpoint de staff
  const onSubmit = async (data: FormDataType) => {
    const fd = new FormData();
    fd.append("first_name", data.first_name.trim());
    fd.append("last_name",  data.last_name.trim());
    fd.append("email",      data.email.trim());
    fd.append("password",   data.password);
    fd.append("cuil",       data.cuil.trim());       // obligatorio
    if (data.dni) fd.append("dni", data.dni.trim()); // opcional
    fd.append("profile_code", isEmpleado ? "empleado" : "supervisor");
    if (isEmpleado) fd.append("position_code", data.position_code);
    if (data.file) fd.append("file", data.file as any);

    await api.post("/api/admin/users/staff", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    ToastAndroid.show("Creado correctamente ✅", ToastAndroid.LONG);
    setTimeout(() => navigation.goBack(), 600);
  };

  // Hook unificado: arrancamos en 'empleado' y foto obligatoria
  const {
    formData,
    errors,
    loading,
    focusedField,
    setFocusedField,
    handleInputChange,
    handleBlur,
    pickImage,
    handleSubmit,
  } = useRegisterForm(
    onSubmit,
    "registered",
    {
      profile: "empleado",   // default: empleado
      requireFile: true,     // foto OBLIGATORIA
    }
  );

  const [_, forceRerender] = useState(0); // por si necesitás refrescar UI al cambiar rol

  const setRole = (role: "empleado" | "supervisor") => {
    handleInputChange("profile_code", role);
    if (role === "empleado" && !formData.position_code) {
      handleInputChange("position_code", "bartender");
    }
    if (role === "supervisor") {
      handleInputChange("position_code", ""); // no aplica
    }
    forceRerender((n) => n + 1);
  };

  const isEmpleado = formData.profile_code === "empleado";

  return (
    <FormLayout
      title="Añadir empleado/supervisor"
      subtitle="Crea perfiles del equipo"
      submitLabel="Crear"
      onSubmit={handleSubmit}
      loading={loading}
      bottomText="Volver"
      bottomLinkText="Ir al Home"
      onBottomLinkPress={() => navigation.goBack()}
    >
      {/* Rol */}
      <Text className="text-gray-300 mb-2">Rol</Text>
      <View className="flex-row gap-3 mb-8">
        <SegButton
          label="Empleado"
          active={isEmpleado}
          onPress={() => setRole("empleado")}
        />
        <SegButton
          label="Supervisor"
          active={!isEmpleado}
          onPress={() => setRole("supervisor")}
        />
      </View>

      {/* Nombre / Apellido */}
      <TextField
        placeholder="Nombre"
        value={formData.first_name}
        onChangeText={(v) => handleInputChange("first_name", v)}
        onBlur={() => handleBlur("first_name")}
        focused={focusedField === "first_name"}
        onFocus={() => setFocusedField("first_name")}
        error={errors.first_name}
      />
      <TextField
        placeholder="Apellido"
        value={formData.last_name}
        onChangeText={(v) => handleInputChange("last_name", v)}
        onBlur={() => handleBlur("last_name")}
        focused={focusedField === "last_name"}
        onFocus={() => setFocusedField("last_name")}
        error={errors.last_name}
      />

      {/* Email / Password */}
      <TextField
        placeholder="Correo electrónico"
        value={formData.email}
        onChangeText={(v) => handleInputChange("email", v)}
        onBlur={() => handleBlur("email")}
        keyboardType="email-address"
        focused={focusedField === "email"}
        onFocus={() => setFocusedField("email")}
        error={errors.email}
      />
      <TextField
        placeholder="Contraseña"
        value={formData.password}
        onChangeText={(v) => handleInputChange("password", v)}
        onBlur={() => handleBlur("password")}
        secureTextEntry
        focused={focusedField === "password"}
        onFocus={() => setFocusedField("password")}
        error={errors.password}
      />

      {/* CUIL obligatorio / DNI opcional */}
      <TextField
        placeholder="CUIL"
        value={formData.cuil}
        onChangeText={(v) => handleInputChange("cuil", v)}
        onBlur={() => handleBlur("cuil")}
        keyboardType="phone-pad"
        focused={focusedField === "cuil"}
        onFocus={() => setFocusedField("cuil")}
        error={errors.cuil}
      />
      <TextField
        placeholder="DNI (opcional)"
        value={formData.dni}
        onChangeText={(v) => handleInputChange("dni", v)}
        onBlur={() => handleBlur("dni")}
        keyboardType="phone-pad"
        focused={focusedField === "dni"}
        onFocus={() => setFocusedField("dni")}
        error={errors.dni}
      />

      {/* Foto OBLIGATORIA */}
      <ImageField
        label="Foto"
        image={formData.file}
        onPick={pickImage}
        onClear={() => handleInputChange("file", null)}
        error={errors.file}
        focused={focusedField === "file"}
      />

      {/* Puesto SOLO si es empleado */}
      {isEmpleado && (
        <>
          <Text className="text-gray-300 mt-2 mb-2">Puesto</Text>
          <View className="flex-row flex-wrap gap-3 mb-4">
            {POSITIONS.map((p) => (
              <SegButton
                key={p}
                label={toPretty(p)}
                active={formData.position_code === p}
                onPress={() => handleInputChange("position_code", p)}
              />
            ))}
          </View>
          {!!errors.position_code && (
            <Text className="text-red-500 text-sm">{errors.position_code}</Text>
          )}
        </>
      )}
    </FormLayout>
  );
}

function SegButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 h-10 rounded-xl items-center justify-center border ${
        active ? "bg-[#d4af37] border-[#d4af37]" : "bg-white/5 border-white/15"
      }`}
      activeOpacity={0.9}
    >
      <Text className={active ? "text-[#1a1a1a] font-semibold" : "text-white"}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function toPretty(p: string) {
  if (p === "maitre") return "Maître";
  if (p === "mozo") return "Mozo";
  if (p === "bartender") return "Bartender";
  if (p === "cocinero") return "Cocinero";
  return p;
}
