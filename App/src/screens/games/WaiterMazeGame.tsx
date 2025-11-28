import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Vibration,
  Platform,
  ToastAndroid,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Gyroscope } from "expo-sensors";
import { Audio } from "expo-av";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { awardIfFirstWin } from "../../storage/discountStorage";
import { useAuth } from "../../auth/useAuth";

const { width, height } = Dimensions.get("window");
const GAME_WIDTH = width;
const GAME_HEIGHT = height; // Usar altura completa para que coincida con las paredes CSS

// Tamaños de sprites
const WAITER_SIZE = 60;
const OBSTACLE_SIZE = 50;
const TABLE_SIZE = 70;
const WALL_THICKNESS = 8; // Grosor de las paredes

// Velocidad de movimiento
const GYRO_SPEED = 25; // Velocidad base de movimiento con giroscopio
const GYRO_MULTIPLIER_X = 3.0; // Multiplicador para movimiento vertical (adelante/atrás)
const GYRO_MULTIPLIER_Y = 6.0; // Multiplicador para movimiento lateral (izquierda/derecha)
const GYRO_THRESHOLD = 0.05; // Umbral más bajo = más sensible (reducido de 0.1)
const SLIP_SPEED = 80; // Distancia del resbalón (reducida)

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Position {
  x: number;
  y: number;
}

interface Obstacle {
  id: number;
  type: "skates" | "banana" | "oil";
  position: Position;
}

