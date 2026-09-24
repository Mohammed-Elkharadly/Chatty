import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthState, User } from "./auth.types";

// initialState: What the auth state looks like before anyone logs in.
const initialState: AuthState = {
  user: null, // nobody logged in yet
  isAuthenticated: false, // so protected routes should be blocked
};

// createSlice: Builds our auth slice — its state, its actions, and its reducer.
const authSlice = createSlice({
  // name: The label used in Redux DevTools and for action names (e.g. 'auth/login').
  name: "auth",
  // initialState: Where this slice starts from.
  initialState,
  // reducers: The only places allowed to change this slice's state.
  reducers: {
    // login: Called after a successful login/checkAuth/profile update.
    // PayloadAction: Tells TypeScript exactly what shape the data coming in has.
    login: (state, action: PayloadAction<{ user: User }>) => {
      state.user = action.payload.user; // store who is logged in
      state.isAuthenticated = true; // unlock the app
    },
    // logout: Clears everything back to the starting point.
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
});

// login/logout: The action creators we dispatch from RTK Query's onQueryStarted.
export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
