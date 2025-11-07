import React, { useState } from "react";
import { View, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import FormLayout from "../../Layouts/formLayout";
import TextField from "../../components/form/TextField";
import CUILField from "../../components/form/CUILField";
import CustomAlert from "../../components/common/CustomAlert";
import { useSocialAuth } from "../../Hooks/auth/useSocialAuth";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "CompleteOAuthRegistration"
>;

export const CompleteOAuthRegistrationScreen = ({
  navigation,
  route,
}: Props) => {
  const { session_id, user_preview } = route.params;
  const { completeRegistration, loading } = useSocialAuth();

  const [formData, setFormData] = useState({
    dni: "",
    cuil: "",
  });

  const [errors, setErrors] = useState({
    dni: "",
    cuil: "",
  });

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

  const validateForm = (): boolean => {
    const newErrors = {
      dni: "",
      cuil: "",
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

    setErrors(newErrors);
    return !newErrors.dni && !newErrors.cuil;
  };

  const handleComplete = async () => {
    if (!validateForm()) {
      return;
    }

    const result = await completeRegistration({
      session_id,
      dni: formData.dni,
      cuil: formData.cuil,
    });

    if (result.success) {
      showAlert(
        "¡Registro Completado!",
        "Tu cuenta ha sido creada exitosamente. Ahora puedes iniciar sesión.",
        "success",
        [
          {
            text: "Iniciar Sesión",
            onPress: () => {
              closeAlert();
              // Volver al login para que inicie sesión con sus credenciales
              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
              });
            },
          },
        ],
      );
    } else {
      showAlert(
        "Error",
        result.error || "No se pudo completar el registro",
        "error",
      );
    }
  };

  return (
    <FormLayout
      title="¡Bienvenido!"
      subtitle={`Hola ${user_preview.first_name}!`}
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

      <View className="mt-4 bg-blue-600/20 p-4 rounded-lg border border-blue-600/40">
        <Text className="text-blue-300 text-sm text-center">
          ℹ️ Tus datos de Google (nombre, email y foto) se usarán
          automáticamente
        </Text>
      </View>

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
