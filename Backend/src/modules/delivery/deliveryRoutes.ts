import { Router } from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import * as deliveryController from "./deliveryController";

const router = Router();

/**
 * Todas las rutas requieren autenticación
 */
router.use(authenticateUser);

/**
 * @route   POST /api/deliveries
 * @desc    Crear nuevo delivery (cliente_registrado)
 * @access  Private (cliente_registrado)
 */
router.post("/", deliveryController.createDelivery);

/**
 * @route   GET /api/deliveries/active
 * @desc    Obtener delivery activo del usuario
 * @access  Private (cliente_registrado)
 */
router.get("/active", deliveryController.getActiveDelivery);

/**
 * @route   GET /api/deliveries/pending
 * @desc    Obtener deliveries pendientes de confirmación
 * @access  Private (dueño/supervisor)
 */
router.get("/pending", deliveryController.getPendingDeliveries);

/**
 * @route   GET /api/deliveries/ready
 * @desc    Obtener deliveries listos para ser tomados
 * @access  Private (empleado/repartidor)
 */
router.get("/ready", deliveryController.getReadyDeliveries);

/**
 * @route   GET /api/deliveries/confirmed
 * @desc    Obtener deliveries confirmados sin asignar
 * @access  Private (dueño/supervisor)
 */
router.get("/confirmed", deliveryController.getConfirmedDeliveries);

/**
 * @route   GET /api/deliveries/driver
 * @desc    Obtener deliveries asignados al repartidor
 * @access  Private (empleado/mozo)
 */
router.get("/driver", deliveryController.getDriverDeliveries);

/**
 * @route   GET /api/deliveries/history
 * @desc    Obtener historial de deliveries del usuario
 * @access  Private (cliente_registrado)
 */
router.get("/history", deliveryController.getDeliveryHistory);

/**
 * @route   GET /api/deliveries/route
 * @desc    Obtener ruta optimizada entre dos puntos usando Google Directions
 * @access  Private (empleado/cliente)
 */
router.get("/route", deliveryController.getRoute);

/**
 * @route   GET /api/deliveries/places-autocomplete
 * @desc    Autocompletar direcciones con Google Places API
 * @access  Private (cliente_registrado)
 */
router.get("/places-autocomplete", deliveryController.getPlacesAutocomplete);

/**
 * @route   GET /api/deliveries/place-details
 * @desc    Obtener detalles y coordenadas de un lugar por place_id
 * @access  Private (cliente_registrado)
 */
router.get("/place-details", deliveryController.getPlaceDetails);

/**
 * @route   PUT /api/deliveries/:id/status
 * @desc    Actualizar estado de un delivery
 * @access  Private (dueño/supervisor)
 */
router.put("/:id/status", deliveryController.updateDeliveryStatus);

/**
 * @route   POST /api/deliveries/:id/take
 * @desc    Repartidor toma un pedido (estado ready → on_the_way)
 * @access  Private (empleado/repartidor)
 */
router.post("/:id/take", deliveryController.takeDelivery);

/**
 * @route   PUT /api/deliveries/:id/assign
 * @desc    Asignar repartidor a un delivery
 * @access  Private (dueño/supervisor)
 */
router.put("/:id/assign", deliveryController.assignDriver);

/**
 * @route   PUT /api/deliveries/:id/cancel
 * @desc    Cancelar un delivery
 * @access  Private (usuario propietario)
 */
router.put("/:id/cancel", deliveryController.cancelDelivery);

/**
 * @route   PUT /api/deliveries/:id/payment-method
 * @desc    Establecer método de pago (QR o efectivo)
 * @access  Private (repartidor asignado)
 */
router.put("/:id/payment-method", deliveryController.setPaymentMethod);

/**
 * @route   PUT /api/deliveries/:id/confirm-payment
 * @desc    Confirmar pago recibido y marcar como entregado
 * @access  Private (repartidor o cliente según método)
 */
router.put("/:id/confirm-payment", deliveryController.confirmPayment);

/**
 * @route   PUT /api/deliveries/:id/confirm-payment-received
 * @desc    Repartidor confirma que recibió el pago (actualiza estados)
 * @access  Private (solo repartidor asignado)
 */
router.put(
  "/:id/confirm-payment-received",
  deliveryController.confirmPaymentReceived,
);

/**
 * @route   PUT /api/deliveries/:id/location
 * @desc    Actualizar ubicación en tiempo real del repartidor
 * @access  Private (solo repartidor asignado)
 */
router.put("/:id/location", deliveryController.updateDriverLocation);

export default router;
