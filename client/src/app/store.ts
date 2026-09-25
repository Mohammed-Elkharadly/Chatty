import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "../lib/mainApiSlice";
import authReducer from "../features/auth/authSlice";
import usersReducer from "../features/users/usersSlice";
import { rtkQueryErrorMiddleware } from "../middleware/rtkQueryErrorMiddlewarw";
import messageReducer from "../features/messages/messageSlice";

// configureStore: Creates the one central store where all app data lives.
export const store = configureStore({
  // reducer: Registers every slice so each one gets its own spot in the store.
  reducer: {
    // The place where RTK Query keeps its cached API data.
    [apiSlice.reducerPath]: apiSlice.reducer,
    // Stores login/session info.
    auth: authReducer,
    // Stores user data.
    users: usersReducer,
    // Stores chat messages.
    messages: messageReducer,
  },
  // middleware: Extra logic that runs on every action before the reducers do.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      // Makes RTK Query work (caching, loading states, refetching).
      .concat(apiSlice.middleware)
      // Shows an error toast whenever any API request fails.
      .concat(rtkQueryErrorMiddleware),
});

// RootState: The full shape of our state, so components get correct types.
export type RootState = ReturnType<typeof store.getState>;

// AppDispatch: The type of dispatch, used by useAppDispatch above.
export type AppDispatch = typeof store.dispatch;
