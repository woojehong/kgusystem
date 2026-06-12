import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { SUPER_ADMIN_PATH } from './lib/constants';
import LoginPage from './pages/LoginPage';
import IndexPage from './pages/IndexPage';
import RaidDetailPage from './pages/RaidDetailPage';
import SuperAdminPage from './pages/SuperAdminPage';
import NoticePopup from './components/NoticePopup';

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-base-400 animate-pulse text-lg font-medium">KGU</div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { authReady, authUser, profile } = useApp();
  if (!authReady) return <Loading />;
  if (!authUser) return <Navigate to="/login" replace />;
  if (!profile) return <Loading />;
  return children;
}

export default function App() {
  const { authReady } = useApp();
  if (!authReady) return <Loading />;

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <IndexPage />
            </RequireAuth>
          }
        />
        <Route
          path="/raid/:raidId"
          element={
            <RequireAuth>
              <RaidDetailPage />
            </RequireAuth>
          }
        />
        <Route path={`/${SUPER_ADMIN_PATH}`} element={<SuperAdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <NoticePopup />
    </>
  );
}
