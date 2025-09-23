import React, { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChefHat } from "lucide-react-native";

type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  bottomText?: string; // "¿No tienes cuenta?"
  bottomLinkText?: string; // "Regístrate"
  onBottomLinkPress?: () => void;
  showDivider?: boolean;
};

export default function FormLayout({
  title,
  subtitle,
  icon,
  children,
  submitLabel,
  onSubmit,
  loading,
  bottomText,
  bottomLinkText,
  onBottomLinkPress,
  showDivider = true,
}: Props) {
  return (
    <LinearGradient colors={["#1a1a1a", "#2d1810", "#1a1a1a"]} className="flex-1">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} className="px-8 py-12">
          {/* Header */}
          <View className="items-center mb-10">
            {icon ?? <ChefHat size={50} color="#d4af37" strokeWidth={1.5} />}
            <Text className="text-white text-3xl font-light mt-4 tracking-wide">{title}</Text>
            {subtitle ? (
              <Text className="text-gray-300 text-sm mt-2 text-center">{subtitle}</Text>
            ) : null}
          </View>

          {/* Form content */}
          <View className="w-full">{children}</View>

          {/* Submit */}
          <TouchableOpacity 
            className="overflow-hidden rounded-xl mt-2" 
            onPress={onSubmit} 
            disabled={!!loading} 
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            <LinearGradient 
              colors={["#d4af37", "#b8941f", "#d4af37"]} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }} 
              className="h-14 justify-center items-center shadow-lg"
            >
              {loading ? (
                <ActivityIndicator size={35} color="#1a1a1a" />
              ) : (
                <Text className="text-[#1a1a1a] text-lg font-semibold tracking-wide">{submitLabel}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          {showDivider ? (
            <View className="flex-row items-center my-8">
              <View className="flex-1 h-px bg-white/20" />
              <Text className="text-gray-400 px-5 text-sm">o</Text>
              <View className="flex-1 h-px bg-white/20" />
            </View>
          ) : null}

          {/* Bottom link */}
          {bottomText && bottomLinkText && onBottomLinkPress ? (
            <TouchableOpacity className="items-center" onPress={onBottomLinkPress}>
              <Text className="text-gray-300 text-base">
                {bottomText} <Text className="text-[#d4af37] font-semibold">{bottomLinkText}</Text>
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Overlay de Loading */}
      {loading && (
        <View className="absolute inset-0 bg-black/80 justify-center items-center z-50">
          <View className="bg-gray-800 rounded-2xl p-8 items-center justify-center shadow-2xl mx-4">
            {/* Spinner */}
            <ActivityIndicator size="large" color="#d4af37" />
            
            {/* Texto */}
            <Text className="text-white text-lg mt-4 font-bold">Procesando...</Text>
            <Text className="text-gray-300 text-sm mt-1">Por favor espera</Text>
            
            {/* Barra de progreso animada */}
            <View className="w-48 h-1 bg-gray-600 rounded-full mt-4 overflow-hidden">
              <View className="h-full bg-[#d4af37] rounded-full animate-pulse" />
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}