import { Router } from "express";
import { SurveysController } from "./surveysController";
import { authenticateUser } from "../../middlewares/authMiddleware";

const router = Router();

/**
 * POST /api/surveys - Crear nueva encuesta (clientes)
 */
router.post("/", authenticateUser, SurveysController.createSurvey);

/**
 * GET /api/surveys/check-status/:tableId - Verificar si puede responder encuesta (clientes)
 */
router.get("/check-status/:tableId", authenticateUser, SurveysController.checkSurveyStatus);

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
router.get("/waiter/:waiterId", authenticateUser, SurveysController.getWaiterSurveys);

export default router;
