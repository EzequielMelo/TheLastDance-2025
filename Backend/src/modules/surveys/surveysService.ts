import { supabase as supabaseAdmin } from "../../config/supabase";
import type { CreateSurveyDTO, Survey, SurveyStats } from "./surveys.types";

export class SurveysService {
  /**
   * Crear una nueva encuesta
   */
  static async createSurvey(
    clientId: string,
    data: CreateSurveyDTO
  ): Promise<{ success: boolean; survey?: Survey; error?: string }> {
    try {
      // 1. Validar calificaciones
      if (
        data.food_rating < 1 || data.food_rating > 5 ||
        data.service_rating < 1 || data.service_rating > 5 ||
        data.restaurant_rating < 1 || data.restaurant_rating > 5
      ) {
        return {
          success: false,
          error: "Las calificaciones deben estar entre 1 y 5"
        };
      }

      // 2. Verificar que la mesa existe y pertenece al cliente
      const { data: tables, error: tableError } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_client, id_waiter, table_status, is_occupied")
        .eq("id", data.table_id)
        .eq("id_client", clientId);

      if (tableError || !tables || tables.length === 0) {
        console.error("❌ Mesa no encontrada:", tableError);
        return {
          success: false,
          error: "Mesa no encontrada o no tienes permisos para responder la encuesta"
        };
      }

      if (!tables[0]) {
        console.error("❌ No se encontró la mesa");
        return {
          success: false,
          error: "Mesa no encontrada"
        };
      }

      const table = tables[0];

      // 3. Verificar que el pedido fue confirmado (table_status = 'confirmed' o 'bill_requested')
      if (table.table_status !== "confirmed" && table.table_status !== "bill_requested") {
        return {
          success: false,
          error: "Debes confirmar la recepción del pedido antes de responder la encuesta"
        };
      }

      // 4. Verificar que no haya respondido ya una encuesta para esta estadía
      const { data: existingSurvey, error: checkError } = await supabaseAdmin
        .from("surveys")
        .select("id")
        .eq("table_id", data.table_id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (checkError) {
        console.error("❌ Error verificando encuesta existente:", checkError);
        return {
          success: false,
          error: "Error verificando encuestas previas"
        };
      }

      if (existingSurvey) {
        return {
          success: false,
          error: "Ya has respondido una encuesta para esta estadía"
        };
      }

      // 5. Crear la encuesta - INSERT directo
      const { data: survey, error: insertError } = await supabaseAdmin
        .from("surveys")
        .insert({
          table_id: data.table_id,
          client_id: clientId,
          waiter_id: table.id_waiter,
          food_rating: data.food_rating,
          service_rating: data.service_rating,
          restaurant_rating: data.restaurant_rating,
          comment: data.comment || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error insertando encuesta:", insertError);
        console.error("❌ Detalles completos:", JSON.stringify(insertError, null, 2));
        return {
          success: false,
          error: `Error al guardar la encuesta: ${insertError.message}`
        };
      }

      return {
        success: true,
        survey: survey as Survey
      };
    } catch (error: any) {
      console.error("💥 Error en createSurvey:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor"
      };
    }
  }

  /**
   * Verificar si el cliente ya respondió la encuesta para la mesa actual
   */
  static async checkSurveyStatus(
    clientId: string,
    tableId: string
  ): Promise<{ canAnswer: boolean; hasAnswered: boolean; survey?: Survey }> {
    try {
      const { data: survey, error } = await supabaseAdmin
        .from("surveys")
        .select("*")
        .eq("table_id", tableId)
        .eq("client_id", clientId)
        .maybeSingle();

      if (error) {
        console.error("❌ Error verificando estado de encuesta:", error);
        return { canAnswer: false, hasAnswered: false };
      }

      if (survey) {
        return {
          canAnswer: false,
          hasAnswered: true,
          survey: survey as Survey
        };
      }

      // Verificar si la mesa está en estado confirmed o bill_requested
      const { data: table } = await supabaseAdmin
        .from("tables")
        .select("table_status, id_client")
        .eq("id", tableId)
        .eq("id_client", clientId)
        .single();

      const canAnswer = table?.table_status === "confirmed" || table?.table_status === "bill_requested";

      return {
        canAnswer,
        hasAnswered: false
      };
    } catch (error) {
      console.error("💥 Error en checkSurveyStatus:", error);
      return { canAnswer: false, hasAnswered: false };
    }
  }

  /**
   * Obtener encuestas del cliente
   */
  static async getClientSurveys(
    clientId: string
  ): Promise<{ success: boolean; surveys?: Survey[]; error?: string }> {
    try {
      const { data: surveys, error } = await supabaseAdmin
        .from("surveys")
        .select(`
          *,
          table:tables(number),
          waiter:app_users!surveys_waiter_id_fkey(first_name, last_name)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error obteniendo encuestas del cliente:", error);
        return {
          success: false,
          error: "Error al obtener tus encuestas"
        };
      }

      return {
        success: true,
        surveys: surveys as any[]
      };
    } catch (error: any) {
      console.error("💥 Error en getClientSurveys:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor"
      };
    }
  }

  /**
   * Obtener estadísticas generales de todas las encuestas (históricas)
   */
  static async getSurveyStats(): Promise<{ success: boolean; stats?: SurveyStats; error?: string }> {
    try {
      const { data: surveys, error } = await supabaseAdmin
        .from("surveys")
        .select(`
          *,
          client:users!client_id(
            first_name,
            last_name,
            profile_image
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error obteniendo estadísticas:", error);
        return {
          success: false,
          error: "Error al obtener estadísticas"
        };
      }

      if (!surveys || surveys.length === 0) {
        return {
          success: true,
          stats: {
            total_surveys: 0,
            average_food_rating: 0,
            average_service_rating: 0,
            average_restaurant_rating: 0,
            overall_average: 0,
            rating_distribution: {
              food: {},
              service: {},
              restaurant: {}
            },
            recent_surveys: []
          }
        };
      }

      // Calcular promedios
      const totalSurveys = surveys.length;
      const avgFood = surveys.reduce((sum, s) => sum + s.food_rating, 0) / totalSurveys;
      const avgService = surveys.reduce((sum, s) => sum + s.service_rating, 0) / totalSurveys;
      const avgRestaurant = surveys.reduce((sum, s) => sum + s.restaurant_rating, 0) / totalSurveys;
      const overallAvg = (avgFood + avgService + avgRestaurant) / 3;

      // Calcular distribución de calificaciones
      const foodDist: { [key: number]: number } = {};
      const serviceDist: { [key: number]: number } = {};
      const restaurantDist: { [key: number]: number } = {};

      for (let i = 1; i <= 5; i++) {
        foodDist[i] = surveys.filter(s => s.food_rating === i).length;
        serviceDist[i] = surveys.filter(s => s.service_rating === i).length;
        restaurantDist[i] = surveys.filter(s => s.restaurant_rating === i).length;
      }

      // Obtener las últimas 10 encuestas con información del cliente
      const recentSurveys = surveys.slice(0, 10).map((survey: any) => ({
        ...survey,
        client_name: survey.client 
          ? `${survey.client.first_name} ${survey.client.last_name}` 
          : "Cliente",
        client_profile_image: survey.client?.profile_image || null,
      }));

      return {
        success: true,
        stats: {
          total_surveys: totalSurveys,
          average_food_rating: Math.round(avgFood * 10) / 10,
          average_service_rating: Math.round(avgService * 10) / 10,
          average_restaurant_rating: Math.round(avgRestaurant * 10) / 10,
          overall_average: Math.round(overallAvg * 10) / 10,
          rating_distribution: {
            food: foodDist,
            service: serviceDist,
            restaurant: restaurantDist
          },
          recent_surveys: recentSurveys
        }
      };
    } catch (error: any) {
      console.error("💥 Error en getSurveyStats:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor"
      };
    }
  }

  /**
   * Obtener encuestas de un mozo específico
   */
  static async getWaiterSurveys(
    waiterId: string
  ): Promise<{ success: boolean; surveys?: Survey[]; stats?: any; error?: string }> {
    try {
      const { data: surveys, error } = await supabaseAdmin
        .from("surveys")
        .select("*")
        .eq("waiter_id", waiterId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error obteniendo encuestas del mozo:", error);
        return {
          success: false,
          error: "Error al obtener encuestas del mozo"
        };
      }

      if (!surveys || surveys.length === 0) {
        return {
          success: true,
          surveys: [],
          stats: {
            total: 0,
            average_service_rating: 0
          }
        };
      }

      const avgService = surveys.reduce((sum, s) => sum + s.service_rating, 0) / surveys.length;

      return {
        success: true,
        surveys: surveys as Survey[],
        stats: {
          total: surveys.length,
          average_service_rating: Math.round(avgService * 10) / 10
        }
      };
    } catch (error: any) {
      console.error("💥 Error en getWaiterSurveys:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor"
      };
    }
  }
}
