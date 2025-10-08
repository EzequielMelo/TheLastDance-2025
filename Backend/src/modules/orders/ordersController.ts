import type { Request, Response } from "express";
import { z } from "zod";
import { 
  createOrder, 
  getOrderById, 
  getUserOrders, 
  getTableOrders, 
  updateOrderStatus, 
  getPendingOrders 
} from "./ordersServices";
import type { CreateOrderDTO } from "./orders.types";

const createOrderSchema = z.object({
  table_id: z.string().uuid().optional(),
  items: z.array(z.object({
    id: z.string().uuid(), // menu_item_id
    name: z.string(),
    category: z.string(),
    price: z.number(),
    prepMinutes: z.number(),
    quantity: z.number().int().min(1).max(10),
    image_url: z.string().optional(),
  })).min(1).max(20),
  totalAmount: z.number(),
  estimatedTime: z.number(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']),
});

// Crear nuevo pedido
export async function createOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const parsed = createOrderSchema.parse(req.body);
    const userId = req.user.appUserId;

    console.log('🛒 Creando pedido para usuario:', userId);
    console.log('📦 Datos del pedido:', JSON.stringify(parsed, null, 2));

    const orderData: CreateOrderDTO = {
      table_id: parsed.table_id,
      items: parsed.items as any,
      totalAmount: parsed.totalAmount,
      estimatedTime: parsed.estimatedTime,
      notes: parsed.notes || null
    };

    const order = await createOrder(orderData, userId);

    console.log('✅ Pedido creado exitosamente:', order.id);
    res.status(201).json({
      success: true,
      message: "Pedido creado exitosamente",
      order,
    });

  } catch (error: any) {
    console.error('❌ Error en createOrderHandler:', error);
    
    if (error.name === 'ZodError') {
      res.status(400).json({ 
        error: "Datos del pedido inválidos",
        details: error.errors
      });
      return;
    }
    
    res.status(400).json({ 
      error: error.message || "Error al crear el pedido" 
    });
  }
}

// Obtener pedido específico
export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      res.status(400).json({ error: "ID del pedido requerido" });
      return;
    }

    const order = await getOrderById(orderId);
    res.json(order);

  } catch (error: any) {
    console.error('❌ Error en getOrderHandler:', error);
    res.status(404).json({ 
      error: error.message || "Pedido no encontrado" 
    });
  }
}

// Obtener pedidos del usuario actual
export async function getUserOrdersHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const userId = req.user.appUserId;
    const orders = await getUserOrders(userId);
    
    res.json(orders);

  } catch (error: any) {
    console.error('❌ Error en getUserOrdersHandler:', error);
    res.status(400).json({ 
      error: error.message || "Error al obtener pedidos" 
    });
  }
}

// Obtener pedidos de una mesa específica
export async function getTableOrdersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { tableId } = req.params;
    
    if (!tableId) {
      res.status(400).json({ error: "ID de mesa requerido" });
      return;
    }

    const orders = await getTableOrders(tableId);
    res.json(orders);

  } catch (error: any) {
    console.error('❌ Error en getTableOrdersHandler:', error);
    res.status(400).json({ 
      error: error.message || "Error al obtener pedidos de la mesa" 
    });
  }
}

// Actualizar estado del pedido (para empleados)
export async function updateOrderStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar permisos (solo empleados pueden cambiar estados)
    const userProfile = req.user.profile_code;
    const userPosition = req.user.position_code;
    const canUpdateStatus = 
      userProfile === 'dueno' || 
      userProfile === 'supervisor' || 
      userPosition === 'mozo' || 
      userPosition === 'maitre';

    if (!canUpdateStatus) {
      res.status(403).json({ 
        error: "No tienes permisos para actualizar pedidos" 
      });
      return;
    }

    const { orderId } = req.params;
    const parsed = updateStatusSchema.parse(req.body);

    if (!orderId) {
      res.status(400).json({ error: "ID del pedido requerido" });
      return;
    }

    const updatedOrder = await updateOrderStatus(orderId, parsed.status);
    
    console.log(`✅ Estado del pedido ${orderId} actualizado a: ${parsed.status}`);
    res.json({
      success: true,
      message: "Estado actualizado exitosamente",
      order: updatedOrder,
    });

  } catch (error: any) {
    console.error('❌ Error en updateOrderStatusHandler:', error);
    res.status(400).json({ 
      error: error.message || "Error al actualizar estado del pedido" 
    });
  }
}

// Obtener pedidos pendientes (para empleados)
export async function getPendingOrdersHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar permisos (solo empleados pueden ver pedidos pendientes)
    const userProfile = req.user.profile_code;
    const userPosition = req.user.position_code;
    const canViewPending = 
      userProfile === 'dueno' || 
      userProfile === 'supervisor' || 
      userPosition === 'mozo' || 
      userPosition === 'maitre' ||
      userPosition === 'cocinero' ||
      userPosition === 'bartender';

    if (!canViewPending) {
      res.status(403).json({ 
        error: "No tienes permisos para ver pedidos pendientes" 
      });
      return;
    }

    const orders = await getPendingOrders();
    res.json(orders);

  } catch (error: any) {
    console.error('❌ Error en getPendingOrdersHandler:', error);
    res.status(400).json({ 
      error: error.message || "Error al obtener pedidos pendientes" 
    });
  }
}