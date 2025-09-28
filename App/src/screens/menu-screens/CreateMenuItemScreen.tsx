import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ToastAndroid } from "react-native";
import { ChefHat, ImagePlus, UtensilsCrossed, Martini } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import FormLayout from "../../Layouts/formLayout";
import api from "../../api/axios";
import { useAuth } from "../../auth/AuthContext";

type ImageSlot = { uri: string; name: string; type: string } | null;

export default function CreateMenuItemScreen({ navigation }: any) {
  // Mantengo el nombre de variable que usás en la pantalla
  const { user: currentUser } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Por defecto "plato" para evitar undefined
  const [category, setCategory] = useState<"plato" | "bebida">("plato");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prepMinutes, setPrepMinutes] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<[ImageSlot, ImageSlot, ImageSlot]>([null, null, null]);

  // Cuando llega/ cambia el rol, alineamos la categoría por defecto
  useEffect(() => {
    if (currentUser?.position_code === "bartender") setCategory("bebida");
    if (currentUser?.position_code === "cocinero") setCategory("plato");
  }, [currentUser?.position_code]);

  const lockedCategory = useMemo<"plato" | "bebida" | null>(() => {
    if (currentUser?.position_code === "cocinero") return "plato";
    if (currentUser?.position_code === "bartender") return "bebida";
    return null; // sin rol conocido => que pueda elegir
  }, [currentUser?.position_code]);

  const effectiveCategory = (lockedCategory ?? category) as "plato" | "bebida";
  const canCreate = currentUser?.position_code === "cocinero" || currentUser?.position_code === "bartender";

  const pickAt = async (index: 0 | 1 | 2) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      ToastAndroid.show("Permiso denegado para acceder a la galería", ToastAndroid.LONG);
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
      const name = a.fileName || uri.split("/").pop() || `image_${index + 1}.jpg`;
      const ext = (name.split(".").pop() || "jpg").toLowerCase();
      const type = ext === "png" ? "image/png" : "image/jpeg";
      const next = [...images] as [ImageSlot, ImageSlot, ImageSlot];
      next[index] = { uri, name, type };
      setImages(next);
      ToastAndroid.show(`Imagen ${index + 1} lista ✔️`, ToastAndroid.SHORT);
    }
  };

  const removeAt = (index: 0 | 1 | 2) => {
    const next = [...images] as [ImageSlot, ImageSlot, ImageSlot];
    next[index] = null;
    setImages(next);
  };

  const validate = () => {
    if (!canCreate) {
      ToastAndroid.show("No tenés permisos para crear ítems", ToastAndroid.LONG);
      return false;
    }
    if (name.trim().length < 3) {
      ToastAndroid.show("Nombre muy corto (mín. 3)", ToastAndroid.SHORT);
      return false;
    }
    if (description.trim().length < 10) {
      ToastAndroid.show("Descripción muy corta (mín. 10)", ToastAndroid.SHORT);
      return false;
    }
    const pm = Number(prepMinutes);
    if (!pm || pm < 1) {
      ToastAndroid.show("Tiempo de preparación inválido", ToastAndroid.SHORT);
      return false;
    }
    const pr = Number(price);
    if (!pr || pr <= 0) {
      ToastAndroid.show("Precio inválido", ToastAndroid.SHORT);
      return false;
    }
    if (!images[0] || !images[1] || !images[2]) {
      ToastAndroid.show("Necesitás 3 imágenes", ToastAndroid.SHORT);
      return false;
    }
    // Reglas por rol:
    if (effectiveCategory === "plato" && currentUser?.position_code !== "cocinero") {
      ToastAndroid.show("Solo el cocinero puede crear platos", ToastAndroid.SHORT);
      return false;
    }
    if (effectiveCategory === "bebida" && currentUser?.position_code !== "bartender") {
      ToastAndroid.show("Solo el bartender puede crear bebidas", ToastAndroid.SHORT);
      return false;
    }
    return true;
  };

  const onSubmit = async () => {
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);

    const selected = images.filter(Boolean);
    if (selected.length !== 3) {
      ToastAndroid.show("Debés seleccionar exactamente 3 imágenes.", ToastAndroid.LONG);
      setIsSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.append("category", effectiveCategory);
    fd.append("name", name.trim());
    fd.append("description", description.trim());
    fd.append("prepMinutes", String(Number(prepMinutes)));
    fd.append("price", String(Number(price)));

    selected.forEach((img: any) => {
      fd.append("images", {
        uri: img.uri,
        name: img.name ?? `image_${Date.now()}.jpg`,
        type: img.type ?? "image/jpeg",
      } as any);
    });

    try {
      const url = `${api.defaults.baseURL}/menu/items`;
      const token = await SecureStore.getItemAsync("authToken");

      if (!token) {
        ToastAndroid.show("Sesión inválida. Volvé a iniciar sesión.", ToastAndroid.LONG);
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

      ToastAndroid.show("Ítem creado y activado ✔️", ToastAndroid.LONG);
      navigation.goBack();
    } catch (e: any) {
      ToastAndroid.show(e?.message || "Error creando ítem", ToastAndroid.LONG);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si querés bloquear la pantalla entera cuando NO es cocinero/bartender:
  if (!canCreate) {
    return (
      <FormLayout
        title="Sin permisos"
        subtitle="Tu perfil no puede crear ítems del menú"
        icon={<ChefHat size={50} color="#d4af37" strokeWidth={1.5} />}
        submitLabel="Volver"
        onSubmit={() => navigation.goBack()}
        loading={false}
        showDivider={false}
      >
        <Text className="text-gray-300 text-base">
          Solo <Text className="text-[#d4af37]">Cocinero</Text> puede crear <Text className="text-[#d4af37]">platos</Text> y{" "}
          <Text className="text-[#d4af37]">Bartender</Text> puede crear <Text className="text-[#d4af37]">bebidas</Text>.
        </Text>
      </FormLayout>
    );
  }

  return (
    <FormLayout
      title={effectiveCategory === "plato" ? "Nuevo Plato" : "Nueva Bebida"}
      subtitle={effectiveCategory === "plato" ? "Creá un plato para el menú" : "Creá una bebida para el menú"}
      icon={effectiveCategory === "plato" ? <UtensilsCrossed size={50} color="#d4af37" /> : <Martini size={50} color="#d4af37" />}
      submitLabel="Publicar"
      onSubmit={onSubmit}
      loading={isSubmitting}
      bottomText=" "
      bottomLinkText=" "
      onBottomLinkPress={() => {}}
      showDivider={false}
    >
      {/* Categoría (bloqueada según rol) */}
      <View className="mb-3">
        <Text className="text-gray-300 mb-1">Categoría</Text>
        <View className="flex-row gap-2">
          <Tag
            label="Plato"
            active={effectiveCategory === "plato"}
            disabled={lockedCategory !== null && lockedCategory !== "plato"}
            onPress={() => setCategory("plato")}
          />
          <Tag
            label="Bebida"
            active={effectiveCategory === "bebida"}
            disabled={lockedCategory !== null && lockedCategory !== "bebida"}
            onPress={() => setCategory("bebida")}
          />
        </View>
        {lockedCategory && <Text className="text-xs text-gray-400 mt-1">Fijado por rol: {lockedCategory}</Text>}
      </View>

      {/* Nombre */}
      <InputRow placeholder="Nombre" value={name} onChangeText={setName} />

      {/* Descripción */}
      <InputRow placeholder="Descripción" value={description} onChangeText={setDescription} multiline numberOfLines={3} />

      {/* Tiempo preparación y precio */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <InputRow placeholder="Min. preparación" value={prepMinutes} onChangeText={setPrepMinutes} keyboardType="numeric" />
        </View>
        <View className="flex-1">
          <InputRow placeholder="Precio" value={price} onChangeText={setPrice} keyboardType="numeric" />
        </View>
      </View>

      {/* Imágenes (3) */}
      <Text className="text-gray-300 mt-4 mb-2">Imágenes (3)</Text>
      <View className="flex-row gap-3">
        {[0, 1, 2].map((i) => (
          <ImageSlotView
            key={i}
            slot={images[i as 0 | 1 | 2]}
            onPick={() => pickAt(i as 0 | 1 | 2)}
            onRemove={() => removeAt(i as 0 | 1 | 2)}
          />
        ))}
      </View>
    </FormLayout>
  );
}

function Tag({label, active, onPress, disabled,}: {
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

function InputRow({placeholder, value, onChangeText, keyboardType = "default", multiline = false, numberOfLines = 1,}: {
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

function ImageSlotView({slot, onPick, onRemove,}: {
  slot: ImageSlot;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="w-24 h-24 rounded-xl overflow-hidden bg-white/10 border border-white/20 items-center justify-center">
      {slot ? (
        <>
          <Image source={{ uri: slot.uri }} className="w-full h-full" />
          <TouchableOpacity onPress={onRemove} className="absolute top-1 right-1 bg-black/60 px-2 py-1 rounded">
            <Text className="text-white text-xs">Quitar</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity onPress={onPick} className="items-center justify-center">
          <ImagePlus size={26} color="#888" />
          <Text className="text-gray-400 text-xs mt-1">Agregar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
