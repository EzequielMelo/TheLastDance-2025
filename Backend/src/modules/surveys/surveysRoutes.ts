import { Router } from "express";
import { SurveysController } from "./surveysController";
import { DeliverySurveysController } from "./deliverySurveysController";
import { authenticateUser } from "../../middlewares/authMiddleware";

const router = Router();

/**
 * POST /api/surveys - Crear nueva encuesta (clientes)
 */
router.post("/", authenticateUser, SurveysController.createSurvey);

/**
 * GET /api/surveys/check-status/:tableId - Verificar si puede responder encuesta (clientes)
 */
router.get(
  "/check-status/:tableId",
  authenticateUser,
  SurveysController.checkSurveyStatus,
);

/**
 * GET /api/surveys/my-surveys - Obtener encuestas del cliente (clientes)
 */
router.get("/my-surveys", authenticateUser, SurveysController.getClientSurveys);

/**
 * GET /api/surveys/stats - Obtener estadísticas generales (público)
 */
router.get("/stats", SurveysController.getSurveyStats);

/**
 * GET /api/surveys/waiter/:waiterId - Obtener encuestas de un mozo (staff)
 */
router.get(
  "/waiter/:waiterId",
  authenticateUser,
  SurveysController.getWaiterSurveys,
);

// ==================== DELIVERY SURVEYS ====================

/**
 * POST /api/surveys/deliveries - Crear nueva encuesta de delivery
 */
router.post(
  "/deliveries",
  authenticateUser,
  DeliverySurveysController.createDeliverySurvey,
);

/**
 * GET /api/surveys/deliveries/check-status/:deliveryId - Verificar estado de encuesta de delivery
 */
router.get(
  "/deliveries/check-status/:deliveryId",
  authenticateUser,
  DeliverySurveysController.checkDeliverySurveyStatus,
);

/**
 * GET /api/surveys/deliveries/my-surveys - Obtener encuestas de delivery del cliente
 */
router.get(
  "/deliveries/my-surveys",
  authenticateUser,
  DeliverySurveysController.getClientDeliverySurveys,
);

/**
 * GET /api/surveys/deliveries/stats - Obtener estadísticas de encuestas de delivery
 */
router.get(
  "/deliveries/stats",
  DeliverySurveysController.getDeliverySurveyStats,
);

/**
 * GET /api/surveys/deliveries/driver/:driverId - Obtener encuestas de un conductor
 */
router.get(
  "/deliveries/driver/:driverId",
  authenticateUser,
  DeliverySurveysController.getDriverSurveys,
);

export default router;
