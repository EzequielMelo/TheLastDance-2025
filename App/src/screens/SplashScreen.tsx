import React from "react";
import { View, StyleSheet, Text } from "react-native";
import LottieView from "lottie-react-native";
import { useEffect, useRef } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootStackParamList";
import animationVideo from "../../assets/chef-making-pizza.json";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen() {
  const animation = useRef<LottieView>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.topText}>The Last Dance - Restaurant</Text>

      <View style={styles.animationContainer}>
        <LottieView
          ref={animation}
          source={animationVideo}
          autoPlay
          loop={true}
          style={{
            width: 300,
            height: 300,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#231C16",
    justifyContent: "space-between", // <- separa arriba y abajo
    alignItems: "center",
    paddingVertical: 50, // espacio arriba y abajo
  },
  topText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  animationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
