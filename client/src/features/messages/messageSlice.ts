import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Message, Reaction } from "./message.types";

interface MessageState {
  messages: Message[];
}

const initialState: MessageState = {
  messages: [],
};

const messageSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const exists = state.messages.some(
        (msg) => msg._id === action.payload._id,
      );
      if (!exists) {
        state.messages.push(action.payload);
      }
    },
    readMessage: (state) => {
      state.messages = state.messages.map((msg) => ({
        ...msg,
        status: "seen",
      }));
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
  },
});

export const {
  setMessages,
  addMessage,
  readMessage,
  removeMessage,
  editMessage,
  setReactions,
} = messageSlice.actions;
export default messageSlice.reducer;
