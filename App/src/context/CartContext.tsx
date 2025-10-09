import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserOrders } from '../api/orders';
import type { Order } from '../types/Order';
import { useAuth } from '../auth/useAuth';

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
  // Items en el carrito local (no enviados aún)
  cartItems: CartItem[];
  // Items de pedidos enviados pero pendientes de confirmación por empleados
  pendingOrderItems: CartItem[];
  
  // Estado del pedido actual
  hasPendingOrder: boolean;
  
  // Funciones para items del carrito local
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  getItemQuantity: (itemId: string) => number;
  clearCart: () => void;
  
  // Función para enviar pedido
  submitOrder: () => Promise<void>;
  
  // Función para refrescar desde la BD
  refreshOrders: () => Promise<void>;
  
  // Estado de carga
  isLoading: boolean;
  
  // Totales
  cartAmount: number;
  pendingOrderAmount: number;
  cartTime: number;
  pendingOrderTime: number;
  cartCount: number;
  pendingOrderCount: number;
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pendingOrderItems, setPendingOrderItems] = useState<CartItem[]>([]);
  const [hasPendingOrder, setHasPendingOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Función para convertir OrderItem a CartItem
  const orderItemToCartItem = (orderItem: any): CartItem => ({
    id: orderItem.menu_item_id,
    name: orderItem.menu_item?.name || 'Producto',
    price: orderItem.unit_price,
    quantity: orderItem.quantity,
    prepMinutes: orderItem.menu_item?.prep_minutes || 0,
    category: orderItem.menu_item?.category || 'otro',
    image_url: orderItem.menu_item?.image_url,
  });

  // Función para cargar pedidos desde la BD
  const loadOrdersFromDatabase = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const orders = await getUserOrders();
      
      // Solo procesar pedidos con status "pending"
      const pendingOrders = orders.filter((order: Order) => order.status === 'pending');
      
      if (pendingOrders.length > 0) {
        // Si hay pedidos pending, el usuario no puede crear más
        setHasPendingOrder(true);
        
        // Mostrar todos los items de pedidos pending
        const allPendingItems: CartItem[] = [];
        pendingOrders.forEach((order: Order) => {
          const cartItems = order.order_items.map(orderItemToCartItem);
          allPendingItems.push(...cartItems);
        });
        
        setPendingOrderItems(allPendingItems);
        // Limpiar carrito local si hay pedidos pending
        setCartItems([]);
      } else {
        // No hay pedidos pending, el usuario puede agregar al carrito
        setHasPendingOrder(false);
        setPendingOrderItems([]);
      }
      
    } catch (error) {
      console.error('Error cargando pedidos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar pedidos al montar el componente o cuando cambie el usuario
  useEffect(() => {
    if (user) {
      loadOrdersFromDatabase();
    } else {
      // Si no hay usuario, limpiar todo
      setCartItems([]);
      setPendingOrderItems([]);
      setHasPendingOrder(false);
    }
  }, [user]);

  // Función pública para refrescar órdenes
  const refreshOrders = async () => {
    await loadOrdersFromDatabase();
  };

  const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
    // Solo permitir agregar items si no hay pedido pending
    if (hasPendingOrder) {
      console.warn('No se pueden agregar items mientras hay un pedido pendiente');
      return;
    }
    
    setCartItems(currentItems => {
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
    setCartItems(currentItems => currentItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCartItems(currentItems =>
      currentItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getItemQuantity = (itemId: string): number => {
    const item = cartItems.find(item => item.id === itemId);
    return item?.quantity || 0;
  };

  const submitOrder = async () => {
    // Esta función ahora solo limpia el carrito local
    // El verdadero envío del pedido se hace desde CartModal usando createOrder
    setCartItems([]);
    // Refrescamos desde la BD para obtener el estado actualizado
    await refreshOrders();
  };

  // Cálculos derivados
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const pendingOrderCount = pendingOrderItems.reduce((total, item) => total + item.quantity, 0);

  const cartAmount = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const pendingOrderAmount = pendingOrderItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  
  // Cálculo del tiempo estimado para items del carrito:
  // Separamos platos y bebidas porque se preparan en paralelo
  const cartTime = (() => {
    if (cartItems.length === 0) return 0;
    
    const platos = cartItems.filter(item => item.category === 'plato');
    const bebidas = cartItems.filter(item => item.category === 'bebida');
    
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

  // Tiempo estimado para pedidos pendientes
  const pendingOrderTime = (() => {
    if (pendingOrderItems.length === 0) return 0;
    
    const platos = pendingOrderItems.filter(item => item.category === 'plato');
    const bebidas = pendingOrderItems.filter(item => item.category === 'bebida');
    
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
    cartItems,
    pendingOrderItems,
    hasPendingOrder,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemQuantity,
    submitOrder,
    refreshOrders,
    isLoading,
    cartAmount,
    pendingOrderAmount,
    cartTime,
    pendingOrderTime,
    cartCount,
    pendingOrderCount,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};