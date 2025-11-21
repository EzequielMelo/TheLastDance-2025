import type { Request, Response } from "express";
import * as deliveryService from "./deliveryServices";
import type {
  CreateDeliveryDTO,
  UpdateDeliveryStatusDTO,
} from "./delivery.types";
import { getIOInstance } from "../../socket/chatSocket";
import { DeliveryChatServices } from "./deliveryChatServices";
import { notifyDeliveryChatClosed } from "../../socket/deliveryChatSocket";
import { supabaseAdmin } from "../../config/supabase";

/**
 * POST /api/deliveries
 * Crear un nuevo delivery
 */
export async function createDelivery(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const data: CreateDeliveryDTO = req.body;

    // Validar datos requeridos
    if (
      !data.delivery_order_id || // 🔄 Cambiado de order_id
      !data.delivery_address ||
      data.delivery_latitude === undefined ||
      data.delivery_longitude === undefined
    ) {
      res.status(400).json({
        success: false,
        error: "Faltan datos requeridos",
      });
      return;
    }

    const delivery = await deliveryService.createDelivery(
      req.user.appUserId,
      data,
    );

    res.status(201).json({
      success: true,
      delivery,
      message: "Delivery creado exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en createDelivery:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al crear delivery",
    });
  }
}

/**
 * GET /api/deliveries/active
 * Obtener delivery activo del usuario
 */
export async function getActiveDelivery(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const delivery = await deliveryService.getActiveDelivery(
      req.user.appUserId,
    );

    res.json({
      success: true,
      delivery,
      hasActiveDelivery: !!delivery,
    });
  } catch (error: any) {
    console.error("❌ Error en getActiveDelivery:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener delivery activo",
    });
  }
}

/**
 * GET /api/deliveries/pending
 * Obtener deliveries pendientes (solo dueño/supervisor)
 */
export async function getPendingDeliveries(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    // Verificar permisos
    if (
      req.user.profile_code !== "dueno" &&
      req.user.profile_code !== "supervisor"
    ) {
      res.status(403).json({
        success: false,
        error: "No tienes permisos para ver deliveries pendientes",
      });
      return;
    }

    const deliveries = await deliveryService.getPendingDeliveries();

    res.json({
      success: true,
      deliveries,
      count: deliveries.length,
    });
  } catch (error: any) {
    console.error("❌ Error en getPendingDeliveries:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener deliveries pendientes",
    });
  }
}

/**
 * GET /api/deliveries/ready
 * Obtener deliveries listos para ser tomados (solo repartidores)
 */
export async function getReadyDeliveries(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    // Verificar que el usuario sea repartidor (empleado)
    if (req.user.profile_code !== "empleado") {
      res.status(403).json({
        success: false,
        error: "Solo los repartidores pueden ver pedidos listos",
      });
      return;
    }

    const deliveries = await deliveryService.getReadyDeliveries();

    res.json({
      success: true,
      deliveries,
      count: deliveries.length,
    });
  } catch (error: any) {
    console.error("❌ Error en getReadyDeliveries:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener deliveries listos",
    });
  }
}

/**
 * GET /api/deliveries/confirmed
 * Obtener deliveries confirmados sin asignar (solo dueño/supervisor)
 */
export async function getConfirmedDeliveries(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    // Verificar permisos
    if (
      req.user.profile_code !== "dueno" &&
      req.user.profile_code !== "supervisor"
    ) {
      res.status(403).json({
        success: false,
        error: "No tienes permisos para ver deliveries confirmados",
      });
      return;
    }

    const deliveries = await deliveryService.getConfirmedDeliveries();

    res.json({
      success: true,
      deliveries,
      count: deliveries.length,
    });
  } catch (error: any) {
    console.error("❌ Error en getConfirmedDeliveries:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener deliveries confirmados",
    });
  }
}

/**
 * GET /api/deliveries/driver
 * Obtener deliveries asignados al repartidor
 */
export async function getDriverDeliveries(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const deliveries = await deliveryService.getDriverDeliveries(
      req.user.appUserId,
    );

    res.json({
      success: true,
      deliveries,
      count: deliveries.length,
    });
  } catch (error: any) {
    console.error("❌ Error en getDriverDeliveries:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener deliveries del repartidor",
    });
  }
}

/**
 * PUT /api/deliveries/:id/status
 * Actualizar estado de un delivery (solo dueño/supervisor)
 */
