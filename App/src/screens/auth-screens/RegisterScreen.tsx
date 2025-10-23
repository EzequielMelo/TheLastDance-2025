import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ToastAndroid,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import FormLayout from "../../Layouts/formLayout";
import TextField from "../../components/form/TextField";
import ImageField from "../../components/form/ImageField";
import CUILField from "../../components/form/CUILField";
import {
  useRegisterForm,
  FormDataType,
} from "../../Hooks/register/useRegisterForm";
import { useAuthActions } from "../../auth/useAuthActions";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useRef } from "react";
import { Logger } from "../../utils/Logger";

type Props = NativeStackScreenProps<RootStackParamList, "Registro">;

type CameraMode = "photo" | "dni" | null;

export const RegisterScreen = ({ navigation }: Props) => {
  const { actionLoading, handleRegister: register } = useAuthActions();
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);

  // Función para parsear el código PDF417 del DNI argentino
  const parseDNIData = (
    data: string,
  ): { dni?: string; firstName?: string; lastName?: string } => {
    try {
      Logger.debug("Datos escaneados:", data);

      // El formato típico del PDF417 del DNI argentino puede tener diferentes estructuras
      const fields = data.split("@");

      // Variables para almacenar los datos extraídos
      let dni = "";
      let lastName = "";
      let firstName = "";

      // Buscar el DNI que debe ser un número de 7-8 dígitos
      for (const field of fields) {
        const trimmedField = field.trim();
        // Verificar si es un número de 7-8 dígitos (formato típico del DNI)
        if (/^\d{7,8}$/.test(trimmedField)) {
          dni = trimmedField;
          break;
        }
      }

      // Si no encontramos el DNI de esa manera, intentar con patrones más específicos
      if (!dni) {
        // Buscar patrones como "DNI: 12345678" o simplemente números largos
        const dniMatch = data.match(/\b(\d{7,8})\b/);
        if (dniMatch) {
          dni = dniMatch[1];
        }
      }

      Logger.debug("Campos separados:", fields);

      if (fields.length >= 5) {
        // Extraer datos según la estructura conocida
        lastName = fields[1]?.trim() || "";
        firstName = fields[2]?.trim() || "";

        // Verificar si el DNI está en la posición 4
        const dniFromPosition = fields[4]?.trim() || "";
        if (/^\d{7,8}$/.test(dniFromPosition)) {
          dni = dniFromPosition;
        }
      }

      // Limpiar y validar nombres
      if (firstName) {
        // Remover caracteres especiales pero mantener espacios y letras con acentos
        firstName = firstName.replace(/[^\p{L}\s]/gu, "").trim();

        // Solo procesar si tiene más de 1 carácter (evitar "M", "F", etc.)
        if (firstName.length > 1) {
          // Capitalizar correctamente
          firstName = firstName
            .toLowerCase()
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        } else {
          firstName = "";
        }
      }

      if (lastName) {
        // Remover caracteres especiales pero mantener espacios y letras con acentos
        lastName = lastName.replace(/[^\p{L}\s]/gu, "").trim();

        // Solo procesar si tiene más de 1 carácter
        if (lastName.length > 1) {
          // Capitalizar correctamente
          lastName = lastName
            .toLowerCase()
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        } else {
          lastName = "";
        }
      }

      // Construir resultado solo con datos válidos
      const result: { dni?: string; firstName?: string; lastName?: string } =
        {};

      if (dni) result.dni = dni;
      if (firstName && firstName.length > 1) result.firstName = firstName;
      if (lastName && lastName.length > 1) result.lastName = lastName;

      Logger.debug("Datos extraídos:", result);

      return result;
    } catch (error) {
      Logger.error("Error parseando datos del DNI:", error);
      return {};
    }
  };
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    const { dni, firstName, lastName } = parseDNIData(data);

    if (dni) {
      // Actualizar DNI
      handleInputChange("dni", dni);

      // Obtener el CUIL actual para preservar el primer y último dígito si ya están completados
      const currentCuil = formData.cuil || "--";
      const cuilParts = currentCuil.split("-");
      const firstDigits = cuilParts[0] || "";
      const lastDigit = cuilParts[2] || "";
      
      // Crear el formato de CUIL con el DNI en el medio, preservando lo que ya estaba
      const cuilFormat = `${firstDigits}-${dni}-${lastDigit}`;
      handleInputChange("cuil", cuilFormat);

      // Actualizar nombres si se pudieron extraer
      if (firstName) {
        handleInputChange("first_name", firstName);
      }

      if (lastName) {
        handleInputChange("last_name", lastName);
      }

      setShowCamera(false);
      setCameraMode(null);

      // Crear mensaje informativo
      let message = `DNI ${dni} cargado`;
      const loadedFields = [];

      if (firstName) loadedFields.push("nombre");
      if (lastName) loadedFields.push("apellido");

      if (loadedFields.length > 0) {
        message += `, ${loadedFields.join(" y ")} completado${loadedFields.length > 1 ? "s" : ""}`;
      }

      message += ". Completa los primeros 2 dígitos y el último dígito del CUIL";

      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      ToastAndroid.show(
        "No se pudo leer el DNI. Inténtalo de nuevo o completa manualmente.",
        ToastAndroid.SHORT,
      );
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: false,
        });
        const photoFile = {
          uri: photo.uri,
          type: "image/jpeg",
          name: "photo.jpg",
        };
        handleInputChange("file", photoFile);
        setShowCamera(false);
        setCameraMode(null);
      } catch (error) {
        Logger.error("Error tomando la foto:", error);
        ToastAndroid.show("Error al tomar la foto", ToastAndroid.SHORT);
      }
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        ToastAndroid.show(
          "Se necesita permiso para acceder a la galería",
          ToastAndroid.SHORT,
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const photoFile = {
          uri: result.assets[0].uri,
          type: "image/jpeg",
          name: "photo.jpg",
        };
        handleInputChange("file", photoFile);
        ToastAndroid.show(
          "Foto seleccionada correctamente",
          ToastAndroid.SHORT,
        );
      }
    } catch (error) {
      Logger.error("Error seleccionando imagen:", error);
      ToastAndroid.show("Error al seleccionar imagen", ToastAndroid.SHORT);
    }
  };

  const selectPhotoOption = () => {
    Alert.alert("Seleccionar foto", "¿Cómo deseas agregar la foto?", [
      {
        text: "Tomar foto",
        onPress: () => openCamera("photo"),
      },
      {
        text: "Galería",
        onPress: pickImageFromGallery,
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  };

  const toggleCameraType = () => {
    setFacing(current => (current === "back" ? "front" : "back"));
  };

  const openCamera = async (mode: CameraMode) => {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        ToastAndroid.show(
          "Se necesita permiso para usar la cámara",
          ToastAndroid.SHORT,
        );
        return;
      }
    }

    setCameraMode(mode);
    setShowCamera(true);
  };

  const showDNIOptions = () => {
    Alert.alert("Completar DNI", "¿Cómo deseas completar el DNI?", [
      {
        text: "Escanear DNI",
        onPress: () => openCamera("dni"),
      },
      {
        text: "Completar manualmente",
        style: "cancel",
      },
    ]);
  };

  const onSubmit = async (data: FormDataType) => {
    const fd = new FormData();
    fd.append("first_name", data.first_name.trim());
    fd.append("last_name", data.last_name.trim());
    fd.append("email", data.email.trim());
    fd.append("password", data.password);
    fd.append("dni", data.dni.trim());
    fd.append("cuil", data.cuil.trim());
    fd.append("profile_code", "cliente_registrado");
    if (data.file) fd.append("file", data.file as any);

    const result = await register(fd);
    if (result?.success) {
      ToastAndroid.show("¡Cuenta creada exitosamente!", ToastAndroid.LONG);
      setTimeout(() => navigation.navigate("Login"), 800);
    }
  };

  const {
    formData,
    errors,
    loading,
    handleInputChange,
    handleBlur,
    pickImage,
    handleSubmit,
  } = useRegisterForm(onSubmit, "registered");

  const [focused, setFocused] = useState<string>("");

  if (!permission) {
    // Los permisos aún se están cargando
    return <View />;
  }

  return (
    <>
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
        {/* Botón de Escanear DNI - Opción más pequeña */}
        <View className="mb-4">
          <TouchableOpacity
            onPress={showDNIOptions}
            className="bg-blue-600/20 px-4 py-2 rounded-lg border border-blue-500/30 self-start"
          >
            <View className="flex-row items-center">
              <Text className="text-blue-300 text-lg font-medium">Escanear DNI</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Layout con Nombre/Apellido y Foto */}
        <View className="flex-row mb-4 gap-3" style={{ minHeight: 140 }}>
          {/* Columna izquierda: Nombre y Apellido */}
          <View className="flex-1">
            <Text className="text-white text-sm font-medium mb-1">Nombre</Text>
            <TextField
              placeholder="Nombre"
              value={formData.first_name}
              onChangeText={v => handleInputChange("first_name", v)}
              onBlur={() => handleBlur("first_name")}
              focused={focused === "first_name"}
              onFocus={() => setFocused("first_name")}
              error={errors.first_name}
            />
            <Text className="text-white text-sm font-medium mb-1">Apellido</Text>
            <TextField
              placeholder="Apellido"
              value={formData.last_name}
              onChangeText={v => handleInputChange("last_name", v)}
              onBlur={() => handleBlur("last_name")}
              focused={focused === "last_name"}
              onFocus={() => setFocused("last_name")}
              error={errors.last_name}
            />
          </View>

          {/* Columna derecha: Foto (ocupa altura de ambos campos) */}
          <View className="flex-1">
            <ImageField
              label="Foto"
              image={formData.file}
              onPick={selectPhotoOption}
              onClear={() => {
                handleInputChange("file", null);
              }}
              error={errors.file}
              focused={focused === "file"}
            />
          </View>
        </View>
        <Text className="text-white text-sm font-medium mb-1">DNI</Text>
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

        <CUILField
          value={formData.cuil}
          onChangeText={v => handleInputChange("cuil", v)}
          onBlur={() => handleBlur("cuil")}
          focused={focused === "cuil"}
          onFocus={() => setFocused("cuil")}
          error={errors.cuil}
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
          placeholder="Confirmar contraseña"
          value={formData.confirmPassword}
          onChangeText={v => handleInputChange("confirmPassword", v)}
          onBlur={() => handleBlur("confirmPassword")}
          secureTextEntry
          focused={focused === "confirmPassword"}
          onFocus={() => setFocused("confirmPassword")}
          error={errors.confirmPassword}
        />
      </FormLayout>

      <Modal visible={showCamera} animationType="slide">
        <View className="flex-1 bg-black">
          {permission.granted && (
            <>
              {cameraMode === "dni" ? (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ["pdf417"],
                  }}
                  onBarcodeScanned={handleBarCodeScanned}
                >
                  <View className="flex-1 justify-center items-center">
                    <View className="border-2 border-white w-80 h-48 rounded-lg">
                      <Text className="text-white text-center mt-2 text-sm">
                        Coloca el código de barras del DNI dentro del marco
                      </Text>
                      <Text className="text-white text-center mt-1 text-xs opacity-75">
                        Asegúrate de que esté bien iluminado
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setShowCamera(false);
                        setCameraMode(null);
                      }}
                      className="bg-red-500 p-4 rounded-full mt-8"
                    >
                      <Text className="text-white font-bold">Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </CameraView>
              ) : (
                <CameraView
                  ref={cameraRef}
                  facing={facing}
                  style={{
                    flex: 1,
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <View className="flex-1 justify-end pb-8">
                    <View className="flex-row justify-around items-center">
                      <TouchableOpacity
                        onPress={() => {
                          setShowCamera(false);
                          setCameraMode(null);
                        }}
                        className="bg-red-500 p-4 rounded-full"
                      >
                        <Text className="text-white font-bold">Cancelar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={takePicture}
                        className="bg-white p-6 rounded-full"
                      />

                      <TouchableOpacity
                        onPress={toggleCameraType}
                        className="bg-gray-500 p-4 rounded-full"
                      >
                        <Text className="text-white font-bold">Voltear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </CameraView>
              )}
            </>
          )}
        </View>
      </Modal>
    </>
  );
};
