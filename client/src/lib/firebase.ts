import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

// asks for permission and returns this browser's push token (null if unavailable/denied)
export const getFcmToken = async (): Promise<string | null> => {
  // browser has no push support (e.g. old Safari)
  if (!(await isSupported())) return null;
  // user blocked notifications before
  if (Notification.permission === "denied") return null;
  if ((await Notification.requestPermission()) !== "granted") return null;

  // the service worker shows notifications while the tab is closed
  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
  );
  return getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
};