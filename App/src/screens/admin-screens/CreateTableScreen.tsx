import React, { useState, useRef, useEffect } from "react";
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
import {
  Table,
  ImagePlus,
  Users,
  Camera,
  QrCode,
  CheckCircle,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";
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
  const [qrGenerated, setQrGenerated] = useState(false);
  const [debugQR, setDebugQR] = useState(false); // Para debug
  const [qrMounted, setQrMounted] = useState(false);
  const qrRef = useRef<View>(null);
  const debugQrRef = useRef<View>(null);

  // Solo dueño y supervisor pueden crear mesas
  const canCreate =
    currentUser?.profile_code === "dueno" ||
    currentUser?.profile_code === "supervisor";

  // Montar el componente QR cuando hay número
  useEffect(() => {
    if (number && Number(number) > 0) {
      setQrMounted(true);
      setQrGenerated(false);
      // Limpiar QR anterior
      const next = [...images] as [ImageSlot, ImageSlot];
      next[1] = null;
      setImages(next);
    } else {
      setQrMounted(false);
      setQrGenerated(false);
    }
  }, [number]);

  // Función para capturar QR
  const captureQRImage = async (
    ref: React.RefObject<View | null>,
    source: string,
  ) => {
    if (!ref.current) {
      console.log(`${source} QR ref no disponible`);
      return null;
    }

    try {
      console.log(`Capturando QR desde ${source}...`);

      const uri = await captureRef(ref.current, {
        format: "png",
        quality: 1.0,
        result: "tmpfile",
        height: 400,
        width: 400,
      });

      console.log(`QR capturado desde ${source}:`, uri);
      return uri;
    } catch (error) {
      console.error(`Error capturando QR desde ${source}:`, error);
      return null;
    }
  };

  // Generar QR automáticamente cuando se monta (pero no capturar todavía)
  useEffect(() => {
    if (qrMounted && !qrGenerated) {
      // Marcar como generado después de un breve delay para que se renderice
      const timeout = setTimeout(() => {
        setQrGenerated(true);
        ToastAndroid.show("QR de mesa listo ✔️", ToastAndroid.SHORT);
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [qrMounted, qrGenerated]);

  // Regenerar QR cuando cambie el número de mesa
  useEffect(() => {
    if (number && Number(number) > 0 && qrGenerated) {
      setQrGenerated(false);
      const next = [...images] as [ImageSlot, ImageSlot];
      next[1] = null; // Limpiar QR anterior
      setImages(next);
    }
  }, [number]);

  // Generar el contenido del QR con deeplink
  const generateQRContent = (tableNumber: string, tableId?: string) => {
    // Si tenemos el ID real de la mesa, usarlo; sino usar el número temporalmente
    // Formato: thelastdance://table/{tableId}
    const idToUse = tableId || tableNumber;
    return `thelastdance://table/${idToUse}`;
  };

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

  const removeAt = (index: 0) => {
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

    if (!images[0]) {
      ToastAndroid.show(
        "Necesitás agregar una foto de la mesa",
        ToastAndroid.SHORT,
      );
      return false;
    }

    if (!qrGenerated) {
      ToastAndroid.show(
        "Esperá a que se genere el código QR",
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
        !images[0]
          ? "Falta la foto de la mesa"
          : !images[1]
            ? "Falta generar el QR. Presiona 'Generar QR' primero."
            : "Se necesitan ambas imágenes para crear la mesa.",
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

      const result = await resp.json();

      ToastAndroid.show("Mesa creada correctamente ✔️", ToastAndroid.LONG);

      // Mostrar el ID de la mesa creada para debug
      if (result?.id) {
        console.log("Mesa creada con ID:", result.id);
        ToastAndroid.show(
          `Mesa creada con ID: ${result.id}`,
          ToastAndroid.SHORT,
        );
      }

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

        {/* Imágenes */}
        <Text className="text-gray-300 mt-4 mb-2">Imágenes</Text>
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
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-400 text-xs text-center flex-1">
                Código QR
              </Text>
              <View className="flex-row items-center">
                {qrGenerated && !images[1] && (
                  <TouchableOpacity
                    onPress={async () => {
                      ToastAndroid.show("Generando QR...", ToastAndroid.SHORT);

                      // Abrir el debug QR
                      setDebugQR(true);

                      // Esperar a que se renderice
                      await new Promise(resolve => setTimeout(resolve, 500));

                      // Capturar automáticamente
                      const uri = await captureQRImage(debugQrRef, "debug");
                      if (uri) {
                        const qrImage: ImageSlot = {
                          uri,
                          name: `table_${number}_qr.png`,
                          type: "image/png",
                        };

                        const next = [...images] as [ImageSlot, ImageSlot];
                        next[1] = qrImage;
                        setImages(next);

                        ToastAndroid.show(
                          "QR generado exitosamente!",
                          ToastAndroid.SHORT,
                        );
                      }

                      // Cerrar el debug después de un momento
                      setTimeout(() => setDebugQR(false), 1000);
                    }}
                    className="bg-green-500 px-3 py-1 rounded mr-2"
                  >
                    <Text className="text-white text-xs font-semibold">
                      Generar QR
                    </Text>
                  </TouchableOpacity>
                )}

                {qrGenerated && images[1] && (
                  <TouchableOpacity
                    onPress={() => setDebugQR(!debugQR)}
                    className="bg-blue-500 px-3 py-1 rounded mr-2"
                  >
                    <Text className="text-white text-xs font-semibold">
                      {debugQR ? "Ocultar" : "Ver QR"}
                    </Text>
                  </TouchableOpacity>
                )}

                {qrGenerated && debugQR && !images[1] && (
                  <TouchableOpacity
                    onPress={async () => {
                      console.log("Capturando QR manualmente...");
                      const uri = await captureQRImage(debugQrRef, "debug");
                      if (uri) {
                        const qrImage: ImageSlot = {
                          uri,
                          name: `table_${number}_qr.png`,
                          type: "image/png",
                        };

                        const next = [...images] as [ImageSlot, ImageSlot];
                        next[1] = qrImage;
                        setImages(next);
                        ToastAndroid.show(
                          "QR capturado para envío ✔️",
                          ToastAndroid.SHORT,
                        );
                      }
                    }}
                    className="bg-purple-600 px-2 py-1 rounded mr-1"
                  >
                    <Text className="text-white text-xs">Ver</Text>
                  </TouchableOpacity>
                )}
                {qrGenerated && <CheckCircle size={12} color="#22c55e" />}
              </View>
            </View>
            <QRSlotView
              slot={images[1]}
              tableNumber={number}
              qrGenerated={qrGenerated}
            />
          </View>
        </View>
      </FormLayout>

      {/* QR Generator (siempre montado cuando hay número) */}
      {qrMounted && (
        <View
          style={{
            position: "absolute",
            left: -1000,
            top: -1000,
            width: 400,
            height: 400,
          }}
        >
          <View
            ref={qrRef}
            style={{
              padding: 50,
              backgroundColor: "white",
              width: 400,
              height: 400,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QRCode
              value={generateQRContent(number)}
              size={300}
              color="black"
              backgroundColor="white"
              quietZone={10}
              enableLinearGradient={false}
            />
          </View>
        </View>
      )}

      {/* QR Preview para debug */}
      {debugQR && number && Number(number) > 0 && (
        <View
          style={{
            position: "absolute",
            left: 20,
            top: 100,
            width: 240,
            height: 280,
            zIndex: 1000,
          }}
        >
          <View
            ref={debugQrRef}
            style={{
              padding: 20,
              backgroundColor: "white",
              width: 240,
              height: 280,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <QRCode
              value={generateQRContent(number)}
              size={200}
              color="black"
              backgroundColor="white"
              quietZone={10}
              enableLinearGradient={false}
            />
            <Text style={{ color: "black", fontSize: 12, marginTop: 10 }}>
              Mesa #{number}
            </Text>
            <Text
              style={{
                color: "gray",
                fontSize: 10,
                marginTop: 5,
                textAlign: "center",
              }}
            >
              {generateQRContent(number)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setDebugQR(false)}
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              backgroundColor: "red",
              borderRadius: 15,
              width: 30,
              height: 30,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>×</Text>
          </TouchableOpacity>
        </View>
      )}

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

function QRSlotView({
  slot,
  tableNumber,
  qrGenerated,
}: {
  slot: ImageSlot;
  tableNumber: string;
  qrGenerated: boolean;
}) {
  const sizeClass = "h-32";

  return (
    <View
      className={`${sizeClass} rounded-xl overflow-hidden bg-white/10 border border-white/20 items-center justify-center`}
    >
      {slot ? (
        <>
          <Image source={{ uri: slot.uri }} className="w-full h-full" />
          <View className="absolute top-1 right-1 bg-green-600 px-2 py-1 rounded flex-row items-center">
            <CheckCircle size={10} color="white" />
            <Text className="text-white text-xs ml-1">Auto</Text>
          </View>
        </>
      ) : (
        <View className="items-center justify-center h-full">
          {tableNumber && Number(tableNumber) > 0 ? (
            <View className="items-center">
              <View className="mb-2 p-3 bg-white/5 rounded-lg">
                <QrCode size={32} color={qrGenerated ? "#22c55e" : "#d4af37"} />
              </View>
              <Text
                className={`text-xs font-medium ${qrGenerated ? "text-green-400" : "text-yellow-400"}`}
              >
                {qrGenerated ? "QR Listo" : "Generando..."}
              </Text>
              {qrGenerated && (
                <Text className="text-gray-500 text-xs mt-1">
                  Mesa #{tableNumber}
                </Text>
              )}
            </View>
          ) : (
            <View className="items-center">
              <View className="mb-2 p-3 bg-white/5 rounded-lg">
                <QrCode size={32} color="#888" />
              </View>
              <Text className="text-gray-400 text-xs">Ingresa número</Text>
              <Text className="text-gray-500 text-xs mt-1">de mesa</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
