import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { ImagePlus } from "lucide-react-native";

type RNImage = { uri: string; name: string; type: string } | null;

type Props = {
  image: RNImage;
  onPick: () => void;
  onClear: () => void;
  error?: string;
  focused?: boolean;
  label?: string;
};

export default function ImageField({
  image,
  onPick,
  onClear,
  error,
  focused = false,
  label = "Imagen",
}: Props) {
  return (
    <View className="mb-4">
      <Text className="text-gray-300 mb-1">{label}</Text>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={onPick}
          className={`w-24 h-24 rounded-xl overflow-hidden bg-white/10 border items-center justify-center ${
            error ? "border-red-500" : "border-white/20"
          } ${focused ? "border-[#d4af37]" : ""}`}
        >
          {image ? (
            <Image source={{ uri: image.uri }} className="w-full h-full" />
          ) : (
            <>
              <ImagePlus size={24} color="#888" />
              <Text className="text-gray-400 text-xs mt-1">Elegir</Text>
            </>
          )}
        </TouchableOpacity>

        {!!image && (
          <TouchableOpacity
            onPress={onClear}
            className="px-3 py-2 rounded-lg bg-black/40 border border-white/10"
          >
            <Text className="text-white text-xs">Quitar</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
    </View>
  );
}
