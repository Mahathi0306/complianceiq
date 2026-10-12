import { Navigate, Route, Routes } from 'react-router-dom';
import { isStaff, useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Alerts from './pages/Alerts.jsx';
import Cases from './pages/Cases.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import Applications from './pages/Applications.jsx';
import Onboarding from './pages/Onboarding.jsx';

function Protected({ staffOnly, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (staffOnly && !isStaff(user)) return <Navigate to="/onboarding" replace />;
  if (!staffOnly && isStaff(user)) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user } = useAuth();
  const home = user ? (isStaff(user) ? '/dashboard' : '/onboarding') : '/login';
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
      <Route path="/dashboard" element={<Protected staffOnly><Dashboard /></Protected>} />
      <Route path="/alerts" element={<Protected staffOnly><Alerts /></Protected>} />
      <Route path="/cases" element={<Protected staffOnly><Cases /></Protected>} />
      <Route path="/cases/:id" element={<Protected staffOnly><CaseDetail /></Protected>} />
      <Route path="/applications" element={<Protected staffOnly><Applications /></Protected>} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
