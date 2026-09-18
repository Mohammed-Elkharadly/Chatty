import { initializeApp, cert } from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { ENV } from "./env.js";

initializeApp({
  credential: cert({
    projectId: ENV.FIREBASE_PROJECT_ID,
    clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
    privateKey: ENV.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

export const messaging = getMessaging();
