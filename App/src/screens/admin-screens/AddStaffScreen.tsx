import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ToastAndroid,
  Alert,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useRef, useMemo } from "react";
import FormLayout from "../../Layouts/formLayout";
import TextField from "../../components/form/TextField";
import ImageField from "../../components/form/ImageField";
import { Picker } from "@react-native-picker/picker";
import api from "../../api/axios";
import { RootStackParamList } from "../../navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, "AddStaff">;

interface FormData {
  first_name: string;
  last_name: string;
  dni: string;
  cuil: string;
  email: string;
  password: string;
  profile_code: "empleado" | "supervisor";
  position_code: "cocinero" | "bartender" | "maitre" | "mozo" | "";
  file: any;
}

interface FormErrors {
  [key: string]: string;
}

export const AddStaffScreen = ({ navigation, route }: Props) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "dni" | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string>("");
  const cameraRef = useRef<CameraView>(null);

  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    dni: "",
    cuil: "",
    email: "",
    password: "",
    profile_code: "empleado",
    position_code: "cocinero",
    file: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Determinar qué perfiles están disponibles según el rol del usuario
  const userRole = route.params.userRole;
  const availableProfiles = useMemo(() => {
    if (userRole === "dueno") {
      return [
        { label: "Empleado", value: "empleado" },
        { label: "Supervisor", value: "supervisor" }
      ];
    } else {
      // supervisor solo puede crear empleados
      return [
        { label: "Empleado", value: "empleado" }
      ];
    }
  }, [userRole]);

  // Título dinámico según el rol
  const screenTitle = useMemo(() => {
    if (userRole === "dueno") {
      return "Agregar Personal";
    } else {
      return "Agregar Empleado";
    }
  }, [userRole]);

  const screenSubtitle = useMemo(() => {
    if (userRole === "dueno") {
      return "Crear nueva cuenta de empleado o supervisor";
    } else {
      return "Crear nueva cuenta de empleado";
    }
  }, [userRole]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validar nombres
    if (!formData.first_name.trim()) {
      newErrors.first_name = "El nombre es obligatorio";
    } else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(formData.first_name.trim())) {
      newErrors.first_name = "El nombre solo puede contener letras";
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = "El apellido es obligatorio";
    } else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(formData.last_name.trim())) {
      newErrors.last_name = "El apellido solo puede contener letras";
    }

    // Validar DNI
    if (!formData.dni.trim()) {
      newErrors.dni = "El DNI es obligatorio";
    } else if (!/^\d{7,8}$/.test(formData.dni.trim())) {
      newErrors.dni = "El DNI debe tener 7 u 8 dígitos";
    }

    // Validar CUIL
    if (!formData.cuil.trim()) {
      newErrors.cuil = "El CUIL es obligatorio";
    } else if (!/^\d{2}-\d{7,8}-\d{1}$/.test(formData.cuil.trim())) {
      newErrors.cuil = "El CUIL debe tener formato XX-XXXXXXXX-X";
    }

    // Validar email
    if (!formData.email.trim()) {
      newErrors.email = "El email es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "El email no tiene un formato válido";
    }

    // Validar contraseña
    if (!formData.password) {
      newErrors.password = "La contraseña es obligatoria";
    } else if (formData.password.length < 6) {
      newErrors.password = "La contraseña debe tener al menos 6 caracteres";
    }

    // Validar perfil y posición
    if (!formData.profile_code) {
      newErrors.profile_code = "El perfil es obligatorio";
    }

    if (formData.profile_code === "empleado" && !formData.position_code) {
      newErrors.position_code = "La posición es obligatoria para empleados";
    }

    // Validar foto
    if (!formData.file) {
      newErrors.file = "La foto es obligatoria";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const parseDNIData = (
    data: string,
  ): { dni?: string; firstName?: string; lastName?: string } => {
    try {
      console.log("Datos escaneados:", data);
      const fields = data.split("@");

      let dni = "";
      let lastName = "";
      let firstName = "";

      // Buscar DNI
      for (const field of fields) {
        const trimmedField = field.trim();
        if (/^\d{7,8}$/.test(trimmedField)) {
          dni = trimmedField;
          break;
        }
      }

      if (!dni) {
        const dniMatch = data.match(/\b(\d{7,8})\b/);
        if (dniMatch) {
          dni = dniMatch[1];
        }
      }

      console.log("Campos separados:", fields);

      if (fields.length >= 5) {
        lastName = fields[1]?.trim() || "";
        firstName = fields[2]?.trim() || "";

        const dniFromPosition = fields[4]?.trim() || "";
        if (/^\d{7,8}$/.test(dniFromPosition)) {
          dni = dniFromPosition;
        }
      }

      // Limpiar nombres
      if (firstName) {
        firstName = firstName.replace(/[^\p{L}\s]/gu, "").trim();
        if (firstName.length > 1) {
          firstName = firstName
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        } else {
          firstName = "";
        }
      }

      if (lastName) {
        lastName = lastName.replace(/[^\p{L}\s]/gu, "").trim();
        if (lastName.length > 1) {
          lastName = lastName
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        } else {
          lastName = "";
        }
      }

      const result: { dni?: string; firstName?: string; lastName?: string } = {};
      if (dni) result.dni = dni;
      if (firstName && firstName.length > 1) result.firstName = firstName;
      if (lastName && lastName.length > 1) result.lastName = lastName;

      console.log("Datos extraídos:", result);
      return result;
    } catch (error) {
      console.error("Error parseando datos del DNI:", error);
      return {};
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    const { dni, firstName, lastName } = parseDNIData(data);

    if (dni) {
      handleInputChange("dni", dni);
      const cuilFormat = `__-${dni}-_`;
      handleInputChange("cuil", cuilFormat);

      if (firstName) {
        handleInputChange("first_name", firstName);
      }

      if (lastName) {
        handleInputChange("last_name", lastName);
      }

      setShowCamera(false);
      setCameraMode(null);

      let message = `DNI ${dni} cargado`;
      const loadedFields = [];

      if (firstName) loadedFields.push("nombre");
      if (lastName) loadedFields.push("apellido");

      if (loadedFields.length > 0) {
        message += `, ${loadedFields.join(" y ")} completado${
          loadedFields.length > 1 ? "s" : ""
        }`;
      }

      message += ". Completa los dígitos del CUIL";
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
        ToastAndroid.show("Foto capturada correctamente", ToastAndroid.SHORT);
      } catch (error) {
        console.error("Error tomando la foto:", error);
        ToastAndroid.show("Error al tomar la foto", ToastAndroid.SHORT);
      }
    }
  };

  const openCamera = async (mode: "photo" | "dni") => {
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

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        ToastAndroid.show(
          "Se necesita permiso para acceder a la galería",
          ToastAndroid.SHORT
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
        ToastAndroid.show("Foto seleccionada correctamente", ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error("Error seleccionando imagen:", error);
      ToastAndroid.show("Error al seleccionar la imagen", ToastAndroid.SHORT);
    }
  };

  const showPhotoOptions = () => {
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      ToastAndroid.show("Por favor corrige los errores en el formulario", ToastAndroid.LONG);
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("first_name", formData.first_name.trim());
      formDataToSend.append("last_name", formData.last_name.trim());
      formDataToSend.append("email", formData.email.trim());
      formDataToSend.append("password", formData.password);
      formDataToSend.append("dni", formData.dni.trim());
      formDataToSend.append("cuil", formData.cuil.trim());
      formDataToSend.append("profile_code", formData.profile_code);
      
      if (formData.profile_code === "empleado") {
        formDataToSend.append("position_code", formData.position_code);
      }
      
      if (formData.file) {
        formDataToSend.append("file", formData.file as any);
      }

      console.log('Enviando datos del staff:', {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        dni: formData.dni.trim(),
        cuil: formData.cuil.trim(),
        profile_code: formData.profile_code,
        position_code: formData.profile_code === "empleado" ? formData.position_code : null,
        hasFile: !!formData.file
      });

      const response = await api.post('/admin/users/staff', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('Respuesta del servidor:', response.data);
      ToastAndroid.show("¡Staff creado exitosamente!", ToastAndroid.LONG);
      navigation.goBack();
    } catch (error: any) {
      console.error("Error creando staff:", error);
      console.error("Error response:", error?.response?.data);
      ToastAndroid.show(
        error?.response?.data?.error || "Error al crear el staff",
        ToastAndroid.LONG
      );
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View />;
  }

  return (
    <>
      <FormLayout
        title={screenTitle}
        subtitle={screenSubtitle}
        submitLabel="Crear Personal"
        onSubmit={handleSubmit}
        loading={loading}
        bottomText=""
        bottomLinkText=""
        onBottomLinkPress={() => {}}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <TextField
            placeholder="Nombre"
            value={formData.first_name}
            onChangeText={(v) => handleInputChange("first_name", v)}
            focused={focused === "first_name"}
            onFocus={() => setFocused("first_name")}
            error={errors.first_name}
          />

          <TextField
            placeholder="Apellido"
            value={formData.last_name}
            onChangeText={(v) => handleInputChange("last_name", v)}
            focused={focused === "last_name"}
            onFocus={() => setFocused("last_name")}
            error={errors.last_name}
          />

          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white text-sm font-medium">DNI</Text>
              <TouchableOpacity
                onPress={showDNIOptions}
                className="bg-blue-500 px-3 py-1 rounded"
              >
                <Text className="text-white text-xs">Escanear DNI</Text>
              </TouchableOpacity>
            </View>

            <TextField
              placeholder="DNI"
              value={formData.dni}
              onChangeText={(v) => handleInputChange("dni", v)}
              keyboardType="phone-pad"
              focused={focused === "dni"}
              onFocus={() => setFocused("dni")}
              error={errors.dni}
            />
          </View>

          <View>
            <Text className="text-white text-sm font-medium mb-1">CUIL</Text>
            <Text className="text-gray-400 text-xs mb-2">
              Formato: XX-XXXXXXXX-X (completa los dígitos faltantes)
            </Text>
            <TextField
              placeholder="Ej: 20-12345678-9"
              value={formData.cuil}
              onChangeText={(v) => handleInputChange("cuil", v)}
              keyboardType="phone-pad"
              focused={focused === "cuil"}
              onFocus={() => setFocused("cuil")}
              error={errors.cuil}
            />
          </View>

          <TextField
            placeholder="Correo electrónico"
            value={formData.email}
            onChangeText={(v) => handleInputChange("email", v)}
            keyboardType="email-address"
            focused={focused === "email"}
            onFocus={() => setFocused("email")}
            error={errors.email}
          />

          <TextField
            placeholder="Contraseña"
            value={formData.password}
            onChangeText={(v) => handleInputChange("password", v)}
            secureTextEntry
            focused={focused === "password"}
            onFocus={() => setFocused("password")}
            error={errors.password}
          />

          <View className="mb-4">
            <Text className="text-white text-sm font-medium mb-2">Perfil</Text>
            <View className="bg-gray-800 rounded-lg border border-gray-600">
              <Picker
                selectedValue={formData.profile_code}
                onValueChange={(value) => handleInputChange("profile_code", value)}
                style={{ color: "white" }}
                dropdownIconColor="white"
              >
                {availableProfiles.map((profile) => (
                  <Picker.Item 
                    key={profile.value} 
                    label={profile.label} 
                    value={profile.value} 
                  />
                ))}
              </Picker>
            </View>
            {errors.profile_code && (
              <Text className="text-red-400 text-xs mt-1">{errors.profile_code}</Text>
            )}
          </View>

          {formData.profile_code === "empleado" && (
            <View className="mb-4">
              <Text className="text-white text-sm font-medium mb-2">Posición</Text>
              <View className="bg-gray-800 rounded-lg border border-gray-600">
                <Picker
                  selectedValue={formData.position_code}
                  onValueChange={(value) => handleInputChange("position_code", value)}
                  style={{ color: "white" }}
                  dropdownIconColor="white"
                >
                  <Picker.Item label="Cocinero" value="cocinero" />
                  <Picker.Item label="Bartender" value="bartender" />
                  <Picker.Item label="Maitre" value="maitre" />
                  <Picker.Item label="Mozo" value="mozo" />
                </Picker>
              </View>
              {errors.position_code && (
                <Text className="text-red-400 text-xs mt-1">{errors.position_code}</Text>
              )}
            </View>
          )}

          <ImageField
            label="Foto Personal"
            image={formData.file}
            onPick={showPhotoOptions}
            onClear={() => handleInputChange("file", null)}
            error={errors.file}
            focused={focused === "file"}
          />
        </ScrollView>
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
                  style={{ flex: 1 }}
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
                        onPress={() => setFacing((current) => (current === "back" ? "front" : "back"))}
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
