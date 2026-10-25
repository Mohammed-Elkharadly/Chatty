importScripts(
  "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyC-V7RV9ZSahaRhRelrseIHW8Wk_EUaaUQ",
  authDomain: "chatty-98e24.firebaseapp.com",
  projectId: "chatty-98e24",
  messagingSenderId: "188674669743",
  appId: "1:188674669743:web:3aa587ebf5fc3709ce285a",
});

// background pushes with a `notification` payload are shown automatically
firebase.messaging().onBackgroundMessage((payload) => {
  // Firebase displays notification payloads automatically
  if (payload.notification) return;

  // Custom notification for data-only messages
  self.registration.showNotification(payload.data.title, {
    body: payload.data.body,
    icon: "/icon.png",
  });
});