export async function updateDeliveryStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { id } = req.params;
    const { status }: UpdateDeliveryStatusDTO = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "ID del delivery es requerido",
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        error: "El estado es requerido",
      });
      return;
    }

    const delivery = await deliveryService.updateDeliveryStatus(
      id,
      status,
      req.user.appUserId,
      req.user.profile_code,
    );

    // � Si el estado es "delivered", desactivar el chat
    if (status === "delivered") {
      try {
        await DeliveryChatServices.deactivateChat(delivery.id);
        // Notificar a ambos usuarios que el chat se cerró
        const io = getIOInstance();
        if (io) {
          const chat = await DeliveryChatServices.getChatByDeliveryId(
            delivery.id,
          );
          if (chat) {
            notifyDeliveryChatClosed(io, chat.id);
          }
        }
      } catch (chatError) {
        console.error("❌ Error al desactivar chat de delivery:", chatError);
        // No bloqueamos la actualización si falla el cierre del chat
      }
    }

    // �🔔 Emitir evento Socket.IO al usuario del delivery
    const io = getIOInstance();
    if (io && delivery.user_id) {
      const userRoom = `user_${delivery.user_id}`;
      io.to(userRoom).emit("delivery_updated", delivery);
      io.to(userRoom).emit("delivery_status_changed", {
        deliveryId: delivery.id,
        newStatus: delivery.status,
      });
    }

    res.json({
      success: true,
      delivery,
      message: "Estado actualizado exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en updateDeliveryStatus:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al actualizar estado del delivery",
    });
  }
}

/**
 * POST /api/deliveries/:id/take
 * Repartidor toma un pedido (acepta delivery con estado "ready")
 */
export async function takeDelivery(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    // Verificar que el usuario sea repartidor (empleado)
    if (req.user.profile_code !== "empleado") {
      res.status(403).json({
        success: false,
        error: "Solo los repartidores pueden tomar pedidos",
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "ID del delivery es requerido",
      });
      return;
    }

    const delivery = await deliveryService.takeDelivery(id, req.user.appUserId);

    // 💬 Crear chat automáticamente entre cliente y repartidor
    try {
      await DeliveryChatServices.getOrCreateChat(
        delivery.id,
        delivery.user_id,
        req.user.appUserId,
      );
    } catch (chatError) {
      console.error("❌ Error al crear chat de delivery:", chatError);
      // No bloqueamos el takeDelivery si falla el chat
    }

    res.json({
      success: true,
      delivery,
      message: "Pedido tomado exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en takeDelivery:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al tomar el pedido",
    });
  }
}

/**
 * PUT /api/deliveries/:id/assign-driver
 * Asignar repartidor a un delivery (solo dueño/supervisor)
 */
export async function assignDriver(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { id } = req.params;
    const { driver_id } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "ID del delivery es requerido",
      });
      return;
    }

    if (!driver_id) {
      res.status(400).json({
        success: false,
        error: "El ID del repartidor es requerido",
      });
      return;
    }

    const delivery = await deliveryService.assignDriver(
      id,
      driver_id,
      req.user.appUserId,
      req.user.profile_code,
    );

    // 🔔 Emitir evento Socket.IO al usuario del delivery
    const io = getIOInstance();
    if (io && delivery.user_id) {
      const userRoom = `user_${delivery.user_id}`;
      io.to(userRoom).emit("delivery_updated", delivery);
      console.log(
        `🔔 Socket.IO: Emitido delivery_updated (driver assigned) a ${userRoom}`,
      );
    }

    res.json({
      success: true,
      delivery,
      message: "Repartidor asignado exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en assignDriver:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al asignar repartidor",
    });
  }
}

/**
 * PUT /api/deliveries/:id/cancel
 * Cancelar un delivery
 */
export async function cancelDelivery(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "ID del delivery es requerido",
      });
      return;
    }

    const delivery = await deliveryService.cancelDelivery(
      id,
      req.user.appUserId,
    );

    // 🔔 Emitir evento Socket.IO al usuario del delivery
    const io = getIOInstance();
    if (io && delivery.user_id) {
      const userRoom = `user_${delivery.user_id}`;
      io.to(userRoom).emit("delivery_updated", delivery);
      io.to(userRoom).emit("delivery_status_changed", {
        deliveryId: delivery.id,
        newStatus: "cancelled",
      });
      console.log(
        `🔔 Socket.IO: Emitido delivery_updated (cancelled) a ${userRoom}`,
      );
    }

    res.json({
      success: true,
      delivery,
      message: "Delivery cancelado exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en cancelDelivery:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al cancelar delivery",
    });
  }
}

/**
 * GET /api/deliveries/history
 * Obtener historial de deliveries del usuario
 */
export async function getDeliveryHistory(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const deliveries = await deliveryService.getDeliveryHistory(
      req.user.appUserId,
    );

    res.json({
      success: true,
      deliveries,
      count: deliveries.length,
    });
  } catch (error: any) {
    console.error("❌ Error en getDeliveryHistory:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener historial de deliveries",
    });
  }
}

