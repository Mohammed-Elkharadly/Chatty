import { apiQuery } from "../../lib/apiQuery";
import {
  setMessages,
  addMessage,
  removeMessage,
  editMessage,
  setReactions,
  prePendMessages,
} from "./messageSlice";
import type { Message, Reaction } from "./message.types";

export interface RawMessage extends Omit<Message, "senderId" | "receiverId"> {
  senderId:
    | string
    | { _id: string; name: string; email: string; avatar?: string };
  receiverId: string | { _id: string };
}

export const normalizeMessage = (msg: RawMessage): Message => ({
  ...msg,
  senderId: typeof msg.senderId === "object" ? msg.senderId._id : msg.senderId,
  receiverId:
    typeof msg.receiverId === "object" ? msg.receiverId._id : msg.receiverId,
});

export const messageApi = apiQuery.injectEndpoints({
  endpoints: (builder) => ({
    // query<returned response from the server, userId from query params">
    getMessages: builder.query<
      { messages: Message[]; hasMore: boolean },
      { userId: string; oldestMessagesId?: string }
    >({
      query: ({ userId, oldestMessagesId }) => ({
        url: `/messages/${userId}`,
        params: oldestMessagesId ? { oldestMessagesId } : undefined,
      }),
      async onQueryStarted({ oldestMessagesId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const payload = {
            messages: data.messages.map(normalizeMessage),
            hasMore: data.hasMore,
          };
          // older page goes on top, first page replaces the chat
          dispatch(
            oldestMessagesId ? prePendMessages(payload) : setMessages(payload),
          );
        } catch (error) {
          console.error("Faild to fetch messages", error);
        }
      },
    }),
    sendMessage: builder.mutation<
      { message: Message }, // shap of the response data
      { receiverId: string; formData: FormData } // shap of the request data
    >({
      query: ({ receiverId, formData }) => ({
        url: `/messages/send/${receiverId}`,
        method: "POST",
        body: formData, // multipart: multer reads the "attachment" field
      }),
      invalidatesTags: ["Contacts"],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(addMessage(normalizeMessage(data.message)));
        } catch (error) {
          console.error("Failed to send message", error);
        }
      },
    }),
    markAsRead: builder.mutation<{ message: string }, string>({
      query: (senderId) => ({
        url: `/messages/read/${senderId}`,
        method: "PATCH",
      }),
    }),
    deleteMessage: builder.mutation<{ message: string }, string>({
      query: (messageId) => ({
        url: `/messages/${messageId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Contacts"],
      async onQueryStarted(messageId, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(removeMessage(messageId));
        } catch (error) {
          console.error("Failed to delete message", error);
        }
      },
    }),
    updateMessage: builder.mutation<Message, { _id: string; body: FormData }>({
      query: ({ _id, body }) => ({
        url: `/messages/${_id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Contacts"],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(editMessage(data));
        } catch (error) {
          console.error("Faild to update message", error);
        }
      },
    }),
    reactToMessage: builder.mutation<
      { reactions: Reaction[] },
      { messageId: string; emoji: string }
    >({
      query: ({ messageId, emoji }) => ({
        url: `/messages/${messageId}/react`,
        method: "PATCH",
        body: { emoji },
      }),
      async onQueryStarted({ messageId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setReactions({ messageId, reactions: data.reactions }));
        } catch (error) {
          console.error(error);
        }
      },
    }),
    searchInMessage: builder.query<
      { messages: Message[] }, // shap of the response data
      { userId: string; queryTerm: string } // shap of the request data
    >({
      query: ({ userId, queryTerm }) => ({
        url: `/messages/search/${userId}?query=${encodeURIComponent(queryTerm)}`,
      }),
    }),
  }),
});

export const {
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useDeleteMessageMutation,
  useUpdateMessageMutation,
  useReactToMessageMutation,
  useLazySearchInMessageQuery,
} = messageApi;
