import type { User } from "../auth/auth.types";
export interface LastMessage {
  content?: string;
  attachmentType?: "image" | "video" | "audio" | "pdf" | "document";
  senderId: string;
}

export interface Contact {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  unreadCount?: number;
  lastSeen?: string;
  lastMessage?: LastMessage;
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
