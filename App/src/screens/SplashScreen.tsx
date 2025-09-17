import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootStackParamList";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import React, { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ChefHat, Utensils } from "lucide-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export const SplashScreen = ({ navigation }: Props) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const animateSequence = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    animateSequence();

    const timer = setTimeout(() => {
      navigation.popTo("Login");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1 justify-center itemc"
    >
      <Animated.View
        className={"items-center px-10"}
        style={[
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
          },
        ]}
      >
        <View className="items-center mb-10">
          <ChefHat size={80} color="#d4af37" strokeWidth={1.5} />
          <Text className="text-5xl font-light text-white mt-5 text-center">
            Bella Tavola
          </Text>
          <Text className="text-[#d4af37] mt-2 space-x-1">
            Auténtica Cocina Italiana
          </Text>
        </View>

        <View className="flex flex-row items-center mb-5">
          <Utensils size={24} color="#d4af37" strokeWidth={1.5} />
          <View className="flex flex-col">
            <ActivityIndicator className=" text-[#d4af37] mb-2" size={40} />
            <View className="w-14 h-1 bg-[#d4af37]  mx-5" />
          </View>
          <Utensils size={24} color="#d4af37" strokeWidth={1.5} />
        </View>

        <Text className="text-[#cccccc] italic text-center">
          "Donde cada plato cuenta una historia"
        </Text>
      </Animated.View>
    </LinearGradient>
  );
};
