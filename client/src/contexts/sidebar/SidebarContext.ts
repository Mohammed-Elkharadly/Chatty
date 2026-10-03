import { createContext } from "react";
import type { Contact } from "../../features/users/users.types";
import type { User } from "../../features/auth/auth.types";

export interface SidebarContextValue {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  user: User | null;
  contacts: Contact[];
  selectedContact: Contact | null;
  onlineUsers: string[];
  unReadCounts: Record<string, number>;
  isLoggingOut: boolean;
  handleLogout: () => Promise<void>;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);
