import { apiSlice } from '../../../shared/api/apiSlice';
import type { Contact } from '../types/users.types';

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getChatHistory: builder.query<Contact[], void>({
      query: () => '/messages/chats',
      providesTags: ['Contacts'],
    }),
    searchUsers: builder.query<{ users: Contact[] }, string>({
      query: (searchTerm) => `/messages/search?query=${searchTerm}`,
    }),
  }),
});

export const { useGetChatHistoryQuery, useLazySearchUsersQuery } = usersApi;
