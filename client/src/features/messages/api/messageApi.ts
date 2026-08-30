import { apiSlice } from '../../../shared/api/apiSlice';
import {
  setMessages,
  addMessage,
  removeMessage,
  editMessage,
} from '../slices/messageSlice';
import type { Message } from '../types/message.types';

export interface RawMessage extends Omit<Message, 'senderId' | 'receiverId'> {
  senderId:
    | string
    | { _id: string; name: string; email: string; avatar?: string };
  receiverId: string | { _id: string };
}

export const normalizeMessage = (msg: RawMessage): Message => ({
  ...msg,
  senderId: typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId,
  receiverId:
    typeof msg.receiverId === 'object' ? msg.receiverId._id : msg.receiverId,
});

export const messageApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMessages: builder.query<{ messages: Message[] }, string>({
      query: (userId) => `/messages/${userId}`,
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setMessages(data.messages.map(normalizeMessage)));
        } catch (error) {
          console.error('Faild to fetch messages', error);
        }
      },
    }),
    sendMessage: builder.mutation<
      { message: Message },
      {
        receiverId: string;
        content?: string;
        image?: string;
        timestamp?: number;
      }
    >({
      query: ({ receiverId, timestamp, ...body }) => ({
        url: `/messages/send/${receiverId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Contacts'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(addMessage(normalizeMessage(data.message)));
        } catch (error) {
          console.error('Failed to send message', error);
        }
      },
    }),
    markAsRead: builder.mutation<{ message: string }, string>({
      query: (senderId) => ({
        url: `/messages/read/${senderId}`,
        method: 'PATCH',
      }),
    }),
    deleteMessage: builder.mutation<{ message: string }, string>({
      query: (messageId) => ({
        url: `/messages/${messageId}`,
        method: 'DELETE',
      }),
      async onQueryStarted(messageId, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(removeMessage(messageId));
        } catch (error) {
          console.error('Failed to delete message', error);
        }
      },
    }),
    updateMessage: builder.mutation<
      Message,
      { _id: string; content?: string; image?: string }
    >({
      query: ({ _id, ...body }) => ({
        url: `/messages/${_id}`,
        method: 'PATCH',
        body: body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(editMessage(data));
        } catch (error) {
          console.error('Faild to update message', error);
        }
      },
    }),
  }),
});

export const {
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useDeleteMessageMutation,
  useUpdateMessageMutation,
} = messageApi;
