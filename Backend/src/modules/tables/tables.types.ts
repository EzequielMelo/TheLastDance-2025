// Tipos para la lista de espera y manejo de mesas

export interface WaitingListEntry {
  id: string;
  client_id: string;
  party_size: number;
  preferred_table_type?: "vip" | "estandar" | "accesible";
  special_requests?: string;
  status: "waiting" | "seated" | "cancelled" | "no_show" | "displaced";
  priority: number;
  joined_at: string;
  seated_at?: string;
  cancelled_at?: string;
  updated_at: string;
}

export interface WaitingListWithUser extends WaitingListEntry {
  users: {
    first_name: string;
    last_name: string;
    profile_image?: string;
    profile_code: string;
  };
}

export interface CreateWaitingListEntry {
  client_id: string;
  party_size: number;
  preferred_table_type?: "vip" | "estandar" | "accesible";
  special_requests?: string;
  priority?: number;
}

export interface AssignTableRequest {
  waiting_list_id: string;
  table_id: string;
}

export interface TableOccupancy {
  id: string;
  number: number;
  capacity: number;
  type: string;
  is_occupied: boolean;
  id_client?: string;
  photo_url: string;
  qr_url: string;
  created_at: string;
}

export interface TableWithClient extends TableOccupancy {
  client?: {
    first_name: string;
    last_name: string;
    profile_image?: string;
    profile_code: string;
  };
}

// Tipos para respuestas de la API
export interface WaitingListResponse {
  waiting_list: WaitingListWithUser[];
  total_waiting: number;
  average_wait_time?: number;
}

export interface TablesStatusResponse {
  tables: TableWithClient[];
  occupied_count: number;
  assigned_count: number;
  available_count: number;
  total_capacity: number;
  occupied_capacity: number;
  assigned_capacity: number;
}
