export type AuthProvider = "local" | "google" | "facebook" | "phone";
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  provider: AuthProvider;
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
  phone: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

export interface ResendVerificationData {
  email: string;
}

export interface VerifyEmailData {
  token: string;
}

export interface SendOtpData {
  email: string;
}

export interface VerifyOtpData {
  email: string;
  otp: string;
}

export interface OAuthLoginData {
  provider: "google";
  idToken: string;
}

export interface AuthResponse {
  message: string;
  data: { user: User };
}

// checkAuth has no top-level message on success
export interface CheckAuthResponse {
  data: { user: User };
}

export interface UpdateProfileResponse {
  success: boolean;
  data: { user: User };
  provider: string;
  idToken: string;
}