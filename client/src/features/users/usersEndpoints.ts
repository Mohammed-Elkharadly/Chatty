import { apiQuery } from "../../lib/apiQuery";
import { resetUsers } from "./usersSlice";
import { resetMessages } from "../messages/messageSlice";
import type { AppDispatch } from "../../app/store";
import { login, logout } from "../auth/authSlice";
import type { Contact } from "./users.types";
import type {
  ChangePasswordData,
  CheckAuthResponse,
  UpdateProfileResponse,
} from "./users.types";

const clearSession = (dispatch: AppDispatch) => {
  dispatch(logout());
  dispatch(resetUsers());
  dispatch(resetMessages());
  dispatch(apiQuery.util.resetApiState());
  localStorage.removeItem("selectedContactId");
  localStorage.removeItem("sidebarHidden");
};

export const usersApi = apiQuery.injectEndpoints({
  endpoints: (builder) => ({
    getChatHistory: builder.query<Contact[], void>({
      query: () => "/messages/chats",
      transformResponse: (Response: { chats: Contact[] }) => Response.chats,
      providesTags: ["Contacts"],
    }),
    searchUsers: builder.query<{ contacts: Contact[] }, string>({
      query: (searchTerm) => `/messages/search?query=${encodeURIComponent(searchTerm)}`,
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
          clearSession(dispatch);
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
          clearSession(dispatch);
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
            clearSession(dispatch);
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
