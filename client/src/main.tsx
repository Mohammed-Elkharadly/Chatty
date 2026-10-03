import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter as Router } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Provider } from "react-redux";
import { store } from "./app/store.ts";
import { Toaster } from "react-hot-toast";
import { ChatProvider } from "./contexts/chat/ChatProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <Router>
          <ChatProvider>
            <>
              <Toaster position='top-center' reverseOrder={false} />
              <App />
            </>
          </ChatProvider>
        </Router>
      </Provider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
