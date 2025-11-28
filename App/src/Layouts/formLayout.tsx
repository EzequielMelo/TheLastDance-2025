import React, { ReactNode, useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChefHat } from "lucide-react-native";
import ChefLoading from "../components/common/ChefLoading";
import { ScrollProvider, useScroll } from "../context/ScrollContext";

type ChildrenFunc = (renderSubmit: () => ReactNode) => ReactNode;

type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode | ChildrenFunc;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  bottomText?: string; // "¿No tienes cuenta?"
  bottomLinkText?: string; // "Regístrate"
  onBottomLinkPress?: () => void;
  showDivider?: boolean;
  footerContent?: ReactNode;
  renderSubmitInside?: boolean; // Si es true, el botón submit se pasa como parámetro a children
};

function FormLayoutContent({
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
  footerContent,
  renderSubmitInside = false,
}: Props) {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const { scrollViewRef } = useScroll();

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      },
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);
  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior="height"
        className="flex-1"
        keyboardVerticalOffset={50}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: isKeyboardVisible ? 300 : 50,
            paddingTop: isKeyboardVisible ? 20 : 0,
            justifyContent: isKeyboardVisible ? "flex-start" : "center",
          }}
          className="px-8 py-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
        >
          {/* Header */}
          <View className="items-center mb-10">
            {icon ?? <ChefHat size={50} color="#d4af37" strokeWidth={1.5} />}
            <Text className="text-white text-3xl font-light mt-4 tracking-wide">
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-gray-300 text-base mt-2 text-center">
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Form content */}
          <View className="w-full">
            {(() => {
              if (renderSubmitInside && typeof children === "function") {
                const renderSubmitButton = () => (
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
                      className="h-14 justify-center items-center shadow-lg mb-4"
                    >
                      {loading ? (
                        <ChefLoading size="small" />
                      ) : (
                        <Text className="text-[#1a1a1a] text-lg font-semibold tracking-wide">
                          {submitLabel}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
                return (children as ChildrenFunc)(renderSubmitButton);
              }
              return children as ReactNode;
            })()}
          </View>

          {/* Submit - Solo se renderiza si NO es renderSubmitInside */}
          {!renderSubmitInside && (
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
                  <ChefLoading size="small" />
                ) : (
                  <Text className="text-[#1a1a1a] text-lg font-semibold tracking-wide">
                    {submitLabel}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

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
            <TouchableOpacity
              className="items-center mb-4"
              onPress={onBottomLinkPress}
            >
              <Text className="text-gray-300 text-base">
                {bottomText}{" "}
                <Text className="text-[#d4af37] font-semibold">
                  {bottomLinkText}
                </Text>
              </Text>
            </TouchableOpacity>
          ) : null}
          {footerContent ? (
            <View className="mt-4 items-center">{footerContent}</View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Overlay de Loading */}
      {loading && (
        <View className="absolute inset-0 bg-black/80 justify-center items-center z-50">
          <View className="bg-gray-800 rounded-2xl p-8 items-center justify-center shadow-2xl mx-4">
            <ChefLoading size="large" text="Procesando..." />
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

export default function FormLayout(props: Props) {
  return (
    <ScrollProvider>
      <FormLayoutContent {...props} />
    </ScrollProvider>
  );
}
