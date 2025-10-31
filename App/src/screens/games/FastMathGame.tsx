import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ToastAndroid,
  Animated,
  Easing,
  LayoutChangeEvent,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { awardIfFirstWin } from "../../storage/discountStorage";

const MAX_ROUNDS = 5;
const DISCOUNT = 15;
const TIME_LIMIT_MS = 4000;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FastMathGame() {
  const navigation = useNavigation<NavigationProp>();

  const [round, setRound] = useState(1);
  const [question, setQuestion] = useState<{ text: string; answer: number }>({
    text: "",
    answer: 0,
  });
  const [options, setOptions] = useState<number[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const [barWidth, setBarWidth] = useState(0);

  const [timeLeft, setTimeLeft] = useState<number>(TIME_LIMIT_MS / 1000);

  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);

  useEffect(() => {
    generateQuestion();
    restartTimer();
    return () => {
      stopTimer();
      clearIntervalRef();
      clearTimeoutRef();
    };
  }, []);

  useEffect(() => {
    restartTimer();
  }, [round]);

  const onLayoutBar = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBarWidth(w);
  };

  const startTimer = () => {
    startTsRef.current = Date.now();
    setTimeLeft(TIME_LIMIT_MS / 1000);

    progress.setValue(0);

    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: TIME_LIMIT_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    animRef.current.start(({ finished }) => {
      if (finished) {
        onTimeExpired();
      }
    });

    clearIntervalRef();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTsRef.current;
      const leftMs = Math.max(0, TIME_LIMIT_MS - elapsed);
      setTimeLeft(Number((leftMs / 1000).toFixed(1)));
    }, 100) as unknown as number;

    clearTimeoutRef();
    timeoutRef.current = setTimeout(
      () => onTimeExpired(),
      TIME_LIMIT_MS,
    ) as unknown as number;
  };

  const stopTimer = () => {
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
  };

  const clearIntervalRef = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current as unknown as number);
      intervalRef.current = null;
    }
  };

  const clearTimeoutRef = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current as unknown as number);
      timeoutRef.current = null;
    }
  };

  const restartTimer = () => {
    stopTimer();
    clearIntervalRef();
    clearTimeoutRef();
    progress.setValue(0);
    setTimeout(() => startTimer(), 20);
  };

  const onTimeExpired = () => {
    if (isAnswered) return;
    setIsAnswered(true);
    stopTimer();
    clearIntervalRef();
    clearTimeoutRef();
    ToastAndroid.show("⏰ Tiempo terminado - Volvés al inicio", ToastAndroid.SHORT);
    setTimeout(() => {
      navigation.navigate("Games" as any);
    }, 1500);
  };

  const generateQuestion = () => {
    const ops = ["+", "-", "×"];
    const op = ops[Math.floor(Math.random() * ops.length)];

    let a = Math.floor(Math.random() * (10 + round * 5)) + 5;
    let b = Math.floor(Math.random() * (10 + round * 5)) + 5;
    let answer = 0;
    let text = "";

    if (op === "+") {
      answer = a + b;
      text = `${a} + ${b} = ?`;
    } else if (op === "-") {
      if (a < b) [a, b] = [b, a];
      answer = a - b;
      text = `${a} - ${b} = ?`;
    } else {
      a = Math.floor(Math.random() * 10) + 2;
      b = Math.floor(Math.random() * 10) + 2;
      answer = a * b;
      text = `${a} × ${b} = ?`;
    }

    setQuestion({ text, answer });

    const opts = new Set<number>();
    opts.add(answer);
    while (opts.size < 4) {
      let val = answer + Math.floor(Math.random() * 11) - 5;
      if (val !== answer && val > 0) opts.add(val);
    }
    setOptions(shuffle(Array.from(opts)));
  };

  const shuffle = (arr: number[]) => arr.sort(() => Math.random() - 0.5);

  const handleAnswer = async (selected: number) => {
    if (isAnswered) return;
    setIsAnswered(true);

    stopTimer();
    clearIntervalRef();
    clearTimeoutRef();

    if (selected !== question.answer) {
      ToastAndroid.show("❌ Fallaste - Respuesta incorrecta", ToastAndroid.SHORT);
      setTimeout(() => {
        navigation.navigate("Games" as any);
      }, 1500);
      return;
    }

    if (round >= MAX_ROUNDS) {
      const res = await awardIfFirstWin(true, DISCOUNT);
      if (res.awarded) {
        const currentDiscount = res.discount?.amount || DISCOUNT;
        if (currentDiscount > DISCOUNT) {
          ToastAndroid.show(`🎉 ¡Ganaste! Mantienes tu descuento de ${currentDiscount}%`, ToastAndroid.LONG);
        } else {
          ToastAndroid.show(`🎉 ¡Ganaste! Obtuviste ${DISCOUNT}% de descuento`, ToastAndroid.LONG);
        }
      } else {
        const currentDiscount = res.discount?.amount || 0;
        if (currentDiscount >= DISCOUNT) {
          ToastAndroid.show(`🎮 Ganaste, pero ya tenés ${currentDiscount}% de descuento (mayor o igual)`, ToastAndroid.LONG);
        } else {
          ToastAndroid.show("🎮 Ganaste, pero ya no hay premio disponible", ToastAndroid.LONG);
        }
      }
      setTimeout(() => {
        navigation.navigate("Games" as any);
      }, 2500);
      return;
    }

    setTimeout(() => {
      setRound(prev => prev + 1);
      setIsAnswered(false);
      generateQuestion();
    }, 220);
  };

  const resetGame = () => {
    stopTimer();
    clearIntervalRef();
    clearTimeoutRef();

    setRound(1);
    setIsAnswered(false);
    generateQuestion();
    setTimeout(() => restartTimer(), 30);
  };

  const handleBack = () => {
    stopTimer();
    clearIntervalRef();
    clearTimeoutRef();
    navigation.navigate("Games" as any);
  };

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -barWidth],
  });

  return (
    <LinearGradient colors={["#161412", "#2b1712"]} style={styles.container}>
      <Text style={styles.title}>Quiz Matemático</Text>
      <Text style={styles.info}>
        Ronda {round}/{MAX_ROUNDS}
      </Text>

      {/* contador numérico */}
      <Text style={styles.timerText}>{timeLeft.toFixed(1)}s</Text>

      {/* Barra de tiempo */}
      <View style={styles.timerWrapper} onLayout={onLayoutBar}>
        <Animated.View
          style={[
            styles.timerBar,
            {
              transform: [{ translateX }],
              width: barWidth || "100%",
            },
          ]}
        />
      </View>

      <Text style={styles.question}>{question.text}</Text>

      <View style={styles.options}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.button, isAnswered ? styles.buttonDisabled : null]}
            onPress={() => handleAnswer(opt)}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
          <Text style={styles.buttonText}>🔄 Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetButton} onPress={handleBack}>
          <Text style={styles.buttonText}>🏠 Volver</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 8 },
  info: { color: "#cfc4b8", marginBottom: 8 },
  timerText: { color: "#d4af37", fontWeight: "800", marginBottom: 6 },
  timerWrapper: {
    width: "90%",
    height: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  timerBar: {
    height: "100%",
    backgroundColor: "#d4af37",
  },
  question: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 14,
  },
  options: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  button: {
    backgroundColor: "#ffffff",
    padding: 14,
    margin: 6,
    borderRadius: 10,
    minWidth: 80,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#1a1a1a", fontWeight: "800", fontSize: 16 },
  bottomButtons: { flexDirection: "row", marginTop: 18 },
  resetButton: {
    backgroundColor: "#d4af37",
    padding: 12,
    marginHorizontal: 8,
    borderRadius: 10,
  },
});
