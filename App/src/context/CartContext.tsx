import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  getUserOrders,
  addItemsToPartialOrder,
  addItemsToExistingOrder,
} from "../api/orders";
import type { Order } from "../types/Order";
import { useAuth } from "../auth/useAuth";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  prepMinutes: number;
  category: string;
  image_url?: string;
  // Para items en tandas devueltas
  isOutOfStock?: boolean; // true si status es "rejected" (sin stock)
  needsModification?: boolean; // true si status es "needs_modification" (disponible)
}

export interface CartContextType {
  // Items en el carrito local (no enviados aún)
  cartItems: CartItem[];
  // Items de pedidos enviados pero pendientes de confirmación por empleados
  pendingOrderItems: CartItem[];
  // Items de pedidos parcialmente aprobados que pueden ser modificados
  partialOrderItems: CartItem[];
  // Items de pedidos completamente rechazados (toda la tanda devuelta)
  rejectedOrderItems: CartItem[];
  // Todos los pedidos del usuario con sus estados
  userOrders: Order[];

  // Estado del pedido actual
  hasPendingOrder: boolean;
  hasPartialOrder: boolean;
  hasAcceptedOrder: boolean; // Nueva: órdenes aceptadas que pueden recibir más items
  hasRejectedOrder: boolean; // Nueva: órdenes completamente rechazadas
  acceptedOrderItems: CartItem[]; // Items de la orden aceptada

  // Funciones para items del carrito local
  addItem: (item: Omit<CartItem, "quantity">) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  getItemQuantity: (itemId: string) => number;
  clearCart: () => void;

  // Función para enviar pedido
  submitOrder: () => Promise<void>;

  // Función para agregar items a pedido parcial y convertirlo a pending
  addToPartialOrder: (item: Omit<CartItem, "quantity">) => Promise<void>;

  // Función para enviar carrito local a pedido parcial
  submitToPartialOrder: () => Promise<void>;

  // Función para agregar items a pedido aceptado
  addToAcceptedOrder: (item: Omit<CartItem, "quantity">) => Promise<void>;

  // Función para enviar carrito local a pedido aceptado
  submitToAcceptedOrder: () => Promise<void>;

  // Función para refrescar desde la BD
  refreshOrders: () => Promise<void>;

  // Estado de carga
  isLoading: boolean;

