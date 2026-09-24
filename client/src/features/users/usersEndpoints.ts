import { apiSlice } from '../../shared/mainApiSlice';
import type { Contact } from './users.types';

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
