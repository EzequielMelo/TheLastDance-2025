import type { Request, Response } from "express";
import { DeliverySurveysService } from "./deliverySurveysService";

export class DeliverySurveysController {
  /**
   * POST /api/surveys/deliveries - Crear nueva encuesta de delivery
   */
  static async createDeliverySurvey(
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

      const result = await DeliverySurveysService.createDeliverySurvey(
        req.user.appUserId,
        req.body,
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error("💥 Error en createDeliverySurvey:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * GET /api/surveys/deliveries/check-status/:deliveryId - Verificar estado de encuesta
   */
  static async checkDeliverySurveyStatus(
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

      const { deliveryId } = req.params;

      if (!deliveryId) {
        res.status(400).json({
          success: false,
          error: "deliveryId es requerido",
        });
        return;
      }

      const result = await DeliverySurveysService.checkDeliverySurveyStatus(
        req.user.appUserId,
        deliveryId,
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("💥 Error en checkDeliverySurveyStatus:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * GET /api/surveys/deliveries/my-surveys - Obtener encuestas de delivery del cliente
   */
  static async getClientDeliverySurveys(
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

      const result = await DeliverySurveysService.getClientDeliverySurveys(
        req.user.appUserId,
      );

      res.json(result);
    } catch (error: any) {
      console.error("💥 Error en getClientDeliverySurveys:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * GET /api/surveys/deliveries/stats - Obtener estadísticas de encuestas de delivery
   */
  static async getDeliverySurveyStats(
    _req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const result = await DeliverySurveysService.getDeliverySurveyStats();
      res.json(result);
    } catch (error: any) {
      console.error("💥 Error en getDeliverySurveyStats:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * GET /api/surveys/deliveries/driver/:driverId - Obtener encuestas de un conductor
   */
  static async getDriverSurveys(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Usuario no autenticado",
        });
        return;
      }

      const { driverId } = req.params;

      if (!driverId) {
        res.status(400).json({
          success: false,
          error: "driverId es requerido",
        });
        return;
      }

      const result = await DeliverySurveysService.getDriverSurveys(driverId);
      res.json(result);
    } catch (error: any) {
      console.error("💥 Error en getDriverSurveys:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  }
}
