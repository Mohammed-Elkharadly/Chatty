import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Contact } from "./users.types";

interface UserState {
  contacts: Contact[];
  selectedContact: Contact | null;
  onlineUsers: string[];
  isMuted: boolean;
  unReadCounts: Record<string, number>;
}

const initialState: UserState = {
  contacts: [],
  selectedContact: null,
  onlineUsers: [],
  isMuted: true,
  unReadCounts: {},
};

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = action.payload;
    },
    setContacts: (state, action: PayloadAction<Contact[]>) => {
      const incomingIds = new Set(action.payload.map((contact) => contact._id));
      const kept = state.contacts.filter(
        (contact) => !incomingIds.has(contact._id),
      );
      state.contacts = [...action.payload, ...kept];
    },
    setSelectedContact: (state, action: PayloadAction<Contact | null>) => {
      state.selectedContact = action.payload;
    },
    setIsMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload;
    },
    unReadMessage: (state, action: PayloadAction<string>) => {
      const contactId = action.payload;
      state.unReadCounts[contactId] = (state.unReadCounts[contactId] ?? 0) + 1;
    },
    clearUnRead: (state, action: PayloadAction<string>) => {
      state.unReadCounts[action.payload] = 0;
    },
    seedUnread: (state, action: PayloadAction<Contact[]>) => {
      const openId = state.selectedContact?._id;
      action.payload.forEach((contact) => {
        if (
          contact._id === openId &&
          state.unReadCounts[contact._id] !== undefined
        )
          return;
        state.unReadCounts[contact._id] = contact.unreadCount ?? 0;
      });
    },
    setLastSeen: (
      state,
      action: PayloadAction<{ userId: string; lastSeen: string }>,
    ) => {
      const { userId, lastSeen } = action.payload;
      const contact = state.contacts.find((contact) => contact._id === userId);
      if (contact) contact.lastSeen = lastSeen;
      if (state.selectedContact?._id === userId) {
        state.selectedContact.lastSeen = lastSeen;
      }
    },
    resetUsers: () => initialState,
  },
});

export const {
  setContacts,
  setSelectedContact,
  setOnlineUsers,
  setIsMuted,
  unReadMessage,
  clearUnRead,
  seedUnread,
  setLastSeen,
  resetUsers,
} = usersSlice.actions;
export default usersSlice.reducer;
