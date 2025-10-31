import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react-native";

interface CustomAlertProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }>;
}

const { width } = Dimensions.get("window");

export default function CustomAlert({
  visible,
  onClose,
  title,
  message,
  type = "info",
  buttons = [{ text: "OK", onPress: onClose }],
}: CustomAlertProps) {
  const scaleValue = React.useRef(new Animated.Value(0)).current;
  const opacityValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getIconAndColor = () => {
    switch (type) {
      case "success":
        return { icon: CheckCircle, color: "#10b981", bgColor: "#10b981" };
      case "error":
        return { icon: XCircle, color: "#ef4444", bgColor: "#ef4444" };
      case "warning":
        return { icon: AlertTriangle, color: "#f59e0b", bgColor: "#f59e0b" };
      default:
        return { icon: Info, color: "#3b82f6", bgColor: "#3b82f6" };
    }
  };

  const { icon: IconComponent, color, bgColor } = getIconAndColor();

  const getButtonStyle = (buttonStyle?: string) => {
    switch (buttonStyle) {
      case "destructive":
        return "bg-red-500";
      case "cancel":
        return "bg-gray-600";
      default:
        return "bg-[#d4af37]";
    }
  };

  const getButtonTextColor = (buttonStyle?: string) => {
    switch (buttonStyle) {
      case "cancel":
        return "text-gray-300";
      default:
        return "text-black";
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
          opacity: opacityValue,
        }}
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleValue }],
            width: width - 60,
            maxWidth: 320,
          }}
        >
          <LinearGradient
            colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
            className="rounded-2xl border border-gray-700 overflow-hidden"
          >
            {/* Header con icono */}
            <View className="pt-6 pb-4 px-6">
              <View className="flex-row items-center">
                <View
                  className="rounded-full p-2 mr-3"
                  style={{ backgroundColor: `${bgColor}20` }}
                >
                  <IconComponent size={20} color={color} />
                </View>
                <Text className="text-white text-xl font-bold flex-1">
                  {title}
                </Text>
              </View>
            </View>

            {/* Message */}
            <View className="px-6 pb-6">
              <Text className="text-gray-300 text-left leading-6">
                {message}
              </Text>
            </View>

            {/* Buttons */}
            <View className="border-t border-gray-700">
              {buttons.length === 1 ? (
                <TouchableOpacity
                  onPress={() => {
                    buttons[0].onPress?.();
                    onClose();
                  }}
                  className={`py-4 ${getButtonStyle(buttons[0].style)}`}
                >
                  <Text
                    className={`text-center font-semibold text-lg ${getButtonTextColor(buttons[0].style)}`}
                  >
                    {buttons[0].text}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View className="flex-row">
                  {buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        button.onPress?.();
                        onClose();
                      }}
                      className={`flex-1 py-4 ${
                        index > 0 ? "border-l border-gray-700" : ""
                      } ${getButtonStyle(button.style)}`}
                    >
                      <Text
                        className={`text-center font-semibold ${getButtonTextColor(button.style)}`}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}