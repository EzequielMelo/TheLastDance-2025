import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  prepMinutes: number;
  category: string;
  image_url?: string;
}

export interface CartContextType {
  // Items pendientes (carrito actual)
  pendingItems: CartItem[];
  // Items confirmados (ya enviados a cocina)
  confirmedItems: CartItem[];
  
  // Funciones para items pendientes
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  getItemQuantity: (itemId: string) => number;
  clearPendingItems: () => void;
  
  // Función para confirmar pedido
  confirmOrder: () => void;
  
  // Totales
  pendingAmount: number;
  confirmedAmount: number;
  totalAmount: number;
  pendingTime: number;
  totalTime: number;
  pendingCount: number;
  confirmedCount: number;
  totalCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
  const [confirmedItems, setConfirmedItems] = useState<CartItem[]>([]);

  const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
    setPendingItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === newItem.id);
      
      if (existingItem) {
        // Si ya existe, incrementar cantidad
        return currentItems.map(item =>
          item.id === newItem.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Si no existe, agregar nuevo
        return [...currentItems, { ...newItem, quantity: 1 }];
      }
    });
  };

  const removeItem = (itemId: string) => {
    setPendingItems(currentItems => currentItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setPendingItems(currentItems =>
      currentItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const clearPendingItems = () => {
    setPendingItems([]);
  };

  const getItemQuantity = (itemId: string): number => {
    const item = pendingItems.find(item => item.id === itemId);
    return item?.quantity || 0;
  };

  const confirmOrder = () => {
    // Mover items pendientes a confirmados
    setConfirmedItems(prev => [...prev, ...pendingItems]);
    // Limpiar items pendientes
    setPendingItems([]);
  };

  // Cálculos derivados
  const pendingCount = pendingItems.reduce((total, item) => total + item.quantity, 0);
  const confirmedCount = confirmedItems.reduce((total, item) => total + item.quantity, 0);
  const totalCount = pendingCount + confirmedCount;

  const pendingAmount = pendingItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const confirmedAmount = confirmedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const totalAmount = pendingAmount + confirmedAmount;
  
  // Cálculo del tiempo estimado para items pendientes:
  // Separamos platos y bebidas porque se preparan en paralelo
  const pendingTime = (() => {
    if (pendingItems.length === 0) return 0;
    
    const platos = pendingItems.filter(item => item.category === 'plato');
    const bebidas = pendingItems.filter(item => item.category === 'bebida');
    
    const platosCount = platos.reduce((sum, item) => sum + item.quantity, 0);
    const bebidasCount = bebidas.reduce((sum, item) => sum + item.quantity, 0);
    
    let tiempoPlatos = 0;
    let tiempoBebidas = 0;
    
    // Calcular tiempo de platos
    if (platosCount > 0) {
      const maxTiempoPlato = Math.max(...platos.map(item => item.prepMinutes));
      tiempoPlatos = platosCount === 1 ? maxTiempoPlato : maxTiempoPlato + platosCount;
    }
    
    // Calcular tiempo de bebidas
    if (bebidasCount > 0) {
      const maxTiempoBebida = Math.max(...bebidas.map(item => item.prepMinutes));
      tiempoBebidas = bebidasCount === 1 ? maxTiempoBebida : maxTiempoBebida + bebidasCount;
    }
    
    // El tiempo total es el máximo entre platos y bebidas
    // (porque se preparan en paralelo)
    return Math.max(tiempoPlatos, tiempoBebidas);
  })();

  // Tiempo total considerando todos los items (pendientes + confirmados)
  const totalTime = (() => {
    const allItems = [...pendingItems, ...confirmedItems];
    if (allItems.length === 0) return 0;
    
    const platos = allItems.filter(item => item.category === 'plato');
    const bebidas = allItems.filter(item => item.category === 'bebida');
    
    const platosCount = platos.reduce((sum, item) => sum + item.quantity, 0);
    const bebidasCount = bebidas.reduce((sum, item) => sum + item.quantity, 0);
    
    let tiempoPlatos = 0;
    let tiempoBebidas = 0;
    
    // Calcular tiempo de platos
    if (platosCount > 0) {
      const maxTiempoPlato = Math.max(...platos.map(item => item.prepMinutes));
      tiempoPlatos = platosCount === 1 ? maxTiempoPlato : maxTiempoPlato + platosCount;
    }
    
    // Calcular tiempo de bebidas
    if (bebidasCount > 0) {
      const maxTiempoBebida = Math.max(...bebidas.map(item => item.prepMinutes));
      tiempoBebidas = bebidasCount === 1 ? maxTiempoBebida : maxTiempoBebida + bebidasCount;
    }
    
    // El tiempo total es el máximo entre platos y bebidas
    return Math.max(tiempoPlatos, tiempoBebidas);
  })();

  const value: CartContextType = {
    pendingItems,
    confirmedItems,
    addItem,
    removeItem,
    updateQuantity,
    clearPendingItems,
    getItemQuantity,
    confirmOrder,
    pendingAmount,
    confirmedAmount,
    totalAmount,
    pendingTime,
    totalTime,
    pendingCount,
    confirmedCount,
    totalCount,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};