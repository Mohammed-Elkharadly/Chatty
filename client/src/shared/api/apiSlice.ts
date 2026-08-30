import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const apiSlice = createApi({
  // reducerPath: The unique name for where this API's data lives in the Redux store.
  reducerPath: 'api',
  // baseQuery: The default configuration for every outgoing network request.
  baseQuery: fetchBaseQuery({
    // baseUrl: The "home address" of your server so you don't have to type it every time.
    baseUrl: 'http://localhost:5000/api',
    // This tells the browser to send cookies (JWT) with every request
    credentials: 'include',
  }),
  tagTypes: ['User', 'Message', 'Auth', 'Contacts'],
  endpoints: () => ({}),
});
