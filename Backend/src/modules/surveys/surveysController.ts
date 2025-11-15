import { Request, Response } from "express";
import { SurveysService } from "./surveysService";
import type { CreateSurveyDTO } from "./surveys.types";

export class SurveysController {
  /**
   * POST /api/surveys - Crear nueva encuesta
   */
  static async createSurvey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const clientId = req.user.appUserId;
      const surveyData: CreateSurveyDTO = req.body;

      // Validar datos requeridos
      if (!surveyData.table_id || 
          !surveyData.food_rating || 
          !surveyData.service_rating || 
          !surveyData.restaurant_rating) {
        res.status(400).json({ 
          error: "Faltan datos requeridos: table_id, food_rating, service_rating, restaurant_rating" 
        });
        return;
      }

      const result = await SurveysService.createSurvey(clientId, surveyData);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        success: true,
        message: "Encuesta enviada exitosamente. ¡Gracias por tu opinión!",
        survey: result.survey
      });
    } catch (error: any) {
      console.error("Error en createSurvey:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  /**
   * GET /api/surveys/check-status/:tableId - Verificar si puede responder encuesta
   */
  static async checkSurveyStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const clientId = req.user.appUserId;
      const { tableId } = req.params;

      if (!tableId) {
        res.status(400).json({ error: "table_id es requerido" });
        return;
      }

      const result = await SurveysService.checkSurveyStatus(clientId, tableId);

      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error en checkSurveyStatus:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  /**
   * GET /api/surveys/my-surveys - Obtener encuestas del cliente
   */
  static async getClientSurveys(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const clientId = req.user.appUserId;
      const result = await SurveysService.getClientSurveys(clientId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({
        success: true,
        surveys: result.surveys
      });
    } catch (error: any) {
      console.error("Error en getClientSurveys:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  /**
   * GET /api/surveys/stats - Obtener estadísticas generales (históricas)
   */
  static async getSurveyStats(_req: Request, res: Response): Promise<void> {
    try {
      const result = await SurveysService.getSurveyStats();

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({
        success: true,
        stats: result.stats
      });
    } catch (error: any) {
      console.error("Error en getSurveyStats:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  /**
   * GET /api/surveys/waiter/:waiterId - Obtener encuestas de un mozo
   */
  static async getWaiterSurveys(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const { waiterId } = req.params;

      if (!waiterId) {
        res.status(400).json({ error: "waiter_id es requerido" });
        return;
      }

      const result = await SurveysService.getWaiterSurveys(waiterId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({
        success: true,
        surveys: result.surveys,
        stats: result.stats
      });
    } catch (error: any) {
      console.error("Error en getWaiterSurveys:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
}
