import React, { useRef } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { ImagePlus } from "lucide-react-native";
import { useScroll } from "../../context/ScrollContext";

type RNImage = { uri: string; name: string; type: string } | null;

type Props = {
  image: RNImage;
  onPick: () => void;
  onClear: () => void;
  error?: string;
  focused?: boolean;
  label?: string;
  onFocus?: () => void;
};

export default function ImageField({
  image,
  onPick,
  onClear,
  error,
  focused = false,
  label = "Imagen",
  onFocus,
}: Props) {
  const containerRef = useRef<View>(null);
  const { scrollToPosition } = useScroll();
  const showError = !!error && !image;

  const handlePress = () => {
    // Hacer scroll cuando se presiona el campo
    setTimeout(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        scrollToPosition(y, height);
      });
    }, 150);

    onFocus?.();
    onPick();
  };

  return (
    <View ref={containerRef} className="mb-4">
      <Text className="text-white text-sm font-medium mb-1">{label}</Text>
      <View>
        <TouchableOpacity
          onPress={handlePress}
          className={`h-32 rounded-xl overflow-hidden bg-white/10 border items-center justify-center ${
            showError ? "border-red-500" : "border-white/20"
          } ${focused ? "border-[#d4af37]" : ""}`}
        >
          {image ? (
            <Image
              source={{ uri: image.uri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <>
              <ImagePlus size={32} color="#888" />
              <Text className="text-gray-400 text-sm mt-2">Elegir foto</Text>
            </>
          )}
        </TouchableOpacity>

        {!!image && (
          <TouchableOpacity
            onPress={onClear}
            className="px-3 py-2 mt-2 rounded-lg bg-black/40 border border-white/10 self-center"
          >
            <Text className="text-white text-xs">Quitar</Text>
          </TouchableOpacity>
        )}
      </View>

      {showError && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
    </View>
  );
}
