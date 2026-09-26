import { Routes, Route } from "react-router-dom";
import { useCheckAuthQuery } from "./features/users/usersEndpoints";
import Layout from "./components/Layout";
import ChatPage from "./pages/ChatPage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import ChatLayout from "./components/ChatLayout";
import SettingsPage from "./pages/SettingsPage";

function App() {
  const { isLoading } = useCheckAuthQuery();

  if (isLoading) {
    return (
      <div className='min-h-full flex flex-col items-center justify-center gap-4'>
        <span className='loading loading-spinner loading-lg'></span>
        <span>Cecking Authentication...</span>
      </div>
    );
  }
  return (
    <Routes>
      <Route path='/' element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          <Route element={<ChatLayout />}>
            <Route index element={<ChatPage />} />
            <Route path='settings' element={<SettingsPage />} />
          </Route>
        </Route>
        <Route element={<GuestRoute />}>
          <Route path='signup' element={<SignupPage />} />
          <Route path='login' element={<LoginPage />} />
        </Route>
        <Route path='forgot-password' element={<ForgotPasswordPage />} />
        <Route path='reset-password' element={<ResetPasswordPage />} />
        <Route path='verify-email/:status' element={<VerifyEmailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
