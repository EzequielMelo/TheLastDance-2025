import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ToastAndroid,
  Modal,
  Alert,
} from "react-native";
import { Table, ImagePlus, Users, Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import FormLayout from "../../Layouts/formLayout";
import api from "../../api/axios";
import { useAuth } from "../../auth/AuthContext";

type ImageSlot = { uri: string; name: string; type: string } | null;

export default function CreateTableScreen({ navigation }: any) {
  const { user: currentUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [type, setType] = useState<"vip" | "estandar" | "accesible">("vip");
  const [images, setImages] = useState<[ImageSlot, ImageSlot]>([null, null]);
  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");

  // Solo dueño y supervisor pueden crear mesas
  const canCreate =
    currentUser?.profile_code === "dueno" ||
    currentUser?.profile_code === "supervisor";

  // Función para seleccionar desde galería
  const pickFromGallery = async (index: 0 | 1) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      ToastAndroid.show(
        "Permiso denegado para acceder a la galería",
        ToastAndroid.LONG,
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      const uri = a.uri;
      const name =
        a.fileName || uri.split("/").pop() || `image_${index + 1}.jpg`;
      const ext = (name.split(".").pop() || "jpg").toLowerCase();
      const type = ext === "png" ? "image/png" : "image/jpeg";
      const next = [...images] as [ImageSlot, ImageSlot];
      next[index] = { uri, name, type };
      setImages(next);
      const imageType = index === 0 ? "Foto de la mesa" : "Código QR";
      ToastAndroid.show(`${imageType} lista ✔️`, ToastAndroid.SHORT);
    }
  };

  // Función para abrir cámara (solo para foto de mesa - index 0)
  const openCamera = async () => {
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

    setShowCamera(true);
  };

  // Función para tomar foto
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
          name: "mesa_photo.jpg",
        };
        const next = [...images] as [ImageSlot, ImageSlot];
        next[0] = photoFile; // Solo para foto de mesa (index 0)
        setImages(next);
        setShowCamera(false);
        ToastAndroid.show("Foto de la mesa capturada ✔️", ToastAndroid.SHORT);
      } catch (error) {
        console.error("Error tomando la foto:", error);
        ToastAndroid.show("Error al tomar la foto", ToastAndroid.SHORT);
      }
    }
  };

  // Función para alternar cámara
  const toggleCameraType = () => {
    setFacing(current => (current === "back" ? "front" : "back"));
  };

  // Función para mostrar opciones de foto de mesa
  const showPhotoOptions = () => {
    Alert.alert("Foto de la mesa", "¿Cómo deseas agregar la foto?", [
      {
        text: "Tomar foto",
        onPress: () => openCamera(),
      },
      {
        text: "Seleccionar de galería",
        onPress: () => pickFromGallery(0),
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  };

  // Función para manejar QR (solo galería)
  const pickQR = () => {
    pickFromGallery(1);
  };

  const removeAt = (index: 0 | 1) => {
    const next = [...images] as [ImageSlot, ImageSlot];
    next[index] = null;
    setImages(next);
  };

  const validate = () => {
    if (!canCreate) {
      ToastAndroid.show(
        "No tenés permisos para crear mesas",
        ToastAndroid.LONG,
      );
      return false;
    }

    const tableNumber = Number(number);
    if (!tableNumber || tableNumber <= 0) {
      ToastAndroid.show("Número de mesa inválido", ToastAndroid.SHORT);
      return false;
    }

    const tableCapacity = Number(capacity);
    if (!tableCapacity || tableCapacity <= 0) {
      ToastAndroid.show("Capacidad inválida", ToastAndroid.SHORT);
      return false;
    }

    if (!images[0] || !images[1]) {
      ToastAndroid.show(
        "Necesitás 2 imágenes: foto de la mesa y código QR",
        ToastAndroid.SHORT,
      );
      return false;
    }

    return true;
  };

  const onSubmit = async () => {
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);

    const selected = images.filter(Boolean);
    if (selected.length !== 2) {
      ToastAndroid.show(
        "Debés seleccionar exactamente 2 imágenes.",
        ToastAndroid.LONG,
      );
      setIsSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.append("number", String(Number(number)));
    fd.append("capacity", String(Number(capacity)));
    fd.append("type", type);

    // Agregar las imágenes usando el mismo patrón que menu
    selected.forEach((img: any) => {
      fd.append("images", {
        uri: img.uri,
        name: img.name ?? `table_image_${Date.now()}.jpg`,
        type: img.type ?? "image/jpeg",
      } as any);
    });

    try {
      const url = `${api.defaults.baseURL}/admin/tables`;
      const token = await SecureStore.getItemAsync("authToken");

      if (!token) {
        ToastAndroid.show(
          "Sesión inválida. Volvé a iniciar sesión.",
          ToastAndroid.LONG,
        );
        setIsSubmitting(false);
        return;
      }

      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        let msg = text;
        try {
          const parsed = JSON.parse(text);
          msg = parsed?.error || parsed?.message || text;
        } catch {}
        throw new Error(msg || `HTTP ${resp.status}`);
      }

      ToastAndroid.show("Mesa creada correctamente ✔️", ToastAndroid.LONG);
      navigation.goBack();
    } catch (e: any) {
      ToastAndroid.show(e?.message || "Error creando mesa", ToastAndroid.LONG);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si no tiene permisos, mostrar pantalla de error
  if (!canCreate) {
    return (
      <FormLayout
        title="Sin permisos"
        subtitle="Tu perfil no puede crear mesas"
        icon={<Table size={50} color="#d4af37" strokeWidth={1.5} />}
        submitLabel="Volver"
        onSubmit={() => navigation.goBack()}
        loading={false}
        showDivider={false}
      >
        <Text className="text-gray-300 text-base">
          Solo <Text className="text-[#d4af37]">Dueño</Text> y{" "}
          <Text className="text-[#d4af37]">Supervisor</Text> pueden crear mesas.
        </Text>
      </FormLayout>
    );
  }

  return (
    <>
      <FormLayout
        title="Nueva Mesa"
        subtitle="Agregá una mesa al restaurante"
        icon={<Table size={50} color="#d4af37" />}
        submitLabel="Crear Mesa"
        onSubmit={onSubmit}
        loading={isSubmitting}
        bottomText=" "
        bottomLinkText=" "
        onBottomLinkPress={() => {}}
        showDivider={false}
      >
        {/* Número de mesa */}
        <InputRow
          placeholder="Número de mesa"
          value={number}
          onChangeText={setNumber}
          keyboardType="numeric"
        />

        {/* Capacidad */}
        <InputRow
          placeholder="Capacidad (personas)"
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="numeric"
        />

        {/* Tipo de mesa */}
        <View className="mb-3">
          <Text className="text-gray-300 mb-1">Ubicación</Text>
          <View className="flex-row gap-2">
            <Tag
              label="Mesa VIP"
              active={type === "vip"}
              onPress={() => setType("vip")}
            />
            <Tag
              label="Mesa común"
              active={type === "estandar"}
              onPress={() => setType("estandar")}
            />
            <Tag
              label="Mesa accesible"
              active={type === "accesible"}
              onPress={() => setType("accesible")}
            />
          </View>
        </View>

        {/* Imágenes (2) */}
        <Text className="text-gray-300 mt-4 mb-2">Imágenes (2)</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-400 text-xs text-center flex-1">
                Foto de la mesa
              </Text>
              <TouchableOpacity
                onPress={showPhotoOptions}
                className="bg-blue-500 px-2 py-1 rounded ml-2"
              >
                <Camera size={12} color="white" />
              </TouchableOpacity>
            </View>
            <ImageSlotView
              slot={images[0]}
              onPick={showPhotoOptions}
              onRemove={() => removeAt(0)}
              isLarge
            />
          </View>
          <View className="flex-1">
            <Text className="text-gray-400 text-xs mb-2 text-center">
              Código QR
            </Text>
            <ImageSlotView
              slot={images[1]}
              onPick={pickQR}
              onRemove={() => removeAt(1)}
              isLarge
            />
          </View>
        </View>
      </FormLayout>

      {/* Modal de Cámara */}
      <Modal visible={showCamera} animationType="slide">
        <View className="flex-1 bg-black">
          {permission?.granted && (
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
                    onPress={() => setShowCamera(false)}
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
        </View>
      </Modal>
    </>
  );
}

function Tag({
  label,
  active,
  onPress,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      className={`px-4 py-2 rounded-full border ${
        active ? "bg-[#d4af37] border-[#d4af37]" : "bg-white/10 border-white/20"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <Text className={active ? "text-black" : "text-white"}>{label}</Text>
    </TouchableOpacity>
  );
}

function InputRow({
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  multiline = false,
  numberOfLines = 1,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View className="mb-3">
      <View className="rounded-xl border px-4 bg-white/10 border-white/20">
        <TextInput
          className="text-white text-base py-3"
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
      </View>
    </View>
  );
}

function ImageSlotView({
  slot,
  onPick,
  onRemove,
  isLarge = false,
}: {
  slot: ImageSlot;
  onPick: () => void;
  onRemove: () => void;
  isLarge?: boolean;
}) {
  const sizeClass = isLarge ? "h-32" : "w-24 h-24";

  return (
    <View
      className={`${sizeClass} rounded-xl overflow-hidden bg-white/10 border border-white/20 items-center justify-center`}
    >
      {slot ? (
        <>
          <Image source={{ uri: slot.uri }} className="w-full h-full" />
          <TouchableOpacity
            onPress={onRemove}
            className="absolute top-1 right-1 bg-black/60 px-2 py-1 rounded"
          >
            <Text className="text-white text-xs">Quitar</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          onPress={onPick}
          className="items-center justify-center"
        >
          <ImagePlus size={26} color="#888" />
          <Text className="text-gray-400 text-xs mt-1">Agregar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
