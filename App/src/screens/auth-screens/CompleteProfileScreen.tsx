import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import FormLayout from "../../Layouts/formLayout";
import TextField from "../../components/form/TextField";
import CUILField from "../../components/form/CUILField";
import { useSocialAuth } from "../../Hooks/auth/useSocialAuth";

type Props = NativeStackScreenProps<RootStackParamList, "CompleteProfile">;

export const CompleteProfileScreen = ({ navigation, route }: Props) => {
  const { user } = route.params;
  const { completeUserProfile, loading } = useSocialAuth();

  const [formData, setFormData] = useState({
    dni: "",
    cuil: "",
    phone: "",
  });

  const [errors, setErrors] = useState({
    dni: "",
    cuil: "",
    phone: "",
  });

  const validateForm = (): boolean => {
    const newErrors = {
      dni: "",
      cuil: "",
      phone: "",
    };

    // Validar DNI
    if (!formData.dni) {
      newErrors.dni = "El DNI es requerido";
    } else if (formData.dni.length < 7 || formData.dni.length > 8) {
      newErrors.dni = "El DNI debe tener 7 u 8 dígitos";
    }

    // Validar CUIL
    if (!formData.cuil) {
      newErrors.cuil = "El CUIL es requerido";
    } else if (formData.cuil.replace(/-/g, "").length !== 11) {
      newErrors.cuil = "El CUIL debe tener 11 dígitos";
    }

    // Validar teléfono (opcional pero con formato)
    if (formData.phone && formData.phone.length < 10) {
      newErrors.phone = "El teléfono debe tener al menos 10 dígitos";
    }

    setErrors(newErrors);
    return !newErrors.dni && !newErrors.cuil && !newErrors.phone;
  };

  const handleComplete = async () => {
    if (!validateForm()) {
      return;
    }

    const result = await completeUserProfile({
      dni: formData.dni,
      cuil: formData.cuil,
      phone: formData.phone || undefined,
    });

    if (result.success) {
      Alert.alert(
        "¡Perfil Completado!",
        "Tu registro ha sido completado exitosamente",
        [
          {
            text: "Continuar",
            onPress: () => {
              // Navegar al home
              navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
              });
            },
          },
        ],
      );
    } else {
      Alert.alert("Error", result.error || "No se pudo completar el perfil");
    }
  };

  return (
    <FormLayout
      title="Completa tu Perfil"
      subtitle={`Hola ${user?.first_name || user?.email || ""}!`}
      submitLabel="Completar Registro"
      onSubmit={handleComplete}
      loading={loading}
    >
      <Text className="text-white mb-6 text-center">
        Solo necesitamos algunos datos adicionales para completar tu registro
      </Text>

      <TextField
        placeholder="DNI (sin puntos)"
        value={formData.dni}
        onChangeText={v => {
          setFormData({ ...formData, dni: v.replace(/\D/g, "") });
          setErrors({ ...errors, dni: "" });
        }}
        keyboardType="phone-pad"
        error={errors.dni}
      />

      <CUILField
        value={formData.cuil}
        onChangeText={v => {
          setFormData({ ...formData, cuil: v });
          setErrors({ ...errors, cuil: "" });
        }}
        error={errors.cuil}
      />

      <TextField
        placeholder="Teléfono (opcional)"
        value={formData.phone}
        onChangeText={v => {
          setFormData({ ...formData, phone: v.replace(/\D/g, "") });
          setErrors({ ...errors, phone: "" });
        }}
        keyboardType="phone-pad"
        error={errors.phone}
      />

      <View className="mt-4 bg-yellow-600/20 p-4 rounded-lg border border-yellow-600/40">
        <Text className="text-yellow-400 text-sm text-center">
          ℹ️ Esta información es necesaria para completar tu perfil y garantizar
          la seguridad de tu cuenta
        </Text>
      </View>
    </FormLayout>
  );
};
