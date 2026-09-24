import { apiSlice } from "../../shared/mainApiSlice";
import { login, logout } from "./authSlice";
import type {
  User,
  LoginCredentials,
  SignupData,
  ChangePasswordData,
  ForgotPasswordData,
  ResetPasswordData,
  ResendVerificationData,
  VerifyEmailData,
  SendOtpData,
  VerifyOtpData,
  OAuthLoginData,
} from "./auth.types";

// injectEndpoints: Adds auth endpoints onto the base apiSlice created earlier.
export const authApi = apiSlice.injectEndpoints({
  // builder: The helper RTK Query gives us to describe each request.
  endpoints: (builder) => ({
    // loginUser: Sends credentials and returns the logged-in user.
    // <response type, request body type>
    loginUser: builder.mutation<
      { user: User; message: string },
      LoginCredentials
    >({
      // query: Describes the HTTP call — where, how, and what we send.
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      // onQueryStarted: Extra logic around the request (runs before/after it).
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          // queryFulfilled: A promise that resolves once the server replies.
          const { data } = await queryFulfilled;
          // Save the user into our auth slice so the app knows who is logged in.
          dispatch(login({ user: data.user }));
        } catch (error) {
          console.error(error);
        }
      },
    }),

    // signupUser: Registers a new account. No side effects needed here.
    signupUser: builder.mutation<{ user: User; message: string }, SignupData>({
      query: (userData) => ({
        url: "/auth/signup",
        method: "POST",
        body: userData,
      }),
    }),

    oAuthLogin: builder.mutation<
      { user: User; message: string },
      OAuthLoginData
    >({
      query: (body) => ({
        url: "/auth/oauth/login",
        method: "POST",
        body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(login({ user: data.user }));
        } catch (error) {
          console.error("oAuth login failed", error);
        }
      },
    }),

    // logoutUser: Ends the session on the server and clears everything locally.
    logoutUser: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "/auth/logout",
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
    updateProfile: builder.mutation<
      { success: boolean; user: User },
      { avatar?: string; name?: string }
    >({
      query: (data) => ({
        url: "/auth/update-profile",
        method: "PATCH",
        body: data,
      }),
      // When the profile is updated, we update the local auth state with the new data.
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Reuse login() because it already knows how to store a user object.
          dispatch(login({ user: data.user }));
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

    deleteAccount: builder.mutation<{ message: string }, { password: string }>({
      query: (body) => ({
        url: "users/delete-account",
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
    }),

    forgotPassword: builder.mutation<{ message: string }, ForgotPasswordData>({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body,
      }),
    }),

    resetPassword: builder.mutation<{ message: string }, ResetPasswordData>({
      query: ({ token, password }) => ({
        url: "/auth/reset-password",
        method: "POST",
        body: { token, password },
      }),
      invalidatesTags: ["User"],
    }),

    resendVerification: builder.mutation<
      { message: string },
      ResendVerificationData
    >({
      query: (body) => ({
        url: "/auth/resend-verification",
        method: "POST",
        body,
      }),
    }),

    verifyEmail: builder.mutation<{ message: string }, VerifyEmailData>({
      query: ({ token }) => ({
        url: "/auth/verify-email",
        method: "POST",
        body: { token },
      }),
    }),

    sendOtp: builder.mutation<{ message: string }, SendOtpData>({
      query: (body) => ({
        url: "/auth/otp/send",
        method: "POST",
        body,
      }),
    }),

    verifyOtp: builder.mutation<{ message: string }, VerifyOtpData>({
      query: (body) => ({
        url: "/auth/otp/verify",
        method: "POST",
        body,
      }),
    }),

    // checkAuth: Asks the server "am I still logged in?" on app start / refresh.
    checkAuth: builder.query<{ user: User }, void>({
      // A query with just a string URL uses GET automatically.
      query: () => "/users/check-auth",
      // providesTags: Marks this result as 'Auth' so invalidating 'Auth' refetches it.
      providesTags: ["Auth"],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Session still valid → restore the user into state.
          dispatch(login({ user: data.user }));
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

// RTK Query generates these hooks automatically based on the endpoint names.
// These hooks let components fire each request with one line and give you
// loading, error and result data for free — no manual fetch or state needed.
export const {
  useLoginUserMutation,
  useSignupUserMutation,
  useOAuthLoginMutation,
  useLogoutUserMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useDeleteAccountMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResendVerificationMutation,
  useVerifyEmailMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useCheckAuthQuery,
} = authApi;
