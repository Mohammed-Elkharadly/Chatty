import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from '../shared/api/apiSlice';
import authReducer from '../features/auth/slices/authSlice';
import usersReducer from '../features/users/slices/usersSlice';
import { rtkQueryErrorMiddleware } from './middleware/rtkQueryErrorMiddlewarw';
import messageReducer from '../features/messages/slices/messageSlice';
export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    users: usersReducer,
    messages: messageReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(apiSlice.middleware)
      .concat(rtkQueryErrorMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
