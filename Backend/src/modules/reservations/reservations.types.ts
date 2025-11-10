export interface Reservation {
  id: string;
  user_id: string;
  table_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  party_size: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  notes?: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

export interface CreateReservationRequest {
  table_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  party_size: number;
  notes?: string;
}

export interface UpdateReservationRequest {
  status: 'approved' | 'rejected' | 'cancelled';
  rejection_reason?: string;
}

export interface ReservationWithDetails extends Reservation {
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  table?: {
    id: string;
    number: number;
    capacity: number;
    type: string;
  };
  approved_by_user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface AvailableSlot {
  time: string; // HH:MM
  available: boolean;
  table_id?: string;
  table_number?: number;
  table_capacity?: number;
}

export interface AvailabilityRequest {
  date: string; // YYYY-MM-DD
  party_size?: number; // Filtrar por capacidad de mesa
}

export interface AvailabilityResponse {
  date: string;
  slots: AvailableSlot[];
}