/**
 * GET /api/deliveries/route
 * Obtener ruta entre dos puntos usando Google Directions API
 */
export async function getRoute(req: Request, res: Response): Promise<void> {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    // Validar parámetros
    if (!originLat || !originLng || !destLat || !destLng) {
      res.status(400).json({
        success: false,
        error: "Faltan coordenadas (originLat, originLng, destLat, destLng)",
      });
      return;
    }

    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;

    // API Key de Google Maps - debe estar en variables de entorno
    const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"];

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("⚠️ GOOGLE_MAPS_API_KEY no configurada");
      res.status(503).json({
        success: false,
        error: "Servicio de rutas no disponible",
      });
      return;
    }

    // Llamar a Google Directions API
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.status === "OK" && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      res.json({
        success: true,
        polyline: route.overview_polyline.points,
        distance: route.legs[0].distance.text,
        duration: route.legs[0].duration.text,
        steps: route.legs[0].steps.length,
      });
    } else {
      console.error("❌ Error de Google Directions:", data.status);
      res.status(400).json({
        success: false,
        error: data.error_message || data.status,
      });
    }
  } catch (error: any) {
    console.error("❌ Error en getRoute:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener ruta",
    });
  }
}

/**
 * PUT /api/deliveries/:id/payment-method
 * Establecer método de pago (QR o efectivo)
 */
export async function setPaymentMethod(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { id } = req.params;
    const { payment_method, tip_percentage, satisfaction_level } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "ID del delivery es requerido",
      });
      return;
    }

    if (!payment_method || !["qr", "cash"].includes(payment_method)) {
      res.status(400).json({
        success: false,
        error: "Método de pago inválido",
      });
      return;
    }

    // Verificar que sea el repartidor asignado
    if (req.user.profile_code !== "empleado") {
      res.status(403).json({
        success: false,
        error: "Solo los repartidores pueden establecer el método de pago",
      });
      return;
    }

    const delivery = await deliveryService.setPaymentMethod(
      id,
      req.user.appUserId,
      payment_method,
      tip_percentage,
      satisfaction_level,
    );

    res.json({
      success: true,
      delivery,
      message: "Método de pago establecido",
    });
  } catch (error: any) {
    console.error("❌ Error en setPaymentMethod:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al establecer método de pago",
    });
  }
}

/**
 * PUT /api/deliveries/:id/confirm-payment
 * Confirmar pago recibido (efectivo o QR escaneado)
 */
