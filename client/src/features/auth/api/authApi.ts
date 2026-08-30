import { apiSlice } from '../../../shared/api/apiSlice';
import { login, logout } from '../slices/authSlice';
import type { User, LoginCredentials, SignupData } from '../types/auth.types';

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    loginUser: builder.mutation<
      { user: User; message: string },
      LoginCredentials
    >({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(login({ user: data.user }));
        } catch (error) {
          console.error(error);
        }
      },
    }),
    signupUser: builder.mutation<{ user: User; message: string }, SignupData>({
      query: (userData) => ({
        url: '/auth/signup',
        method: 'POST',
        body: userData,
      }),
    }),
    logoutUser: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      // on QueryStarted: runs immediately when logout triggered
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled; // wait to the server to confirm logout
          dispatch(logout()); // wipe local auth state
          dispatch(apiSlice.util.resetApiState()); // clear all cashed messages/data
        } catch (error) {
          console.error('logout failed', error);
        }
      },
    }),
    updateProfile: builder.mutation<
      { success: boolean; user: User },
      { avatar?: string, name?: string }
    >({
      query: (data) => ({
        url: '/auth/update-profile',
        method: 'PATCH',
        body: data,
      }),
      // When the profile is updated, we update the local auth state with the new avatar URL.
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(login({ user: data.user }));
        } catch (error) {
          console.error('Profile update failed:', error);
        }
      },
    }),
    checkAuth: builder.query<{ user: User }, void>({
      query: () => '/auth/check-auth',
      providesTags: ['Auth'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(login({ user: data.user }));
        } catch (error) {
          const err = error as { error?: { status?: number } };
          if (err.error?.status === 401 || err.error?.status === 403) {
            dispatch(logout());
          }
        }
      },
    }),
  }),
});

// RTK Query generates these hooks automatically based on the endpoint names.
export const {
  useLoginUserMutation,
  useSignupUserMutation,
  useLogoutUserMutation,
  useUpdateProfileMutation,
  useCheckAuthQuery,
} = authApi;
