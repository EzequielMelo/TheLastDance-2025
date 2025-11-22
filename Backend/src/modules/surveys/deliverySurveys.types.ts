export interface DeliverySurvey {
  id: string;
  delivery_id: string;
  client_id: string;
  driver_id: string | null;
  food_rating: number;
  service_rating: number;
  restaurant_rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeliverySurveyDTO {
  delivery_id: string;
  food_rating: number;
  service_rating: number;
  restaurant_rating: number;
  comment?: string;
}

export interface DeliverySurveyWithClient extends DeliverySurvey {
  client_name: string;
  client_profile_image: string | null;
}

export interface DeliverySurveyStats {
  total_surveys: number;
  average_food_rating: number;
  average_service_rating: number;
  average_restaurant_rating: number;
  overall_average: number;
  rating_distribution: {
    food: { [key: number]: number };
    service: { [key: number]: number };
    restaurant: { [key: number]: number };
  };
  recent_surveys: DeliverySurveyWithClient[];
}
