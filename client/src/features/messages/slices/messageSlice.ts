import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Message } from '../types/message.types';

interface MessageState {
  messages: Message[];
}

const initialState: MessageState = {
  messages: [],
};

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<Message[]>) => {
      
      state.messages = action.payload;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    markMessagesAsRead: (state) => {
      state.messages = state.messages.map((msg) => ({
        ...msg,
        status: 'seen' as const,
      }));
    },
    removeMessage: (state, action: PayloadAction<string>) => {
      const messageId = action.payload;
      state.messages = state.messages.filter((msg) => msg._id !== messageId);
    },
    editMessage: (state, action: PayloadAction<Message>) => {
      const { _id, content, image } = action.payload;
      const index = state.messages.findIndex((msg) => msg._id === _id);
      if (index !== -1) {
        if (content !== undefined) state.messages[index].content = content;
        if (image !== undefined) state.messages[index].image = image;
        state.messages[index].updatedAt = new Date().toISOString();
      }
    },
  },
});

export const {
  setMessages,
  addMessage,
  markMessagesAsRead,
  removeMessage,
  editMessage,
} = messageSlice.actions;
export default messageSlice.reducer;
