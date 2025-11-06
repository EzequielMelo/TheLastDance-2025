import React, { useRef } from "react";
import { View, Text, TextInput } from "react-native";
import { useScroll } from "../../context/ScrollContext";

type Props = {
  value: string; // Formato: "XX-XXXXXXXX-X"
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  focused?: boolean;
  onFocus?: () => void;
};

export default function CUILField({
  value,
  onChangeText,
  onBlur,
  error,
  focused = false,
  onFocus,
}: Props) {
  const secondInputRef = useRef<TextInput>(null);
  const thirdInputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  const { scrollToPosition } = useScroll();

  // Parsear el valor actual en las 3 partes
  const parts = value.split("-");
  const firstPart = parts[0] || "";
  const secondPart = parts[1] || "";
  const thirdPart = parts[2] || "";

  const handleFocusWithScroll = () => {
    setTimeout(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        scrollToPosition(y, height);
      });
    }, 150);
    onFocus?.();
  };

  const handleFirstPartChange = (text: string) => {
    // Solo permitir números y máximo 2 caracteres
    const cleanText = text.replace(/[^0-9]/g, "").slice(0, 2);
    const newValue = `${cleanText}-${secondPart}-${thirdPart}`;
    onChangeText(newValue);

    // Auto-focus al siguiente campo cuando se completen 2 dígitos
    if (cleanText.length === 2) {
      secondInputRef.current?.focus();
    }
  };

  const handleSecondPartChange = (text: string) => {
    // Solo permitir números y máximo 8 caracteres
    const cleanText = text.replace(/[^0-9]/g, "").slice(0, 8);
    const newValue = `${firstPart}-${cleanText}-${thirdPart}`;
    onChangeText(newValue);

    // Auto-focus al siguiente campo cuando se completen 8 dígitos
    if (cleanText.length === 8) {
      thirdInputRef.current?.focus();
    }
  };

  const handleThirdPartChange = (text: string) => {
    // Solo permitir números y máximo 1 carácter
    const cleanText = text.replace(/[^0-9]/g, "").slice(0, 1);
    const newValue = `${firstPart}-${secondPart}-${cleanText}`;
    onChangeText(newValue);
  };

  return (
    <View ref={containerRef} className="mb-4">
      <Text className="text-white text-sm font-medium mb-1">CUIL</Text>

      <View className="flex-row items-center gap-2">
        {/* Primer input: 2 dígitos */}
        <TextInput
          className={`flex-0 w-12 h-13 rounded-xl border px-3 bg-white/10 border-white/20 text-white text-base text-center ${
            focused ? "border-[#d4af37] bg-[#d4af37]/10" : ""
          }`}
          placeholder="20"
          placeholderTextColor="#888"
          value={firstPart}
          onChangeText={handleFirstPartChange}
          onFocus={handleFocusWithScroll}
          onBlur={onBlur}
          keyboardType="numeric"
          maxLength={2}
        />

        <Text className="text-white text-lg">-</Text>

        {/* Segundo input: 8 dígitos (DNI) */}
        <TextInput
          ref={secondInputRef}
          className={`flex-1 h-13 rounded-xl border px-3 bg-white/10 border-white/20 text-white text-base text-center ${
            focused ? "border-[#d4af37] bg-[#d4af37]/10" : ""
          }`}
          placeholder="00000000"
          placeholderTextColor="#888"
          value={secondPart}
          onChangeText={handleSecondPartChange}
          onFocus={handleFocusWithScroll}
          onBlur={onBlur}
          keyboardType="numeric"
          maxLength={8}
        />

        <Text className="text-white text-lg">-</Text>

        {/* Tercer input: 1 dígito */}
        <TextInput
          ref={thirdInputRef}
          className={`flex-0 w-12 h-13 rounded-xl border px-3 bg-white/10 border-white/20 text-white text-base text-center ${
            focused ? "border-[#d4af37] bg-[#d4af37]/10" : ""
          }`}
          placeholder="3"
          placeholderTextColor="#888"
          value={thirdPart}
          onChangeText={handleThirdPartChange}
          onFocus={handleFocusWithScroll}
          onBlur={onBlur}
          keyboardType="numeric"
          maxLength={1}
        />
      </View>

      {!!error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
    </View>
  );
}
