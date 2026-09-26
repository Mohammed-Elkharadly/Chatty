import { apiSlice } from "../../lib/mainApiSlice";
import { login } from "./authSlice";
import type {
  SignupData,
  LoginCredentials,
  ForgotPasswordData,
  ResetPasswordData,
  ResendVerificationData,
  VerifyEmailData,
  SendOtpData,
  VerifyOtpData,
  OAuthLoginData,
  AuthResponse,
} from "./auth.types";

// injectEndpoints: Adds auth endpoints onto the base apiSlice created earlier.
export const authApi = apiSlice.injectEndpoints({
  // builder: The helper RTK Query gives us to describe each request.
  endpoints: (builder) => ({
    // signupUser: Registers a new account. No side effects needed here.
    signupUser: builder.mutation<AuthResponse, SignupData>({
      query: (userData) => ({
        url: "/auth/signup",
        method: "POST",
        body: userData,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          // queryFulfilled: A promise that resolves once the server replies.
          const { data } = await queryFulfilled;
          // Save the user into our auth slice so the app knows who is logged in.
          dispatch(login({ user: data.data.user }));
        } catch (error) {
          console.error(error);
        }
      },
    }),

    // loginUser: Sends credentials and returns the logged-in user.
    // <response type, request body type>
    loginUser: builder.mutation<AuthResponse, LoginCredentials>({
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
          dispatch(login({ user: data.data.user }));
        } catch (error) {
          console.error(error);
        }
      },
    }),

    oAuthLogin: builder.mutation<AuthResponse, OAuthLoginData>({
      query: (body) => ({
        url: "/auth/oauth/login",
        method: "POST",
        body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(login({ user: data.data.user }));
        } catch (error) {
          console.error("oAuth login failed", error);
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

    
  }),
});

// RTK Query generates these hooks automatically based on the endpoint names.
// These hooks let components fire each request with one line and give you
// loading, error and result data for free — no manual fetch or state needed.
export const {
  useLoginUserMutation,
  useSignupUserMutation,
  useOAuthLoginMutation,
  
  
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResendVerificationMutation,
  useVerifyEmailMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  
} = authApi;
