import React from "react";
import { View, StyleSheet, Text, Image, Animated } from "react-native";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootStackParamList";
import animationVideo from "../../assets/chef-making-pizza.json";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

const teamMembers = [
  "Ezequiel Melo",
  "Juan Pablo Cortez", 
  "Maximo Pasqui"
];

export default function SplashScreen() {
  const animation = useRef<LottieView>(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Secuencia de animaciones
    const sequence = [
      // Fase 0: Logo y nombre (2 segundos)
      () => {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          })
        ]).start();
        
        setTimeout(() => setCurrentPhase(1), 2000);
      },
      
      // Fase 1: Integrantes del grupo (3 segundos)
      () => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          })
        ]).start();
        
        setTimeout(() => setCurrentPhase(2), 3000);
      },
      
      // Fase 2: Animación final (2 segundos)
      () => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          })
        ]).start();
        
        // Aquí podrías navegar a la siguiente pantalla después de 2 segundos
        // setTimeout(() => navigation.replace("Home"), 2000);
      }
    ];

    if (sequence[currentPhase]) {
      sequence[currentPhase]();
    }
  }, [currentPhase]);

  const renderPhase = () => {
    switch (currentPhase) {
      case 0:
        return (
          <Animated.View 
            style={[
              styles.phaseContainer, 
              { 
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <View style={styles.logoContainer}>
              <Image 
                source={require("../../assets/icono.png")} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appTitle}>The Last Dance</Text>
            <Text style={styles.appSubtitle}>Restaurant Management System</Text>
          </Animated.View>
        );
        
      case 1:
        return (
          <Animated.View style={[styles.phaseContainer, { opacity: fadeAnim }]}>
            <View style={styles.teamContainer}>
              <Text style={styles.teamTitle}>Desarrollado por</Text>
              <View style={styles.teamMembersContainer}>
                {teamMembers.map((member, index) => (
                  <Animated.View
                    key={member}
                    style={[
                      styles.memberContainer,
                      {
                        opacity: fadeAnim,
                        transform: [{
                          translateY: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [30, 0]
                          })
                        }]
                      }
                    ]}
                  >
                    <View style={styles.memberBadge}>
                      <Text style={styles.memberIndex}>{index + 1}</Text>
                    </View>
                    <Text style={styles.memberName}>{member}</Text>
                  </Animated.View>
                ))}
              </View>
              <Text style={styles.universityText}>Universidad Tecnológica Nacional</Text>
            </View>
          </Animated.View>
        );
        
      case 2:
      default:
        return (
          <Animated.View style={[styles.phaseContainer, { opacity: fadeAnim }]}>
            <Text style={styles.loadingTitle}>The Last Dance</Text>
            <Text style={styles.loadingSubtitle}>Restaurant</Text>
            
            <View style={styles.animationContainer}>
              <LottieView
                ref={animation}
                source={animationVideo}
                autoPlay
                loop={true}
                style={styles.lottieAnimation}
              />
            </View>
            
            <Text style={styles.loadingText}>Cargando...</Text>
          </Animated.View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderPhase()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#231C16",
    justifyContent: "center",
    alignItems: "center",
  },
  phaseContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  // Fase 0: Logo y nombre
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  appTitle: {
    color: "#d4af37",
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  appSubtitle: {
    color: "white",
    fontSize: 16,
    opacity: 0.8,
    textAlign: "center",
  },
  // Fase 1: Equipo
  teamContainer: {
    alignItems: "center",
    width: "100%",
  },
  teamTitle: {
    color: "#d4af37",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  teamMembersContainer: {
    width: "100%",
    marginBottom: 40,
  },
  memberContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
  },
  memberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#d4af37",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  memberIndex: {
    color: "#231C16",
    fontSize: 16,
    fontWeight: "bold",
  },
  memberName: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  universityText: {
    color: "white",
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
    fontStyle: "italic",
  },
  // Fase 2: Carga final
  loadingTitle: {
    color: "#d4af37",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  loadingSubtitle: {
    color: "white",
    fontSize: 18,
    opacity: 0.8,
    textAlign: "center",
    marginBottom: 20,
  },
  animationContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  lottieAnimation: {
    width: 300,
    height: 300,
  },
  loadingText: {
    color: "white",
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
    marginTop: 20,
  },
  // Estilos legacy mantenidos por compatibilidad
  topText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  bottomText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
