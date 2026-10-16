
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { logout } from "../features/auth/authSlice";
const apiUrl = import.meta.env.VITE_API_URL
// Creates the function that sends HTTP requests to the backend.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${apiUrl}/api`,
  credentials: "include", // Send cookies with requests.
});

// Stores an ongoing refresh request so multiple 401 errors share one refresh.
let refreshPromise: Promise<boolean> | null = null;

// Extracts the types of the 2nd and 3rd arguments accepted by rawBaseQuery.
type BaseQueryApi = Parameters<typeof rawBaseQuery>[1];
type BaseQueryExtraOptions = Parameters<typeof rawBaseQuery>[2];

// Refreshes the access token; returns true if successful.
const refreshTokens = (
  api: BaseQueryApi,
  extra: BaseQueryExtraOptions,
): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = Promise.resolve(
      rawBaseQuery(
        { url: "/auth/refresh-token", method: "POST" },
        api,
        extra,
      ),
    )
      .then((result) => !result.error) // No error means refresh succeeded.
      .finally(() => {
        refreshPromise = null; // Allow a future refresh attempt.
      });
  }

  return refreshPromise;
};

// Wraps the normal request with automatic token refresh and retry.
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,       // Request: URL string or request configuration.
  unknown,                  // Response data can have any shape.
  FetchBaseQueryError       // Error type returned by fetchBaseQuery.
> = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra);

  // Extract the URL whether args is a string or an object.
  const url = typeof args === "string" ? args : args.url;

  // Only refresh for 401 errors outside /auth/ (e.g. expired access token).
  if (result.error?.status === 401 && !url.startsWith("/auth/")) {
    if (await refreshTokens(api, extra)) {
      // Retry the original request using the refreshed cookie.
      result = await rawBaseQuery(args, api, extra);
    } else {
      // Refresh failed, so clear the authenticated Redux state.
      api.dispatch(logout());
    }
  }

  return result;
};

// Creates the RTK Query API service used by the Redux store.
export const apiQuery = createApi({
  reducerPath: "api", // Key used for this API's state in the Redux store.
  baseQuery: baseQueryWithReauth, // Default function for all API requests.
  tagTypes: ["User", "Message", "Auth", "Contacts"], // Cache invalidation labels.
  endpoints: () => ({}), // Endpoints are added in other files.
});