  // Totales
  cartAmount: number;
  pendingOrderAmount: number;
  partialOrderAmount: number;
  acceptedOrderAmount: number;
  cartTime: number;
  pendingOrderTime: number;
  partialOrderTime: number;
  acceptedOrderTime: number;
  cartCount: number;
  pendingOrderCount: number;
  partialOrderCount: number;
  acceptedOrderCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pendingOrderItems, setPendingOrderItems] = useState<CartItem[]>([]);
  const [partialOrderItems, setPartialOrderItems] = useState<CartItem[]>([]);
  const [rejectedOrderItems, setRejectedOrderItems] = useState<CartItem[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [hasPendingOrder, setHasPendingOrder] = useState(false);
  const [hasPartialOrder, setHasPartialOrder] = useState(false);
  const [hasAcceptedOrder, setHasAcceptedOrder] = useState(false);
  const [hasRejectedOrder, setHasRejectedOrder] = useState(false);
  const [acceptedOrderItems, setAcceptedOrderItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Función para convertir OrderItem a CartItem
  const orderItemToCartItem = (orderItem: any): CartItem => {
    try {
      console.log("Converting orderItem to cartItem:", orderItem);
      return {
        id: orderItem.menu_item_id,
        name: orderItem.menu_item?.name || "Producto",
        price: orderItem.unit_price,
        quantity: orderItem.quantity,
        prepMinutes: orderItem.menu_item?.prep_minutes || 0,
        category: orderItem.menu_item?.category || "otro",
        image_url: orderItem.menu_item?.image_url,
        // Agregar información de status para items rechazados
        isOutOfStock: orderItem.status === "rejected",
        needsModification: orderItem.status === "needs_modification",
      };
    } catch (error) {
      console.error(
        "Error converting orderItem to cartItem:",
        error,
        orderItem,
      );
      return {
        id: orderItem?.menu_item_id || "unknown",
        name: "Error en producto",
        price: 0,
        quantity: 1,
        prepMinutes: 0,
        category: "otro",
        image_url: undefined,
        isOutOfStock: false,
        needsModification: false,
      };
    }
  };

  // FUNCIÓN REFACTORIZADA: Cargar pedidos desde la BD
  const loadOrdersFromDatabase = async () => {
    console.log("🚀 Starting loadOrdersFromDatabase");
    if (!user) {
      console.log("❌ No user, returning early");
      return;
    }

    try {
      console.log("📡 Setting loading to true");
      setIsLoading(true);

      console.log("📞 Calling getUserOrders API");
      const orders = await getUserOrders();
      console.log("✅ getUserOrders completed");

      console.log("Orders received from API:", orders);
      console.log("Orders type:", typeof orders);
      console.log("Orders is array:", Array.isArray(orders));

      // Debug detallado de items status
      if (orders && orders.length > 0) {
        orders.forEach((order: any, index: number) => {
          if (!order.order_items) {
            console.warn(`Order ${index} (${order.id}) has no order_items`);
            return;
          }
          console.log(
            `Order ${index} items status:`,
            order.order_items.map((item: any) => ({
              id: item.id,
              status: item.status,
              name: item.menu_item?.name,
            })),
          );
        });
      }

      if (!orders || !Array.isArray(orders)) {
        console.error("Invalid orders response:", orders);
        setUserOrders([]);
        setHasPendingOrder(false);
        setPendingOrderItems([]);
        setHasAcceptedOrder(false);
        setAcceptedOrderItems([]);
        setHasPartialOrder(false);
        setPartialOrderItems([]);
        setHasRejectedOrder(false);
        setRejectedOrderItems([]);
        return;
      }

      console.log("First order structure:", orders[0]);

      // Guardar todas las órdenes para mostrar estados
      setUserOrders(orders);

      // Filtrar solo órdenes NO PAGADAS (las pagadas ya no interesan para el carrito)
      const unpaidOrders = orders.filter((order: Order) => !order.is_paid);

      // Resetear estados inicialmente
      setHasPendingOrder(false);
      setPendingOrderItems([]);
      setHasAcceptedOrder(false);
      setAcceptedOrderItems([]);
      setHasPartialOrder(false);
      setPartialOrderItems([]);
      setHasRejectedOrder(false);
      setRejectedOrderItems([]);

      // Clasificar órdenes por el estado de sus items
      console.log("🔍 Clasificando órdenes...");
      console.log("📊 Total unpaid orders:", unpaidOrders.length);

      const ordersWithPendingItems = unpaidOrders.filter((order: Order) => {
        if (!order.order_items || !Array.isArray(order.order_items)) {
          return false;
        }
        return order.order_items.some(item => item.status === "pending");
      });
      console.log(
        "📋 Orders with PENDING items:",
        ordersWithPendingItems.length,
      );

      const ordersWithAcceptedItems = unpaidOrders.filter(
        (order: Order) =>
          order.order_items &&
          Array.isArray(order.order_items) &&
          order.order_items.some(item => item.status === "accepted") &&
          !order.order_items.some(item => item.status === "pending") &&
          // IMPORTANTE: Solo órdenes COMPLETAMENTE aceptadas (sin rechazados)
          !order.order_items.some(
            item =>
              item.status === "rejected" ||
              item.status === "needs_modification",
          ),
      );
      console.log(
        "✅ Orders with ACCEPTED items:",
        ordersWithAcceptedItems.length,
      );

      // Debug específico para la orden problemática
      console.log("🔍 DEBUGGING ORDER CLASSIFICATION:");
      unpaidOrders.forEach((order: Order, index) => {
        if (order.order_items && Array.isArray(order.order_items)) {
          const hasPending = order.order_items.some(
            item => item.status === "pending",
          );
          const hasAccepted = order.order_items.some(
            item => item.status === "accepted",
          );
          const hasRejected = order.order_items.some(
            item => item.status === "rejected",
          );
          const hasNeedsModification = order.order_items.some(
            item => item.status === "needs_modification",
          );

          console.log(`Order ${index} (ID: ${order.id}):`, {
            totalItems: order.order_items.length,
            hasPending,
            hasAccepted,
            hasRejected,
            hasNeedsModification,
            statusCounts: {
              pending: order.order_items.filter(
                item => item.status === "pending",
              ).length,
              accepted: order.order_items.filter(
                item => item.status === "accepted",
              ).length,
              rejected: order.order_items.filter(
                item => item.status === "rejected",
              ).length,
              needs_modification: order.order_items.filter(
                item => item.status === "needs_modification",
              ).length,
            },
          });
        }
      });

      // Items de tandas COMPLETAMENTE devueltas (solo rejected + needs_modification, sin accepted)
      const ordersWithRejectedItems = unpaidOrders.filter((order: Order) => {
        if (!order.order_items || !Array.isArray(order.order_items))
          return false;

        // Solo orders que ÚNICAMENTE tengan items rechazados/needs_modification
        const hasRejected = order.order_items.some(
          item => item.status === "rejected",
        );
        const hasNeedsModification = order.order_items.some(
          item => item.status === "needs_modification",
        );
        const hasAccepted = order.order_items.some(
          item => item.status === "accepted",
        );
        const hasPending = order.order_items.some(
          item => item.status === "pending",
        );

        // Solo tandas COMPLETAMENTE devueltas (sin accepted ni pending)
        const isCompletelyRejected =
          (hasRejected || hasNeedsModification) && !hasAccepted && !hasPending;

        if (isCompletelyRejected) {
          console.log("🔄 Order completely rejected:", order.id);
        }

        return isCompletelyRejected;
      });
      console.log(
        "❌ Orders with REJECTED items:",
        ordersWithRejectedItems.length,
      );

      const ordersWithPartialItems = unpaidOrders.filter((order: Order) => {
        if (!order.order_items || !Array.isArray(order.order_items))
          return false;

        const hasAccepted = order.order_items.some(
          item => item.status === "accepted",
        );
        const hasRejected = order.order_items.some(
          item => item.status === "rejected",
        );
        const hasNeedsModification = order.order_items.some(
          item => item.status === "needs_modification",
        );

        // Orden parcial: tiene accepted Y (rejected O needs_modification)
        const isPartial = hasAccepted && (hasRejected || hasNeedsModification);

        if (isPartial) {
          console.log("📋 Order is PARTIAL:", order.id, {
            hasAccepted,
            hasRejected,
            hasNeedsModification,
          });
        }

        return isPartial;
      });
      console.log(
        "⚡ Orders with PARTIAL items:",
        ordersWithPartialItems.length,
      );

      // NUEVO: Manejar items pendientes
      if (ordersWithPendingItems.length > 0) {
        setHasPendingOrder(true);

        let allPendingItems: CartItem[] = [];
        try {
          ordersWithPendingItems.forEach((order: Order, orderIndex) => {
            console.log(`Processing pending order ${orderIndex}:`, order);
            // Solo items pendientes de esta orden
            if (order.order_items && Array.isArray(order.order_items)) {
              try {
                const filteredItems = order.order_items.filter(item => {
                  console.log(`Filtering item:`, item);
                  return item && item.status === "pending";
                });

                console.log(`Filtered items:`, filteredItems);

                const pendingItems = filteredItems.map((item, itemIndex) => {
                  console.log(`Mapping item ${itemIndex}:`, item);
                  return orderItemToCartItem(item);
                });

                console.log(`Pending items to add:`, pendingItems);
                console.log(`allPendingItems before push:`, allPendingItems);

                if (
                  Array.isArray(pendingItems) &&
                  Array.isArray(allPendingItems) &&
                  pendingItems.length > 0
                ) {
                  try {
                    allPendingItems.push(...pendingItems);
                    console.log("✅ Successfully pushed pending items");
                  } catch (pushError) {
                    console.error("❌ Error pushing pending items:", pushError);
                    // Fallback seguro
                    allPendingItems = [...allPendingItems, ...pendingItems];
                  }
                } else {
                  console.error("Array validation failed:", {
                    pendingItemsIsArray: Array.isArray(pendingItems),
                    allPendingItemsIsArray: Array.isArray(allPendingItems),
                    pendingItemsLength: pendingItems?.length,
                  });
                }
              } catch (itemError) {
                console.error(
                  `Error processing items for order ${orderIndex}:`,
                  itemError,
                );
              }
            } else {
              console.warn(
                "order.order_items is undefined or not an array:",
                order,
              );
            }
          });
        } catch (err) {
          console.error("Error in pending items processing:", err);
        }

        setPendingOrderItems(allPendingItems);
        // Limpiar carrito local si hay items pendientes
        setCartItems([]);
      } else {
        setHasPendingOrder(false);
        setPendingOrderItems([]);
      }

      // NUEVO: Manejar items aceptados (sin pendientes)
      if (ordersWithAcceptedItems.length > 0) {
        setHasAcceptedOrder(true);

        let allAcceptedItems: CartItem[] = [];
        try {
          ordersWithAcceptedItems.forEach((order: Order) => {
            // Solo items aceptados de esta orden
            if (order.order_items && Array.isArray(order.order_items)) {
              try {
                const acceptedItems = order.order_items
                  .filter(item => item && item.status === "accepted")
                  .map(orderItemToCartItem);

                if (
                  Array.isArray(acceptedItems) &&
                  Array.isArray(allAcceptedItems) &&
                  acceptedItems.length > 0
                ) {
                  try {
                    allAcceptedItems.push(...acceptedItems);
                    console.log("✅ Successfully pushed accepted items");
                  } catch (pushError) {
                    console.error(
                      "❌ Error pushing accepted items:",
                      pushError,
                    );
                    // Fallback seguro
                    allAcceptedItems = [...allAcceptedItems, ...acceptedItems];
                  }
                } else {
                  console.error("Accepted items array validation failed:", {
                    acceptedItemsIsArray: Array.isArray(acceptedItems),
                    allAcceptedItemsIsArray: Array.isArray(allAcceptedItems),
                    acceptedItemsLength: acceptedItems?.length,
                  });
                }
              } catch (itemError) {
                console.error("Error processing accepted items:", itemError);
              }
            } else {
              console.warn(
                "order.order_items is undefined or not an array:",
                order,
              );
            }
          });
        } catch (err) {
          console.error("Error in accepted items processing:", err);
        }

        setAcceptedOrderItems(allAcceptedItems);
      } else {
        setHasAcceptedOrder(false);
        setAcceptedOrderItems([]);
      }

      // NUEVO: Manejar pedidos parciales (aceptados + rechazados)
      if (ordersWithPartialItems.length > 0) {
        console.log(
          "🔥 PROCESSING PARTIAL ORDERS:",
          ordersWithPartialItems.length,
        );
        setHasPartialOrder(true);

        let allPartialItems: CartItem[] = [];
        console.log("🔥 Initial allPartialItems:", allPartialItems);

        try {
          ordersWithPartialItems.forEach((order: Order, orderIndex) => {
            console.log(`🔥 Processing partial order ${orderIndex}:`, order.id);
            // Solo items aceptados del pedido parcial
            if (order.order_items && Array.isArray(order.order_items)) {
              console.log(`🔥 Order has ${order.order_items.length} items`);
              try {
                const acceptedItems = order.order_items
                  .filter(item => item && item.status === "accepted")
                  .map(orderItemToCartItem)
                  .filter(cartItem => cartItem != null); // Filtrar items null/undefined

                console.log(
                  `🔥 Filtered ${acceptedItems.length} accepted items`,
                );
                console.log(
                  `🔥 Before push - allPartialItems length:`,
                  allPartialItems.length,
                );

                if (
                  Array.isArray(acceptedItems) &&
                  Array.isArray(allPartialItems) &&
                  acceptedItems.length > 0
                ) {
                  console.log(
                    "🔥 About to push accepted items to allPartialItems",
                  );
                  try {
                    allPartialItems.push(...acceptedItems);
                    console.log(
                      `🔥 After push - allPartialItems length:`,
                      allPartialItems.length,
                    );
                    console.log("✅ Successfully pushed partial items");
                  } catch (pushError) {
                    console.error("❌ Error pushing partial items:", pushError);
                    // Fallback seguro
                    allPartialItems = [...allPartialItems, ...acceptedItems];
                  }
                } else {
                  console.error("Partial items array validation failed:", {
                    acceptedItemsIsArray: Array.isArray(acceptedItems),
                    allPartialItemsIsArray: Array.isArray(allPartialItems),
                    acceptedItemsLength: acceptedItems?.length,
                  });
                }
              } catch (itemError) {
                console.error("Error processing partial items:", itemError);
              }
            } else {
              console.warn(
                "order.order_items is undefined or not an array:",
                order,
              );
            }
          });
        } catch (err) {
          console.error("Error in partial items processing:", err);
        }

        setPartialOrderItems(allPartialItems);
      } else {
        setHasPartialOrder(false);
        setPartialOrderItems([]);
      }

      // NUEVO: Manejar órdenes completamente rechazadas (toda la tanda devuelta)
      if (ordersWithRejectedItems.length > 0) {
        setHasRejectedOrder(true);

        let allRejectedItems: CartItem[] = [];
        try {
          ordersWithRejectedItems.forEach((order: Order) => {
            // Todos los items rechazados de esta orden
            if (order.order_items && Array.isArray(order.order_items)) {
              try {
                const rejectedItems = order.order_items
                  .filter(
                    item =>
                      item &&
                      (item.status === "rejected" ||
                        item.status === "needs_modification"),
                  )
                  .map(orderItemToCartItem);

                if (
                  Array.isArray(rejectedItems) &&
                  Array.isArray(allRejectedItems) &&
                  rejectedItems.length > 0
                ) {
                  try {
                    allRejectedItems.push(...rejectedItems);
                    console.log("✅ Successfully pushed rejected items");
                  } catch (pushError) {
                    console.error(
                      "❌ Error pushing rejected items:",
                      pushError,
                    );
                    // Fallback seguro
                    allRejectedItems = [...allRejectedItems, ...rejectedItems];
                  }
                } else {
                  console.error("Rejected items array validation failed:", {
                    rejectedItemsIsArray: Array.isArray(rejectedItems),
                    allRejectedItemsIsArray: Array.isArray(allRejectedItems),
                    rejectedItemsLength: rejectedItems?.length,
                  });
                }
              } catch (itemError) {
                console.error("Error processing rejected items:", itemError);
              }
            } else {
              console.warn(
                "order.order_items is undefined or not an array:",
                order,
              );
            }
          });
        } catch (err) {
          console.error("Error in rejected items processing:", err);
        }

        setRejectedOrderItems(allRejectedItems);
      } else {
        setHasRejectedOrder(false);
        setRejectedOrderItems([]);
      }
    } catch (error) {
      console.error("Error cargando pedidos:", error);
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
      setPartialOrderItems([]);
      setRejectedOrderItems([]);
      setUserOrders([]);
      setHasPendingOrder(false);
      setHasPartialOrder(false);
      setHasRejectedOrder(false);
    }
  }, [user]);

  // Función pública para refrescar órdenes
  const refreshOrders = async () => {
    await loadOrdersFromDatabase();
  };

  // Función para agregar items a pedido parcial
  const addToPartialOrder = async (newItem: Omit<CartItem, "quantity">) => {
    if (!hasPartialOrder) {
      console.warn("No hay pedido parcial al cual agregar items");
      return;
    }

    try {
      // Primero agregar al carrito local temporalmente
      setCartItems(currentItems => {
        const existingItem = currentItems.find(item => item.id === newItem.id);

        if (existingItem) {
          return currentItems.map(item =>
            item.id === newItem.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        } else {
          return [...currentItems, { ...newItem, quantity: 1 }];
        }
      });

      // Refrescar órdenes para obtener el estado actualizado
      await refreshOrders();
    } catch (error) {
      console.error("Error agregando item a pedido parcial:", error);
    }
  };

  // Función para enviar items del carrito local al pedido parcial
  const submitToPartialOrder = async () => {
    if (!hasPartialOrder || cartItems.length === 0) {
      console.warn("No hay pedido parcial o carrito vacío");
      return;
    }

    try {
      // Obtener orden con items parciales (aceptados + rechazados)
      const orders = await getUserOrders();
      const partialOrder = orders.find(
        order =>
          !order.is_paid &&
          order.order_items.some(item => item.status === "accepted") &&
          order.order_items.some(item => item.status === "rejected"),
      );

      if (!partialOrder) {
        throw new Error("No se encontró pedido parcial");
      }

      // Importar la función API
      const { addItemsToPartialOrder } = await import("../api/orders");

      // Convertir items del carrito al formato requerido
      const itemsToAdd = cartItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        prepMinutes: item.prepMinutes,
        quantity: item.quantity,
        image_url: item.image_url,
      }));

      // Enviar items al pedido parcial
      await addItemsToPartialOrder(partialOrder.id, itemsToAdd);

      // Limpiar carrito local
      setCartItems([]);

      // Refrescar órdenes para obtener el estado actualizado
      await refreshOrders();

      console.log("✅ Items enviados exitosamente al pedido parcial");
    } catch (error) {
      console.error("Error enviando items a pedido parcial:", error);
      throw error;
    }
  };

  // ===== FUNCIONES PARA PEDIDOS ACEPTADOS =====
  const addToAcceptedOrder = async (newItem: Omit<CartItem, "quantity">) => {
    try {
      // Obtener orden con items aceptados (sin pendientes)
      const orders = await getUserOrders();
      const acceptedOrder = orders.find(
        order =>
          !order.is_paid &&
          order.order_items.some(item => item.status === "accepted") &&
          !order.order_items.some(item => item.status === "pending"),
      );

      if (!acceptedOrder) {
        throw new Error("No se encontró pedido aceptado");
      }

      // Convertir item al formato requerido
      const itemToAdd = {
        id: newItem.id,
        name: newItem.name,
        category: newItem.category,
        price: newItem.price,
        prepMinutes: newItem.prepMinutes,
        quantity: 1,
        image_url: newItem.image_url,
      };

      // Enviar item a la orden aceptada
      await addItemsToExistingOrder(acceptedOrder.id, [itemToAdd]);

      // Refrescar órdenes para obtener el estado actualizado
      await refreshOrders();

      console.log("✅ Item agregado exitosamente a pedido aceptado");
    } catch (error) {
      console.error("Error agregando item a pedido aceptado:", error);
      throw error;
    }
  };

  const submitToAcceptedOrder = async () => {
    if (cartItems.length === 0) {
      console.warn("El carrito está vacío");
      return;
    }

    try {
      // Obtener el ID de la orden aceptada
      const orders = await getUserOrders();
      const acceptedOrder = orders.find(
        order =>
          !order.is_paid &&
          order.order_items.some(item => item.status === "accepted") &&
          !order.order_items.some(item => item.status === "pending"),
      );

      if (!acceptedOrder) {
        throw new Error("No se encontró pedido aceptado sin items pendientes");
      }

      // Convertir items del carrito al formato requerido
      const itemsToAdd = cartItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        prepMinutes: item.prepMinutes,
        quantity: item.quantity,
        image_url: item.image_url,
      }));

      // Enviar items a la orden aceptada
      await addItemsToExistingOrder(acceptedOrder.id, itemsToAdd);

      // Limpiar carrito local
      setCartItems([]);

      // Refrescar órdenes para obtener el estado actualizado
      await refreshOrders();

      console.log("✅ Items enviados exitosamente a pedido aceptado");
    } catch (error) {
      console.error("Error enviando items a pedido aceptado:", error);
      throw error;
    }
  };

  const addItem = (newItem: Omit<CartItem, "quantity">) => {
    // Solo permitir agregar items si no hay pedido pending
    if (hasPendingOrder) {
      console.warn(
        "No se pueden agregar items mientras hay un pedido pendiente",
      );
      return;
    }

    // SIEMPRE agregar al carrito local primero, sin importar si hay pedidos existentes
    // El usuario podrá revisar y confirmar antes de enviar como nueva tanda
    setCartItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === newItem.id);

      if (existingItem) {
        // Si ya existe, incrementar cantidad
        return currentItems.map(item =>
          item.id === newItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      } else {
        // Si no existe, agregar nuevo
        return [...currentItems, { ...newItem, quantity: 1 }];
      }
    });
  };

  const removeItem = (itemId: string) => {
    setCartItems(currentItems =>
      currentItems.filter(item => item.id !== itemId),
    );
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCartItems(currentItems =>
      currentItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item,
      ),
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
  const pendingOrderCount = pendingOrderItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const partialOrderCount = partialOrderItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const acceptedOrderCount = acceptedOrderItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const cartAmount = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const pendingOrderAmount = pendingOrderItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const partialOrderAmount = partialOrderItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const acceptedOrderAmount = acceptedOrderItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  // Cálculo del tiempo estimado para items del carrito:
  // Separamos platos y bebidas porque se preparan en paralelo
  const cartTime = (() => {
    if (cartItems.length === 0) return 0;

    const platos = cartItems.filter(item => item.category === "plato");
    const bebidas = cartItems.filter(item => item.category === "bebida");

    const platosCount = platos.reduce((sum, item) => sum + item.quantity, 0);
    const bebidasCount = bebidas.reduce((sum, item) => sum + item.quantity, 0);

    let tiempoPlatos = 0;
    let tiempoBebidas = 0;

    // Calcular tiempo de platos
    if (platosCount > 0) {
      const maxTiempoPlato = Math.max(...platos.map(item => item.prepMinutes));
      tiempoPlatos =
        platosCount === 1 ? maxTiempoPlato : maxTiempoPlato + platosCount;
    }

    // Calcular tiempo de bebidas
    if (bebidasCount > 0) {
      const maxTiempoBebida = Math.max(
        ...bebidas.map(item => item.prepMinutes),
      );
      tiempoBebidas =
        bebidasCount === 1 ? maxTiempoBebida : maxTiempoBebida + bebidasCount;
    }

    // El tiempo total es el máximo entre platos y bebidas
    // (porque se preparan en paralelo)
    return Math.max(tiempoPlatos, tiempoBebidas);
  })();

  // Tiempo estimado para pedidos pendientes
  const pendingOrderTime = (() => {
    if (pendingOrderItems.length === 0) return 0;

    const platos = pendingOrderItems.filter(item => item.category === "plato");
    const bebidas = pendingOrderItems.filter(
      item => item.category === "bebida",
    );

    const platosCount = platos.reduce((sum, item) => sum + item.quantity, 0);
    const bebidasCount = bebidas.reduce((sum, item) => sum + item.quantity, 0);

    let tiempoPlatos = 0;
    let tiempoBebidas = 0;

    // Calcular tiempo de platos
    if (platosCount > 0) {
      const maxTiempoPlato = Math.max(...platos.map(item => item.prepMinutes));
      tiempoPlatos =
        platosCount === 1 ? maxTiempoPlato : maxTiempoPlato + platosCount;
    }

    // Calcular tiempo de bebidas
    if (bebidasCount > 0) {
      const maxTiempoBebida = Math.max(
        ...bebidas.map(item => item.prepMinutes),
      );
      tiempoBebidas =
        bebidasCount === 1 ? maxTiempoBebida : maxTiempoBebida + bebidasCount;
    }

    // El tiempo total es el máximo entre platos y bebidas
    return Math.max(tiempoPlatos, tiempoBebidas);
  })();

  // Tiempo estimado para pedidos parciales
  const partialOrderTime = (() => {
    if (partialOrderItems.length === 0) return 0;

    const platos = partialOrderItems.filter(item => item.category === "plato");
    const bebidas = partialOrderItems.filter(
      item => item.category === "bebida",
    );

    const platosCount = platos.reduce((sum, item) => sum + item.quantity, 0);
    const bebidasCount = bebidas.reduce((sum, item) => sum + item.quantity, 0);

    let tiempoPlatos = 0;
    let tiempoBebidas = 0;

    // Calcular tiempo de platos
    if (platosCount > 0) {
      const maxTiempoPlato = Math.max(...platos.map(item => item.prepMinutes));
      tiempoPlatos =
        platosCount === 1 ? maxTiempoPlato : maxTiempoPlato + platosCount;
    }

    // Calcular tiempo de bebidas
    if (bebidasCount > 0) {
      const maxTiempoBebida = Math.max(
        ...bebidas.map(item => item.prepMinutes),
      );
      tiempoBebidas =
        bebidasCount === 1 ? maxTiempoBebida : maxTiempoBebida + bebidasCount;
    }

    // El tiempo total es el máximo entre platos y bebidas
    return Math.max(tiempoPlatos, tiempoBebidas);
  })();

  // Tiempo estimado para pedidos aceptados
  const acceptedOrderTime = (() => {
    if (acceptedOrderItems.length === 0) return 0;

    const platos = acceptedOrderItems.filter(item => item.category === "plato");
    const bebidas = acceptedOrderItems.filter(
      item => item.category === "bebida",
    );

    const platosCount = platos.reduce((sum, item) => sum + item.quantity, 0);
    const bebidasCount = bebidas.reduce((sum, item) => sum + item.quantity, 0);

    let tiempoPlatos = 0;
    let tiempoBebidas = 0;

    // Calcular tiempo de platos
    if (platosCount > 0) {
      const maxTiempoPlato = Math.max(...platos.map(item => item.prepMinutes));
      tiempoPlatos =
        platosCount === 1 ? maxTiempoPlato : maxTiempoPlato + platosCount;
    }

    // Calcular tiempo de bebidas
    if (bebidasCount > 0) {
      const maxTiempoBebida = Math.max(
        ...bebidas.map(item => item.prepMinutes),
      );
      tiempoBebidas =
        bebidasCount === 1 ? maxTiempoBebida : maxTiempoBebida + bebidasCount;
    }

    // El tiempo total es el máximo entre platos y bebidas
    return Math.max(tiempoPlatos, tiempoBebidas);
  })();

  const value: CartContextType = {
    cartItems,
    pendingOrderItems,
    partialOrderItems,
    acceptedOrderItems,
    rejectedOrderItems,
    userOrders,
    hasPendingOrder,
    hasPartialOrder,
    hasAcceptedOrder,
    hasRejectedOrder,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemQuantity,
    submitOrder,
    addToPartialOrder,
    submitToPartialOrder,
    addToAcceptedOrder,
    submitToAcceptedOrder,
    refreshOrders,
    isLoading,
    cartAmount,
    pendingOrderAmount,
    partialOrderAmount,
    acceptedOrderAmount,
    cartTime,
    pendingOrderTime,
    partialOrderTime,
    acceptedOrderTime,
    cartCount,
    pendingOrderCount,
    partialOrderCount,
    acceptedOrderCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
