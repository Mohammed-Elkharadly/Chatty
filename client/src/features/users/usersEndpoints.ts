import { apiSlice } from "../../lib/mainApiSlice";
import { login, logout } from "../auth/authSlice";
import type { Contact } from "./users.types";
import type {
  ChangePasswordData,
  CheckAuthResponse,
  UpdateProfileResponse,
} from "./users.types";

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getChatHistory: builder.query<Contact[], void>({
      query: () => "/messages/chats",
      transformResponse: (Response: {chats: Contact[] }) => Response.chats,
      providesTags: ["Contacts"],
    }),
    searchUsers: builder.query<{ contacts: Contact[] }, string>({
      query: (searchTerm) => `/messages/search?query=${searchTerm}`,
    }),
    // logoutUser: Ends the session on the server and clears everything locally.
    logoutUser: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "/users/logout",
        method: "POST",
      }),
      // onQueryStarted: runs immediately when logout triggered
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled; // wait for the server to confirm logout
          dispatch(logout()); // wipe local auth state
          dispatch(apiSlice.util.resetApiState()); // clear all cached messages/data
        } catch (error) {
          console.error("logout failed", error);
        }
      },
    }),
    // updateProfile: Sends only the fields that changed (name or avatar).
    updateProfile: builder.mutation<UpdateProfileResponse, FormData>({
      query: (data) => ({
        url: "/users/update-profile",
        method: "PATCH",
        body: data,
      }),
      // When the profile is updated, we update the local auth state with the new data.
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Reuse login() because it already knows how to store a user object.
          dispatch(login({ user: data.data.user }));
        } catch (error) {
          console.error("Profile update failed:", error);
        }
      },
    }),
    changePassword: builder.mutation<{ message: string }, ChangePasswordData>({
      query: (body) => ({
        url: "/users/change-password",
        method: "POST",
        body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(logout()); // force re-login client-side too
        } catch (error) {
          console.error("Failed to change the password", error);
        }
      },
    }),
    deleteAccount: builder.mutation<{ message: string }, { password?: string }>(
      {
        query: (body) => ({
          url: "/users/delete-account",
          method: "DELETE",
          body,
        }),
        async onQueryStarted(_args, { dispatch, queryFulfilled }) {
          try {
            await queryFulfilled;
            dispatch(logout());
            dispatch(apiSlice.util.resetApiState());
          } catch (error) {
            console.error("delete account failed", error);
          }
        },
      },
    ),
    // checkAuth: Asks the server "am I still logged in?" on app start / refresh.
    checkAuth: builder.query<CheckAuthResponse, void>({
      // A query with just a string URL uses GET automatically.
      query: () => "/users/check-auth",
      // providesTags: Marks this result as 'Auth' so invalidating 'Auth' refetches it.
      providesTags: ["Auth"],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Session still valid → restore the user into state.
          dispatch(login({ user: data.data.user }));
        } catch (error) {
          // Not authenticated anymore → make sure local state matches reality.
          const err = error as { error?: { status?: number } };
          if (err.error?.status === 401 || err.error?.status === 403) {
            dispatch(logout());
          }
        }
      },
    }),
  }),
});

export const {
  useGetChatHistoryQuery,
  useLazySearchUsersQuery,
  useLogoutUserMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useDeleteAccountMutation,
  useCheckAuthQuery,
} = usersApi;