export default function WaiterMazeGame() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  // Posiciones
  const [waiterPos, setWaiterPos] = useState<Position>({
    x: GAME_WIDTH / 2 - WAITER_SIZE / 2,
    y: GAME_HEIGHT - WAITER_SIZE - 20,
  });
  // Ref para la posición actual (para movimiento fluido)
  const waiterPosRef = useRef<Position>({
    x: GAME_WIDTH / 2 - WAITER_SIZE / 2,
    y: GAME_HEIGHT - WAITER_SIZE - 20,
  });
  // Ref para el elemento visual del mozo
  const waiterViewRef = useRef<View>(null);

  const [tablePos] = useState<Position>({
    x: GAME_WIDTH / 2 - TABLE_SIZE / 2,
    y: 20,
  });
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  // Estados del juego
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [isSlipping, setIsSlipping] = useState(false);

  // Referencias
  const gyroSubscription = useRef<any>(null);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const startSound = useRef<Audio.Sound | null>(null);
  const winSound = useRef<Audio.Sound | null>(null);
  const loseSound = useRef<Audio.Sound | null>(null);
  const errorSound = useRef<Audio.Sound | null>(null);

  // Cargar sonidos
  useEffect(() => {
    const loadSounds = async () => {
      try {
        // Configurar modo de audio
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        // Cargar todos los sonidos
        const { sound: start } = await Audio.Sound.createAsync(
          require("../../../assets/start.mp3"),
        );
        startSound.current = start;

        const { sound: win } = await Audio.Sound.createAsync(
          require("../../../assets/win.mp3"),
        );
        winSound.current = win;

        const { sound: lose } = await Audio.Sound.createAsync(
          require("../../../assets/lose.mp3"),
        );
        loseSound.current = lose;

        const { sound: error } = await Audio.Sound.createAsync(
          require("../../../assets/error.mp3"),
        );
        errorSound.current = error;

        console.log("🔊 Sonidos cargados correctamente");
      } catch (error) {
        console.error("Error cargando sonidos:", error);
      }
    };

    loadSounds();

    // Cleanup: descargar sonidos al desmontar
    return () => {
      startSound.current?.unloadAsync();
      winSound.current?.unloadAsync();
      loseSound.current?.unloadAsync();
      errorSound.current?.unloadAsync();
    };
  }, []);

  // Generar obstáculos aleatorios
  useEffect(() => {
    if (gameStarted) return;

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const obstacleTypes: Array<"skates" | "banana" | "oil"> = [
      "skates",
      "banana",
      "oil",
    ];

    const newObstacles: Obstacle[] = obstacleTypes.map((type, index) => ({
      id: index,
      type,
      position: {
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
      },
    }));

    console.log("🎮 Obstáculos generados:", newObstacles);
    setObstacles(newObstacles);
    obstaclesRef.current = newObstacles;
  }, [gameStarted]);

  // Iniciar juego
  useEffect(() => {
    if (!gameStarted) {
      setTimeout(() => {
        setGameStarted(true);
        playStartSound();
        startGyroscope();
      }, 500);
    }

    return () => {
      gyroSubscription.current?.remove();
    };
  }, []);

  const playStartSound = async () => {
    try {
      if (startSound.current) {
        await startSound.current.replayAsync();
      }
      Vibration.vibrate(100);
    } catch (error) {
      console.error("Error reproduciendo sonido de inicio:", error);
      Vibration.vibrate(100);
    }
  };

  const playWinSound = async () => {
    try {
      if (winSound.current) {
        await winSound.current.replayAsync();
      }
      Vibration.vibrate([0, 100, 100, 100]);
    } catch (error) {
      console.error("Error reproduciendo sonido de victoria:", error);
      Vibration.vibrate([0, 100, 100, 100]);
    }
  };

  const playLoseSound = async () => {
    try {
      if (loseSound.current) {
        await loseSound.current.replayAsync();
      }
      Vibration.vibrate([0, 200, 100, 200]);
    } catch (error) {
      console.error("Error reproduciendo sonido de derrota:", error);
      Vibration.vibrate([0, 200, 100, 200]);
    }
  };

  const playErrorSound = async () => {
    try {
      if (errorSound.current) {
        await errorSound.current.replayAsync();
      }
    } catch (error) {
      console.error("Error reproduciendo sonido de error:", error);
    }
  };

  // Configurar giroscopio para control completo (x e y)
  const startGyroscope = () => {
    Gyroscope.setUpdateInterval(16); // ~60fps

    gyroSubscription.current = Gyroscope.addListener(gyroscopeData => {
      if (gameOver || won || isSlipping) return;

      const { x, y } = gyroscopeData;

      // Usar ref para actualizaciones más rápidas sin re-render
      const prevPos = waiterPosRef.current;
      let newX = prevPos.x;
      let newY = prevPos.y;

      // Movimiento lateral (eje Y del giroscopio)
      if (Math.abs(y) > GYRO_THRESHOLD) {
        newX = prevPos.x + y * GYRO_SPEED * GYRO_MULTIPLIER_Y;
      }

      // Movimiento vertical (eje X del giroscopio)
      if (Math.abs(x) > GYRO_THRESHOLD) {
        newY = prevPos.y + x * GYRO_SPEED * GYRO_MULTIPLIER_X;
      }

      // Verificar colisión con bordes
      const wallMargin = WALL_THICKNESS;

      if (
        newX < wallMargin ||
        newX + WAITER_SIZE > GAME_WIDTH - wallMargin ||
        newY < wallMargin ||
        newY + WAITER_SIZE > GAME_HEIGHT - wallMargin
      ) {
        handleCollision("borde");
        return;
      }

      // Verificar colisión con obstáculos
      const obstaclesList = obstaclesRef.current;
      if (obstaclesList.length > 0) {
        for (const obstacle of obstaclesList) {
          const willCollide = checkCollision(
            { x: newX, y: newY },
            obstacle.position,
            obstacle.type,
          );
          if (willCollide) {
            handleSlip(prevPos);
            return;
          }
        }
      }

      // Verificar si llegó a la mesa
      const distance = Math.sqrt(
        Math.pow(newX - tablePos.x, 2) + Math.pow(newY - tablePos.y, 2),
      );
      if (distance < TABLE_SIZE / 2) {
        handleWin();
        return;
      }

      // Actualizar posición en ref
      waiterPosRef.current = { x: newX, y: newY };

      // Actualizar estado para re-render (solo cada cierto tiempo para mejor performance)
      setWaiterPos({ x: newX, y: newY });
    });
  };

  // Detectar colisión
  const checkCollision = (
    pos1: Position,
    pos2: Position,
    obstacleType?: "skates" | "banana" | "oil",
  ): boolean => {
    const center1X = pos1.x + WAITER_SIZE / 2;
    const center1Y = pos1.y + WAITER_SIZE / 2;
    const center2X = pos2.x + OBSTACLE_SIZE / 2;
    const center2Y = pos2.y + OBSTACLE_SIZE / 2;

    const distance = Math.sqrt(
      Math.pow(center1X - center2X, 2) + Math.pow(center1Y - center2Y, 2),
    );

    const hitboxMultiplier = 1.15;
    const collisionRadius =
      ((WAITER_SIZE + OBSTACLE_SIZE) / 2) * hitboxMultiplier;

    return distance < collisionRadius;
  };

  // Manejar resbalón al tocar obstáculo
  const handleSlip = (currentPos: Position) => {
    if (isSlipping) return;

    setIsSlipping(true);
    playErrorSound();
    Vibration.vibrate(200);

    // Direcciones posibles
    const directions = [
      { x: -SLIP_SPEED, y: 0 },
      { x: SLIP_SPEED, y: 0 },
      { x: -SLIP_SPEED, y: SLIP_SPEED },
      { x: SLIP_SPEED, y: SLIP_SPEED },
      { x: 0, y: SLIP_SPEED },
    ];

    const randomDirection =
      directions[Math.floor(Math.random() * directions.length)];

    // Animación del resbalón
    const steps = 20; // Más pasos para movimiento más suave
    const stepDelay = 10; // Delay más corto para movimiento más fluido
    const deltaX = randomDirection.x / steps;
    const deltaY = randomDirection.y / steps;

    let currentStep = 0;
    const slipInterval = setInterval(() => {
      currentStep++;

      const prevPos = waiterPosRef.current;
      let newX = prevPos.x + deltaX;
      let newY = prevPos.y + deltaY;

      // Asegurar límites
      newX = Math.max(
        WALL_THICKNESS,
        Math.min(GAME_WIDTH - WAITER_SIZE - WALL_THICKNESS, newX),
      );
      newY = Math.max(
        WALL_THICKNESS,
        Math.min(GAME_HEIGHT - WAITER_SIZE - WALL_THICKNESS, newY),
      );

      // Verificar colisión con borde
      if (
        newX <= WALL_THICKNESS ||
        newX >= GAME_WIDTH - WAITER_SIZE - WALL_THICKNESS ||
        newY <= WALL_THICKNESS ||
        newY >= GAME_HEIGHT - WAITER_SIZE - WALL_THICKNESS
      ) {
        clearInterval(slipInterval);
        handleCollision("borde después de resbalar");
        return;
      }

      // Actualizar posición
      waiterPosRef.current = { x: newX, y: newY };
      setWaiterPos({ x: newX, y: newY });

      // Terminar animación
      if (currentStep >= steps) {
        clearInterval(slipInterval);
        setTimeout(() => {
          setIsSlipping(false);
        }, 100);
      }
    }, stepDelay);
  };

  // Manejar colisión (pierde el juego)
  const handleCollision = (type: string) => {
    setGameOver(true);
    gyroSubscription.current?.remove();
    playLoseSound();

    const message = `¡Perdiste! Tocaste ${type}`;
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      Alert.alert("¡Perdiste!", message, [
        { text: "Reintentar", onPress: () => navigation.replace("WaiterMaze") },
        { text: "Salir", onPress: () => navigation.goBack() },
      ]);
    }
  };

  // Manejar victoria
  const handleWin = async () => {
    setWon(true);
    gyroSubscription.current?.remove();
    playWinSound();

    // Otorgar descuento solo a usuarios registrados
    if (user?.profile_code === "cliente_registrado") {
      const result = await awardIfFirstWin(true, 20, user.profile_code); // 20% de descuento
      const message = result.awarded
        ? "¡Ganaste! 🎉 Obtuviste un 20% de descuento"
        : "¡Ganaste! 🎉 Ya tenías un descuento activo";

      if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.LONG);
      } else {
        Alert.alert("¡Felicitaciones!", message, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }

      setTimeout(() => navigation.goBack(), 3000);
    } else {
      const message =
        "¡Ganaste! 🎉 Registrate para obtener descuentos en tus pedidos";
      if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.LONG);
      } else {
        Alert.alert("¡Felicitaciones!", message, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
      setTimeout(() => navigation.goBack(), 3000);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#161412", "#2b1712", "#161412"]}
        style={styles.container}
      >
        {/* Game Area */}
        <View style={styles.gameArea}>
          {/* Suelo del restaurante */}
          <View style={styles.floor} />

          {/* Paredes del restaurante */}
          <View style={styles.wallTop} />
          <View style={styles.wallBottom} />
          <View style={styles.wallLeft} />
          <View style={styles.wallRight} />

          {/* Instrucciones */}
          {!gameStarted && (
            <View style={styles.instructions}>
              <Text style={styles.instructionsText}>
                Inclina tu dispositivo para mover al mozo
              </Text>
              <Text style={styles.instructionsSubtext}>
                Llega a la mesa sin tocar obstáculos ni bordes
              </Text>
            </View>
          )}

          {/* Mesa (destino) */}
          <View
            style={[
              styles.table,
              {
                left: tablePos.x,
                top: tablePos.y,
                width: TABLE_SIZE,
                height: TABLE_SIZE,
              },
            ]}
          >
            <Image
              source={require("../../../assets/mesa.png")}
              style={styles.spriteImage}
              resizeMode="contain"
            />
          </View>

          {/* Obstáculos */}
          {obstacles.map(obstacle => (
            <View
              key={obstacle.id}
              style={[
                styles.obstacle,
                {
                  left: obstacle.position.x,
                  top: obstacle.position.y,
                  width: OBSTACLE_SIZE,
                  height: OBSTACLE_SIZE,
                },
              ]}
            >
              <Image
                source={
                  obstacle.type === "skates"
                    ? require("../../../assets/patineta.png")
                    : obstacle.type === "banana"
                      ? require("../../../assets/cascara.png")
                      : require("../../../assets/aceite.png")
                }
                style={styles.spriteImage}
                resizeMode="contain"
              />
            </View>
          ))}

          {/* Mozo (jugador) */}
          <View
            style={[
              styles.waiter,
              {
                left: waiterPos.x,
                top: waiterPos.y,
                width: WAITER_SIZE,
                height: WAITER_SIZE,
              },
            ]}
          >
            <Image
              source={require("../../../assets/mozogame.png")}
              style={styles.spriteImage}
              resizeMode="contain"
            />
          </View>

          {/* Mensaje de victoria */}
          {won && (
            <View style={styles.overlay}>
              <Text style={styles.winText}>¡Llegaste a la mesa!</Text>
              <Text style={styles.winSubtext}>🎉 ¡Ganaste! 🎉</Text>
            </View>
          )}

          {/* Mensaje de derrota */}
          {gameOver && !won && (
            <View style={styles.overlay}>
              <Text style={styles.loseText}>¡Perdiste!</Text>
              <Text style={styles.loseSubtext}>
                Tocaste un obstáculo o el borde
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#161412",
  },
  container: {
    flex: 1,
  },
  gameArea: {
    flex: 1,
    position: "relative",
  },
  floor: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#2b1712", // Color marrón oscuro del restaurante
    // Patrón de baldosas (simulado con degradado sutil)
  },
  wallTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "#d4af37", // Dorado
    borderBottomWidth: 2,
    borderBottomColor: "#8b6914",
    zIndex: 5,
  },
  wallBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "#d4af37",
    borderTopWidth: 2,
    borderTopColor: "#8b6914",
    zIndex: 5,
  },
  wallLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 8,
    backgroundColor: "#d4af37",
    borderRightWidth: 2,
    borderRightColor: "#8b6914",
    zIndex: 5,
  },
  wallRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 8,
    backgroundColor: "#d4af37",
    borderLeftWidth: 2,
    borderLeftColor: "#8b6914",
    zIndex: 5,
  },
  instructions: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  instructionsText: {
    color: "#d4af37",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  instructionsSubtext: {
    color: "#ffffff",
    fontSize: 14,
    textAlign: "center",
  },
  waiter: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  table: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  tableLabel: {
    position: "absolute",
    bottom: -20,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  obstacle: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  obstacleLabel: {
    fontSize: 24,
  },
  spriteImage: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  winText: {
    color: "#22c55e",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
  },
  winSubtext: {
    color: "#ffffff",
    fontSize: 24,
  },
  loseText: {
    color: "#ef4444",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
  },
  loseSubtext: {
    color: "#ffffff",
    fontSize: 18,
    textAlign: "center",
  },
});
