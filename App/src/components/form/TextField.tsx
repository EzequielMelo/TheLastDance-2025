import React, { useRef } from "react";
import { View, TextInput, Text } from "react-native";
import { useScroll } from "../../context/ScrollContext";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  focused?: boolean;
  onLayout?: (y: number) => void;
};

export default function TextField({
  value,
  onChangeText,
  placeholder,
  error,
  onFocus,
  onBlur,
  secureTextEntry,
  keyboardType = "default",
  focused = false,
  onLayout,
}: Props) {
  const containerRef = useRef<View>(null);
  const { scrollToPosition } = useScroll();

  const handleFocus = () => {
    // Pequeño delay para asegurar que el teclado se ha mostrado
    setTimeout(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        scrollToPosition(y, height);
        onLayout?.(y);
      });
    }, 150);

    onFocus?.();
  };

  return (
    <View ref={containerRef} className="mb-4">
      <View
        className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${
          focused ? "border-[#d4af37] bg-[#d4af37]/10" : ""
        }`}
      >
        <TextInput
          className="flex-1 text-white text-base py-4"
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={onBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
      </View>
      {!!error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
    </View>
  );
}
