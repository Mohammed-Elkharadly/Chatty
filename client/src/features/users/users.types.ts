import type { User } from "../auth/auth.types";
export interface Contact {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
}


export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
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