import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
} from "react";
import { ScrollView, Keyboard, Dimensions } from "react-native";

type ScrollContextType = {
  scrollViewRef: React.RefObject<ScrollView | null>;
  scrollToPosition: (y: number, fieldHeight?: number) => void;
};

const ScrollContext = createContext<ScrollContextType | null>(null);

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const lastFieldY = useRef<number | null>(null);
  const isScrolling = useRef(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      e => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
        lastFieldY.current = null;
      },
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  const scrollToPosition = (y: number, fieldHeight: number = 60) => {
    // Si ya hay un scroll en progreso, ignorar
    if (isScrolling.current) {
      return;
    }

    // Obtener la altura de la pantalla
    const screenHeight = Dimensions.get("window").height;

    // Si el teclado aún no se ha mostrado, usar una estimación
    const effectiveKeyboardHeight = keyboardHeight > 0 ? keyboardHeight : screenHeight * 0.4;

    // Calcular cuánto espacio visible hay cuando el teclado está abierto
    const visibleHeight = screenHeight - effectiveKeyboardHeight;

    // Posicionar el campo en el 20% superior del área visible
    const targetPositionFromTop = visibleHeight * 0.2;

    // Calcular el scroll necesario
    const targetScrollY = y - targetPositionFromTop;

    // Si el campo está muy cerca del anterior (menos de 50px), no hacer scroll
    if (lastFieldY.current !== null && Math.abs(y - lastFieldY.current) < 50) {
      lastFieldY.current = y;
      return;
    }

    // Solo hacer scroll si es necesario para mejorar la visibilidad
    // Si el nuevo campo está más arriba que el anterior, y ya está visible, no hacer scroll hacia arriba
    if (lastFieldY.current !== null && y < lastFieldY.current) {
      // El campo está más arriba, verificar si ya está visible
      if (y > targetPositionFromTop) {
        // Ya está en una posición visible, no hacer scroll
        lastFieldY.current = y;
        return;
      }
    }

    // Guardar la posición del campo actual
    lastFieldY.current = y;
    isScrolling.current = true;

    // Hacer scroll con un pequeño delay para que funcione en APK
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, targetScrollY),
        animated: true,
      });
    }, 100);

    // Resetear el flag después de que termine la animación
    setTimeout(() => {
      isScrolling.current = false;
    }, 400);
  };

  return (
    <ScrollContext.Provider value={{ scrollViewRef, scrollToPosition }}>
      {children}
    </ScrollContext.Provider>
  );
};

export const useScroll = () => {
  const context = useContext(ScrollContext);
  if (!context) {
    return {
      scrollViewRef: { current: null },
      scrollToPosition: () => {},
    };
  }
  return context;
};
