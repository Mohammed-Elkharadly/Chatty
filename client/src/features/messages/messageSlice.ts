import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Message, Reaction, MessageState } from "./message.types";

const initialState: MessageState = {
  messages: [],
  hasMore: true,
};

const messageSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    setMessages: (
      state,
      action: PayloadAction<{ messages: Message[]; hasMore: boolean }>,
    ) => {
      state.messages = action.payload.messages;
      state.hasMore = action.payload.hasMore;
    },
    prePendMessages: (
      state,
      action: PayloadAction<{ messages: Message[]; hasMore: boolean }>,
    ) => {
      const ids = new Set(state.messages.map((message) => message._id));
      state.messages = [
        ...action.payload.messages.filter((message) => !ids.has(message._id)),
        ...state.messages,
      ];
      state.hasMore = action.payload.hasMore;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const exists = state.messages.some(
        (msg) => msg._id === action.payload._id,
      );
      if (!exists) {
        state.messages.push(action.payload);
      }
    },
    readMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.map((msg) =>
        msg.receiverId === action.payload ? { ...msg, status: "seen" } : msg,
      );
    },
    removeMessage: (state, action: PayloadAction<string>) => {
      const messageId = String(action.payload);
      state.messages = state.messages.filter(
        (msg) => String(msg._id) !== messageId,
      );
    },
    editMessage: (state, action: PayloadAction<Message>) => {
      const { _id, content, attachment, updatedAt } = action.payload;
      const index = state.messages.findIndex((msg) => msg._id === _id);
      if (index !== -1) {
        if (content !== undefined) state.messages[index].content = content;
        if (attachment !== undefined)
          state.messages[index].attachment = attachment;
        state.messages[index].updatedAt = updatedAt ?? new Date().toISOString();
      }
    },
    setReactions: (
      state,
      action: PayloadAction<{ messageId: string; reactions: Reaction[] }>,
    ) => {
      const index = state.messages.findIndex(
        (msg) => msg._id === action.payload.messageId,
      );
      if (index !== -1)
        state.messages[index].reactions = action.payload.reactions;
    },
    deliverMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.map((msg) =>
        msg.receiverId === action.payload && msg.status === "sent"
          ? { ...msg, status: "delivered" }
          : msg,
      );
    },
    resetMessages: () => initialState,
  },
});

export const {
  setMessages,
  addMessage,
  readMessage,
  removeMessage,
  editMessage,
  setReactions,
  resetMessages,
  deliverMessage,
  prePendMessages,
} = messageSlice.actions;
export default messageSlice.reducer;
