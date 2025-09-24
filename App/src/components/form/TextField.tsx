import React from "react";
import { View, TextInput, Text } from "react-native";

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
}: Props) {
  return (
    <View className="mb-4">
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
          onFocus={onFocus}
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