export async function confirmPayment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { id } = req.params;
    const { payment_method, tip_amount, tip_percentage, satisfaction_level } =
      req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "ID del delivery es requerido",
      });
      return;
    }

    if (!payment_method || !["qr", "cash"].includes(payment_method)) {
      res.status(400).json({
        success: false,
        error: "Método de pago inválido",
      });
      return;
    }

    // PASO 1: Validar que el delivery existe y pertenece al cliente
    const { data: deliveryData, error: deliveryFetchError } =
      await supabaseAdmin
        .from("deliveries")
        .select("user_id, driver_id, payment_method, payment_status, status")
        .eq("id", id)
        .single();

    if (deliveryFetchError || !deliveryData) {
      res.status(404).json({
        success: false,
        error: "Delivery no encontrado",
      });
      return;
    }

    // Validar que el usuario tiene permiso para confirmar este pago
    const isClient = deliveryData.user_id === req.user.appUserId;
    const isDriver = deliveryData.driver_id === req.user.appUserId;

    if (!isClient && !isDriver) {
      res.status(403).json({
        success: false,
        error: "No tienes permiso para confirmar este pago",
      });
      return;
    }

    // Para pago QR: solo el CLIENTE puede confirmar
    if (payment_method === "qr" && !isClient) {
      res.status(403).json({
        success: false,
        error: "Solo el cliente puede confirmar pago con QR",
      });
      return;
    }

    // Para pago en efectivo: solo el REPARTIDOR puede confirmar
    if (payment_method === "cash" && !isDriver) {
      res.status(403).json({
        success: false,
        error: "Solo el repartidor puede confirmar pago en efectivo",
      });
      return;
    }

    // Validar que el delivery tiene el método de pago correcto configurado
    if (deliveryData.payment_method !== payment_method) {
      res.status(400).json({
        success: false,
        error: `El método de pago no coincide. El delivery tiene configurado: ${deliveryData.payment_method}`,
      });
      return;
    }

    // Validar que el pago está pendiente
    if (deliveryData.payment_status !== "pending") {
      res.status(400).json({
        success: false,
        error: `El pago ya fue procesado. Estado actual: ${deliveryData.payment_status}`,
      });
      return;
    }

    // Validar que el delivery está en camino
    if (deliveryData.status !== "on_the_way") {
      res.status(400).json({
        success: false,
        error: `El delivery no está listo para pago. Estado actual: ${deliveryData.status}`,
      });
      return;
    }

    const clientId = deliveryData.user_id;

    // PASO 2: Generar factura ANTES de confirmar el pago
    const { InvoiceService } = await import("../invoices/invoiceService");
    let invoiceInfo: {
      generated: boolean;
      filePath?: string;
      fileName?: string;
      htmlContent?: string;
      isRegistered?: boolean;
      message?: string;
      error?: string;
    } = {
      generated: false,
      error: "No se generó factura",
    };

    try {
      // Determinar si el cliente es registrado o anónimo
      const { getAuthEmailById } = await import("../admin/adminServices");
      const clientEmail = await getAuthEmailById(clientId);
      const isRegisteredUser = !!clientEmail;
      let invoiceResult;

      if (isRegisteredUser) {
        // CLIENTE REGISTRADO: Solo generar HTML (no guardar archivo)
        invoiceResult = await InvoiceService.generateDeliveryInvoiceHTMLOnly(
          id,
          clientId,
        );

        if (invoiceResult.success && invoiceResult.htmlContent) {
          invoiceInfo = {
            generated: true,
            htmlContent: invoiceResult.htmlContent,
            isRegistered: true,
            message: "Factura generada exitosamente para envío por email",
          };
        } else {
          console.error(
            `❌ Error generando factura HTML delivery: ${invoiceResult.error}`,
          );
          invoiceInfo = {
            generated: false,
            error: invoiceResult.error || "Error generando factura HTML",
          };
        }
      } else {
        // CLIENTE ANÓNIMO: Generar HTML y guardar archivo
        invoiceResult = await InvoiceService.generateDeliveryInvoiceWithFile(
          id,
          clientId,
        );

        if (invoiceResult.success && invoiceResult.filePath) {
          const fileName = require("path").basename(invoiceResult.filePath);
          invoiceInfo = {
            generated: true,
            filePath: invoiceResult.filePath,
            fileName: fileName,
            isRegistered: false,
            message: "Factura generada exitosamente para descarga",
          };
        } else {
          console.error(
            `❌ Error generando factura con archivo delivery: ${invoiceResult.error}`,
          );
          invoiceInfo = {
            generated: false,
            error:
              invoiceResult.error || "Error generando factura con archivo",
          };
        }
      }
    } catch (invoiceError) {
      console.error("❌ Error en generación de factura delivery:", invoiceError);
      invoiceInfo = {
        generated: false,
        error: "Error interno generando factura",
      };
    }

    // PASO 3: Confirmar el pago
    const delivery = await deliveryService.confirmPayment(
      id,
      req.user.appUserId,
      {
        payment_method,
        tip_amount: tip_amount || 0,
        tip_percentage: tip_percentage || 0,
        satisfaction_level,
      },
      invoiceInfo, // Pasar la info de la factura
    );

    // 🔔 Emitir evento Socket.IO
    const io = getIOInstance();
    if (io && delivery.user_id) {
      const userRoom = `user_${delivery.user_id}`;
      io.to(userRoom).emit("delivery_payment_confirmed", {
        deliveryId: delivery.id,
        paymentMethod: payment_method,
        tipAmount: tip_amount,
      });
    }

    res.json({
      success: true,
      delivery,
      invoice: invoiceInfo,
      message: "Pago confirmado exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en confirmPayment:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al confirmar pago",
    });
  }
}

/**
 * Actualizar ubicación en tiempo real del repartidor
 */
export async function updateDriverLocation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "ID del delivery es requerido",
      });
      return;
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      res.status(400).json({
        success: false,
        error: "Latitud y longitud son requeridas",
      });
      return;
    }

    const delivery = await deliveryService.updateDriverLocation(
      id,
      req.user.appUserId,
      { latitude, longitude },
    );

    // 🔔 Emitir evento Socket.IO a la sala del cliente
    const io = getIOInstance();
    if (io && delivery.user_id) {
      const userRoom = `user_${delivery.user_id}`;
      io.to(userRoom).emit("driver_location_updated", {
        deliveryId: delivery.id,
        latitude: delivery.driver_current_latitude,
        longitude: delivery.driver_current_longitude,
        updatedAt: delivery.driver_location_updated_at,
      });
    }

    res.json({
      success: true,
      delivery,
      message: "Ubicación actualizada",
    });
  } catch (error: any) {
    console.error("❌ Error en updateDriverLocation:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al actualizar ubicación",
    });
  }
}
