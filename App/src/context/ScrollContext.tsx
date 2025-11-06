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

    // Si el campo es muy similar al anterior (menos de 80px de diferencia), no hacer scroll
    if (lastFieldY.current !== null && Math.abs(y - lastFieldY.current) < 80) {
      lastFieldY.current = y;
      return;
    }

    if (keyboardHeight === 0) {
      // Si el teclado no está visible aún, esperar un poco más
      setTimeout(() => {
        if (keyboardHeight > 0) {
          scrollToPosition(y, fieldHeight);
        }
      }, 100);
      return;
    }

    // Obtener la altura de la pantalla
    const screenHeight = Dimensions.get("window").height;

    // Calcular cuánto espacio visible hay cuando el teclado está abierto
    const visibleHeight = screenHeight - keyboardHeight;

    // Margen superior para el header y elementos superiores
    const topMargin = 100;

    // Calcular cuánto necesitamos hacer scroll
    const targetScrollY = y - topMargin;

    // Guardar la posición del campo actual
    lastFieldY.current = y;
    isScrolling.current = true;

    // Hacer scroll suave
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, targetScrollY),
      animated: true,
    });

    // Resetear el flag después de que termine la animación
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
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
