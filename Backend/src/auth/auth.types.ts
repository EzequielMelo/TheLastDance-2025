export interface CreateUserBody {
  email: string;
  password: string;
  name: string;
  last_name: string;
  age: number;
  gender_id: number; // o string si usás UUID/slug
  location: string;
  phone_number: string;
}

// Datos de usuario que devolvés en el login
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  last_name: string;
  photo_url: string;
  phone_number: string;
}

// Resultado del login
export interface LoginResult {
  token: string;
  refreshToken: string;
  user: AuthUser;
}
