import { useState, useEffect, type ReactNode } from "react";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  useGetChatHistoryQuery,
  useLogoutUserMutation,
} from "../../features/users/usersEndpoints";
import { setContacts } from "../../features/users/usersSlice";
import type { SidebarContextValue } from "./SidebarContext";
import { SidebarContext } from "./SidebarContext";

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { selectedContact, contacts, onlineUsers } = useAppSelector(
    (state) => state.users,
  );
  const unReadCounts = useAppSelector((state) => state.users.unReadCounts);
  const { data: newContact } = useGetChatHistoryQuery();
  const [logoutUser, { isLoading: isLoggingOut }] = useLogoutUserMutation();

  useEffect(() => {
    if (newContact) {
      dispatch(setContacts(newContact));
    }
  }, [dispatch, newContact]);

  const handleLogout = async () => {
    try {
      const data = await logoutUser().unwrap();
      toast.success(data.message);
    } catch (error) {
      console.error("failed logging out", error);
    }
  };

  const value: SidebarContextValue = {
    isOpen,
    setIsOpen,
    search,
    setSearch,
    user,
    contacts,
    selectedContact,
    onlineUsers,
    unReadCounts,
    isLoggingOut,
    handleLogout,
  };

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};
