import api from "../api/axios";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  prepMinutes: number;
  category: "plato" | "bebida";
  image_url?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  menu_item_images?: any[];
}

// Interface para los datos del backend (como llegan de la BD)
interface BackendMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  prep_minutes: number;
  category: "plato" | "bebida";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  menu_item_images?: any[];
}

// Función para mapear datos del backend a nuestro formato
const mapBackendToMenuItem = (backendItem: BackendMenuItem): MenuItem => ({
  id: backendItem.id,
  name: backendItem.name,
  description: backendItem.description,
  price: backendItem.price,
  prepMinutes: backendItem.prep_minutes,
  category: backendItem.category,
  isActive: backendItem.is_active,
  createdAt: backendItem.created_at,
  updatedAt: backendItem.updated_at,
  menu_item_images: backendItem.menu_item_images
});

/**
 * Obtener todos los items del menú
 */
export const getMenuItems = async (): Promise<MenuItem[]> => {
  try {
    const response = await api.get("/menu/items");
    const backendItems: BackendMenuItem[] = response.data || [];
    return backendItems.map(mapBackendToMenuItem);
  } catch (error: any) {
    console.error("Error obteniendo items del menú:", error);
    throw new Error(error.response?.data?.error || "Error obteniendo menú");
  }
};

/**
 * Obtener solo los platos (para cocina)
 */
export const getDishesForKitchen = async (): Promise<MenuItem[]> => {
  try {
    const response = await api.get("/menu/items?category=plato");
    const backendItems: BackendMenuItem[] = response.data || [];
    return backendItems.map(mapBackendToMenuItem);
  } catch (error: any) {
    console.error("Error obteniendo platos:", error);
    throw new Error(error.response?.data?.error || "Error obteniendo platos");
  }
};

/**
 * Obtener solo las bebidas (para bar)
 */
export const getDrinksForBar = async (): Promise<MenuItem[]> => {
  try {
    const response = await api.get("/menu/items?category=bebida");
    const backendItems: BackendMenuItem[] = response.data || [];
    return backendItems.map(mapBackendToMenuItem);
  } catch (error: any) {
    console.error("Error obteniendo bebidas:", error);
    throw new Error(error.response?.data?.error || "Error obteniendo bebidas");
  }
};