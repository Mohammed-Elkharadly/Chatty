import { io } from "socket.io-client";
const apiUrl = import.meta.env.VITE_API_URL;
// Creates a Socket.IO client without connecting immediately.
const socket = io(apiUrl, {
  autoConnect: false, // Connect manually after login.
  withCredentials: true, // Allow cookies to be sent.
});

// Prevents repeated refresh attempts during connection errors.
let retried = false;

let fcmToken: string | null = null;

export const setSocketFcmToken = (token: string | null) => {
  fcmToken = token;
  socket.auth = { fcmToken };
  
};

// A successful connection allows future refresh attempts.
socket.on("connect", () => {
  retried = false;
});

// Runs when Socket.IO cannot establish a connection.
socket.on("connect_error", async (err) => {
  // Refresh only for unauthorized errors, and only once per attempt.
  if (err.message !== "Unauthorized" || retried) return;

  retried = true;

  try {
    // Ask the backend to refresh the access-token cookie.
    const response = await fetch(`${apiUrl}/api/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
    });

    // If refresh succeeded, reconnect using the new cookie.
    if (response.ok) socket.connect();
  } catch (error) {
    console.error("Socket token refresh failed", error);
  }
});

export default socket;
