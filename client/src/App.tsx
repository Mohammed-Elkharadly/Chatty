import { Routes, Route } from 'react-router-dom';
import { useCheckAuthQuery } from './features/auth/api/authApi';
import Layout from './components/Layout';
import ChatPage from './pages/ChatPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import ChatLayout from './components/ChatLayout';

function App() {
  const { isLoading } = useCheckAuthQuery();

  if (isLoading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4">
        <span className="loading loading-spinner loading-lg"></span>
        <span>Cecking Authentication...</span>
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          <Route element={<ChatLayout />}>
            <Route index element={<ChatPage />} />
          </Route>
        </Route>
        <Route element={<GuestRoute />}>
          <Route path="signup" element={<SignupPage />} />
          <Route path="login" element={<LoginPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
