import { isRejectedWithValue, type Middleware } from "@reduxjs/toolkit";
import toast from "react-hot-toast";

// Shape of the payload when the server sends back an error message.
export type ApiError = { data?: { message?: string } };

// rtkQueryErrorMiddleware: Watches every action passing through the store.
export const rtkQueryErrorMiddleware: Middleware =
  (_store) => (next) => (action) => {
    // catches all rejected RTK Query requests
    if (isRejectedWithValue(action)) {
      const error = action.payload as {
        status?: string;
        data?: { message?: string };
      };
      // endpoint name of the failed request
      const endpoint = (action.meta?.arg as { endpointName?: string })
        ?.endpointName;

      // checkAuth failing just means "not logged in", so no toast
      if (endpoint !== "checkAuth" && error?.status !== "FETCH_ERROR") {
        // Use the server's message if there is one, otherwise a fallback.
        const message =
          (action.payload as ApiError)?.data?.message ||
          action.error?.message ||
          action.error?.message ||
          "Something went wrong.";
        // Show it to the user as a popup.
        toast.error(message);
      }
    }
    // Let the action continue to the reducers.
    return next(action);
  };
