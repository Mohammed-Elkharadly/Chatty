import { isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';

export const rtkQueryErrorMiddleware: Middleware =
  (_store) => (next) => (action) => {
    // catches all rejected RTK Query requests
    if (isRejectedWithValue(action)) {
      const message =
        (action.payload as any)?.data?.message ||
        action.error?.message ||
        'Something went wrong.';
      toast.error(message);
    }
    return next(action);
  };
