import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Contact } from '../types/users.types';

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
  name: 'users',
  initialState,
  reducers: {
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      // only update if different
      if (
        JSON.stringify(state.onlineUsers) !== JSON.stringify(action.payload)
      ) {
        state.onlineUsers = action.payload;
      }
    },
    setContacts: (state, action: PayloadAction<Contact[]>) => {
      const existingIds = new Set(state.contacts.map((c) => c._id));
      const newContacts = state.contacts.filter((c) => !existingIds.has(c._id));
      state.contacts = [...action.payload, ...newContacts];
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
  },
});

export const {
  setContacts,
  setSelectedContact,
  setOnlineUsers,
  setIsMuted,
  unReadMessage,
  clearUnRead,
} = usersSlice.actions;
export default usersSlice.reducer;
