export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  success: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}
