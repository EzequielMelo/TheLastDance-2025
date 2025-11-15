export interface Survey {
  id: string;
  table_id: string;
  client_id: string;
  waiter_id: string | null;
  food_rating: number;
  service_rating: number;
  restaurant_rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSurveyDTO {
  table_id: string;
  food_rating: number;
  service_rating: number;
  restaurant_rating: number;
  comment?: string;
}

export interface SurveyWithClient extends Survey {
  client_name: string;
  client_profile_image: string | null;
}

export interface SurveyStats {
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
  recent_surveys: SurveyWithClient[];
}
