export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
export interface SignupData {
  name: string;
  email: string;
  password: string;
}
