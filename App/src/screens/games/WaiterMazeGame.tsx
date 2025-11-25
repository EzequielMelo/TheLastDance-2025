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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Gyroscope } from "expo-sensors";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { awardIfFirstWin } from "../../storage/discountStorage";
import { useAuth } from "../../auth/useAuth";

const { width, height } = Dimensions.get("window");
const GAME_WIDTH = width;
const GAME_HEIGHT = height - 100; // Espacio para header

// Tamaños de sprites
const WAITER_SIZE = 60;
const OBSTACLE_SIZE = 50;
const TABLE_SIZE = 70;

// Velocidad de movimiento
const GYRO_SPEED = 15; // Velocidad de movimiento con giroscopio (aumentada)
const SLIP_SPEED = 150; // Distancia del resbalón

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

  // Cargar sonidos (por ahora comentado hasta tener expo-av)
  useEffect(() => {
    // Por ahora solo usaremos vibraciones
    return () => {
      // Cleanup
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
        x: centerX + (Math.random() - 0.5) * 200 - OBSTACLE_SIZE / 2,
        y: centerY + (Math.random() - 0.5) * 200 - OBSTACLE_SIZE / 2,
      },
    }));

    setObstacles(newObstacles);
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
    // Reproducir sonido de inicio (por ahora solo vibración)
    Vibration.vibrate(100);
  };

  const playWinSound = async () => {
    Vibration.vibrate([0, 100, 100, 100]);
  };

  const playLoseSound = async () => {
    Vibration.vibrate([0, 200, 100, 200]);
  };

  // Configurar giroscopio para control completo (x e y)
  const startGyroscope = () => {
    Gyroscope.setUpdateInterval(30);
    gyroSubscription.current = Gyroscope.addListener(gyroscopeData => {
      if (gameOver || won || isSlipping) return;

      const { x, y } = gyroscopeData; // x = adelante/atrás, y = izquierda/derecha

      setWaiterPos(prevPos => {
        const threshold = 0.2; // Umbral más bajo = más sensible

        let newX = prevPos.x;
        let newY = prevPos.y;

        // Movimiento lateral (eje Y del giroscopio) - MUCHO MÁS SENSIBLE
        if (Math.abs(y) > threshold) {
          newX = prevPos.x + y * GYRO_SPEED * 4; // 2.5x más sensible en eje Y
        }

        // Movimiento vertical (eje X del giroscopio) - MÁS SENSIBLE
        if (Math.abs(x) > threshold) {
          newY = prevPos.y + x * GYRO_SPEED * 1.3; // 1.3x más sensible en eje X
        }

        // Verificar colisión con bordes
        if (
          newX < 0 ||
          newX > GAME_WIDTH - WAITER_SIZE ||
          newY < 0 ||
          newY > GAME_HEIGHT - WAITER_SIZE
        ) {
          handleCollision("borde");
          return prevPos;
        }

        // Verificar colisión con obstáculos
        for (const obstacle of obstacles) {
          if (checkCollision({ x: newX, y: newY }, obstacle.position)) {
            handleSlip(prevPos);
            return prevPos;
          }
        }

        // Verificar si llegó a la mesa
        const distance = Math.sqrt(
          Math.pow(newX - tablePos.x, 2) + Math.pow(newY - tablePos.y, 2),
        );
        if (distance < TABLE_SIZE / 2) {
          handleWin();
          return prevPos;
        }

        return { x: newX, y: newY };
      });
    });
  };

  // Detectar colisión
  const checkCollision = (pos1: Position, pos2: Position): boolean => {
    const distance = Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2),
    );
    // Radio de colisión más grande para asegurar que detecte el toque
    return distance < (WAITER_SIZE + OBSTACLE_SIZE) / 1.5;
  };

  // Manejar resbalón al tocar obstáculo
  const handleSlip = (currentPos: Position) => {
    setIsSlipping(true);
    Vibration.vibrate(200); // Vibración al resbalar

    console.log("💨 ¡RESBALÓN DETECTADO!");

    // Direcciones posibles: izquierda, derecha, atrás (NUNCA adelante)
    const directions = [
      { x: -SLIP_SPEED, y: 0 }, // Izquierda
      { x: SLIP_SPEED, y: 0 }, // Derecha
      { x: -SLIP_SPEED, y: -SLIP_SPEED }, // Izquierda-atrás diagonal
      { x: SLIP_SPEED, y: -SLIP_SPEED }, // Derecha-atrás diagonal
      { x: 0, y: -SLIP_SPEED }, // Directamente atrás
    ];

    // Elegir dirección aleatoria
    const randomDirection =
      directions[Math.floor(Math.random() * directions.length)];

    console.log("💨 Dirección del resbalón:", randomDirection);

    // Aplicar resbalón
    setWaiterPos(prevPos => {
      let newX = prevPos.x + randomDirection.x;
      let newY = prevPos.y + randomDirection.y;

      // Asegurar que no salga de los límites
      newX = Math.max(0, Math.min(GAME_WIDTH - WAITER_SIZE, newX));
      newY = Math.max(0, Math.min(GAME_HEIGHT - WAITER_SIZE, newY));

      console.log("💨 Nueva posición después de resbalar:", {
        x: newX,
        y: newY,
      });

      // Verificar si el resbalón lo hace chocar contra un borde
      if (
        newX <= 0 ||
        newX >= GAME_WIDTH - WAITER_SIZE ||
        newY <= 0 ||
        newY >= GAME_HEIGHT - WAITER_SIZE
      ) {
        handleCollision("borde después de resbalar");
        return prevPos;
      }

      return { x: newX, y: newY };
    });

    // Terminar el resbalón después de un momento
    setTimeout(() => {
      setIsSlipping(false);
      console.log("💨 Resbalón terminado, control restaurado");
    }, 400); // Aumentado a 400ms para que sea más notorio
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
    <LinearGradient
      colors={["#161412", "#2b1712", "#161412"]}
      style={styles.container}
    >
      {/* Game Area */}
      <View style={styles.gameArea}>
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
            source={require("../../../assets/mozo.png")}
            style={styles.spriteImage}
            resizeMode="contain"
          />
          <Text style={styles.tableLabel}>Mesa</Text>
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
              source={require("../../../assets/mozo.png")}
              style={styles.spriteImage}
              resizeMode="contain"
            />
            <Text style={styles.obstacleLabel}>
              {obstacle.type === "skates"
                ? "🛼"
                : obstacle.type === "banana"
                  ? "🍌"
                  : "🛢️"}
            </Text>
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
            source={require("../../../assets/mozo.png")}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gameArea: {
    flex: 1,
    position: "relative",
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
    backgroundColor: "#3b82f6",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  table: {
    position: "absolute",
    backgroundColor: "#22c55e",
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
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
    backgroundColor: "#ef4444",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
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
