import { createContext, type RefObject } from "react";
import type { Message } from "../../features/messages/message.types";
import type { Contact } from "../../features/users/users.types";
import type { User } from "../../features/auth/auth.types";

export interface ChatContextValue {
  // data
  messages: Message[];
  selectedContact: Contact | null;
  user: User | null;
  onlineUsers: string[];
  // input state
  content: string;
  file: File | null;
  isPending: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  // edit state
  editingMessage: Message | null;
  attachmentRemoved: boolean;
  // message menu
  openMenuId: string | null;
  setOpenMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  // actions
  handleSend: () => Promise<void>;
  handleStartEdit: (msg: Message) => void;
  handleCancelEdit: () => void;
  handleUpdate: () => Promise<void>;
  removeEditingAttachment: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);