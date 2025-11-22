import { supabase as supabaseAdmin } from "../../config/supabase";
import type {
  CreateDeliverySurveyDTO,
  DeliverySurvey,
  DeliverySurveyStats,
} from "./deliverySurveys.types";

export class DeliverySurveysService {
  /**
   * Crear una nueva encuesta de delivery
   */
  static async createDeliverySurvey(
    clientId: string,
    data: CreateDeliverySurveyDTO,
  ): Promise<{ success: boolean; survey?: DeliverySurvey; error?: string }> {
    try {
      // 1. Validar calificaciones
      if (
        data.food_rating < 1 ||
        data.food_rating > 5 ||
        data.service_rating < 1 ||
        data.service_rating > 5 ||
        data.restaurant_rating < 1 ||
        data.restaurant_rating > 5
      ) {
        return {
          success: false,
          error: "Las calificaciones deben estar entre 1 y 5",
        };
      }

      // 2. Verificar que el delivery existe
      console.log("🔍 Buscando delivery:", {
        delivery_id: data.delivery_id,
        delivery_id_type: typeof data.delivery_id,
        delivery_id_length: data.delivery_id?.length,
        client_id: clientId,
      });

      // Intentar con query más simple primero
      const { data: allDeliveries, error: allError } = await supabaseAdmin
        .from("deliveries")
        .select("id")
        .limit(5);

      console.log("🔍 Prueba de conexión - deliveries encontrados:", {
        count: allDeliveries?.length || 0,
        error: allError,
      });

      const { data: delivery, error: deliveryError } = await supabaseAdmin
        .from("deliveries")
        .select("id, user_id, driver_id, status, survey_completed")
        .eq("id", data.delivery_id)
        .maybeSingle();

      console.log("📦 Resultado de búsqueda:", {
        found: !!delivery,
        error: deliveryError,
        delivery: delivery,
      });

      if (deliveryError) {
        console.error("❌ Error de base de datos:", deliveryError);
        return {
          success: false,
          error: "Error al buscar el delivery en la base de datos",
        };
      }

      if (!delivery) {
        console.error("❌ Delivery no encontrado:", {
          delivery_id: data.delivery_id,
          delivery_id_raw: JSON.stringify(data.delivery_id),
        });
        return {
          success: false,
          error: "Delivery no encontrado",
        };
      }

      console.log("✅ Delivery encontrado:", {
        id: delivery.id,
        user_id: delivery.user_id,
        client_id_esperado: clientId,
        coincide: delivery.user_id === clientId,
        status: delivery.status,
        survey_completed: delivery.survey_completed,
      });

      // 3. Verificar que el delivery pertenece al cliente
      if (delivery.user_id !== clientId) {
        console.error("❌ El delivery no pertenece al usuario:", {
          delivery_user_id: delivery.user_id,
          client_id: clientId,
        });
        return {
          success: false,
          error:
            "No tienes permisos para responder la encuesta de este delivery",
        };
      }

      // 4. Verificar que el delivery fue entregado
      if (delivery.status !== "delivered") {
        return {
          success: false,
          error:
            "Solo puedes responder la encuesta cuando el delivery fue entregado",
        };
      }

      // 5. Verificar que no haya respondido ya la encuesta
      if (delivery.survey_completed) {
        return {
          success: false,
          error: "Ya has respondido una encuesta para este delivery",
        };
      }

      // 6. Verificar que no exista una encuesta para este delivery (doble verificación)
      const { data: existingSurvey, error: checkError } = await supabaseAdmin
        .from("surveys_deliveries")
        .select("id")
        .eq("delivery_id", data.delivery_id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (checkError) {
        console.error("❌ Error verificando encuesta existente:", checkError);
        return {
          success: false,
          error: "Error verificando encuestas previas",
        };
      }

      if (existingSurvey) {
        return {
          success: false,
          error: "Ya has respondido una encuesta para este delivery",
        };
      }

      // 7. Crear la encuesta
      const { data: survey, error: insertError } = await supabaseAdmin
        .from("surveys_deliveries")
        .insert({
          delivery_id: data.delivery_id,
          client_id: clientId,
          driver_id: delivery.driver_id,
          food_rating: data.food_rating,
          service_rating: data.service_rating,
          restaurant_rating: data.restaurant_rating,
          comment: data.comment || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error insertando encuesta de delivery:", insertError);
        return {
          success: false,
          error: `Error al guardar la encuesta: ${insertError.message}`,
        };
      }

      // 8. Actualizar el campo survey_completed del delivery
      console.log(
        "🔄 Intentando actualizar survey_completed para delivery:",
        data.delivery_id,
      );

      const { data: updateData, error: updateError } = await supabaseAdmin
        .from("deliveries")
        .update({ survey_completed: true })
        .eq("id", data.delivery_id)
        .select();

      console.log("📊 Resultado de actualización:", {
        updated: !!updateData && updateData.length > 0,
        count: updateData?.length || 0,
        error: updateError,
        data: updateData,
      });

      if (updateError) {
        console.error("⚠️ Error actualizando survey_completed:", updateError);
        // No retornamos error porque la encuesta ya fue creada
      } else if (!updateData || updateData.length === 0) {
        console.error(
          "⚠️ No se actualizó ningún registro. Posible problema de RLS.",
        );
      } else {
        console.log("✅ Campo survey_completed actualizado correctamente");
      }

      return {
        success: true,
        survey: survey as DeliverySurvey,
      };
    } catch (error: any) {
      console.error("💥 Error en createDeliverySurvey:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor",
      };
    }
  }

  /**
   * Verificar si el cliente ya respondió la encuesta para el delivery
   */
  static async checkDeliverySurveyStatus(
    clientId: string,
    deliveryId: string,
  ): Promise<{
    canAnswer: boolean;
    hasAnswered: boolean;
    survey?: DeliverySurvey;
  }> {
    try {
      const { data: survey, error } = await supabaseAdmin
        .from("surveys_deliveries")
        .select("*")
        .eq("delivery_id", deliveryId)
        .eq("client_id", clientId)
        .maybeSingle();

      if (error) {
        console.error(
          "❌ Error verificando estado de encuesta de delivery:",
          error,
        );
        return { canAnswer: false, hasAnswered: false };
      }

      if (survey) {
        return {
          canAnswer: false,
          hasAnswered: true,
          survey: survey as DeliverySurvey,
        };
      }

      // Verificar si el delivery está en estado delivered
      const { data: delivery } = await supabaseAdmin
        .from("deliveries")
        .select("status, user_id, survey_completed")
        .eq("id", deliveryId)
        .eq("user_id", clientId)
        .single();

      const canAnswer =
        delivery?.status === "delivered" && !delivery?.survey_completed;

      return {
        canAnswer,
        hasAnswered: false,
      };
    } catch (error) {
      console.error("💥 Error en checkDeliverySurveyStatus:", error);
      return { canAnswer: false, hasAnswered: false };
    }
  }

  /**
   * Obtener encuestas de delivery del cliente
   */
  static async getClientDeliverySurveys(
    clientId: string,
  ): Promise<{ success: boolean; surveys?: DeliverySurvey[]; error?: string }> {
    try {
      const { data: surveys, error } = await supabaseAdmin
        .from("surveys_deliveries")
        .select(
          `
          *,
          delivery:deliveries(delivery_address),
          driver:users!surveys_deliveries_driver_id_fkey(first_name, last_name)
        `,
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "❌ Error obteniendo encuestas de delivery del cliente:",
          error,
        );
        return {
          success: false,
          error: "Error al obtener tus encuestas",
        };
      }

      return {
        success: true,
        surveys: surveys as any[],
      };
    } catch (error: any) {
      console.error("💥 Error en getClientDeliverySurveys:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor",
      };
    }
  }

  /**
   * Obtener estadísticas generales de encuestas de delivery
   */
  static async getDeliverySurveyStats(): Promise<{
    success: boolean;
    stats?: DeliverySurveyStats;
    error?: string;
  }> {
    try {
      const { data: surveys, error } = await supabaseAdmin
        .from("surveys_deliveries")
        .select(
          `
          *,
          client:users!surveys_deliveries_client_id_fkey(
            first_name,
            last_name,
            profile_image
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error obteniendo estadísticas de delivery:", error);
        return {
          success: false,
          error: "Error al obtener estadísticas",
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
              restaurant: {},
            },
            recent_surveys: [],
          },
        };
      }

      // Calcular promedios
      const totalSurveys = surveys.length;
      const avgFood =
        surveys.reduce((sum, s) => sum + s.food_rating, 0) / totalSurveys;
      const avgService =
        surveys.reduce((sum, s) => sum + s.service_rating, 0) / totalSurveys;
      const avgRestaurant =
        surveys.reduce((sum, s) => sum + s.restaurant_rating, 0) / totalSurveys;
      const overallAvg = (avgFood + avgService + avgRestaurant) / 3;

      // Calcular distribución de calificaciones
      const foodDist: { [key: number]: number } = {};
      const serviceDist: { [key: number]: number } = {};
      const restaurantDist: { [key: number]: number } = {};

      for (let i = 1; i <= 5; i++) {
        foodDist[i] = surveys.filter(s => s.food_rating === i).length;
        serviceDist[i] = surveys.filter(s => s.service_rating === i).length;
        restaurantDist[i] = surveys.filter(
          s => s.restaurant_rating === i,
        ).length;
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
            restaurant: restaurantDist,
          },
          recent_surveys: recentSurveys,
        },
      };
    } catch (error: any) {
      console.error("💥 Error en getDeliverySurveyStats:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor",
      };
    }
  }

  /**
   * Obtener encuestas de un conductor específico
   */
  static async getDriverSurveys(driverId: string): Promise<{
    success: boolean;
    surveys?: DeliverySurvey[];
    stats?: any;
    error?: string;
  }> {
    try {
      const { data: surveys, error } = await supabaseAdmin
        .from("surveys_deliveries")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error obteniendo encuestas del conductor:", error);
        return {
          success: false,
          error: "Error al obtener encuestas del conductor",
        };
      }

      if (!surveys || surveys.length === 0) {
        return {
          success: true,
          surveys: [],
          stats: {
            total: 0,
            average_service_rating: 0,
          },
        };
      }

      const avgService =
        surveys.reduce((sum, s) => sum + s.service_rating, 0) / surveys.length;

      return {
        success: true,
        surveys: surveys as DeliverySurvey[],
        stats: {
          total: surveys.length,
          average_service_rating: Math.round(avgService * 10) / 10,
        },
      };
    } catch (error: any) {
      console.error("💥 Error en getDriverSurveys:", error);
      return {
        success: false,
        error: error.message || "Error interno del servidor",
      };
    }
  }
}
