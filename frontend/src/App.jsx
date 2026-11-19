import { lazy, Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { loadCurrentUser } from './redux/authSlice.js';

const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const PatientWelcomePage = lazy(() => import('./pages/PatientWelcomePage.jsx'));
const StaffUsersPage = lazy(() => import('./pages/StaffUsersPage.jsx'));
const PatientsPage = lazy(() => import('./pages/PatientsPage.jsx'));
const PatientRecordPage = lazy(() => import('./pages/PatientRecordPage.jsx'));
const WaitingHallDisplayPage = lazy(() => import('./pages/WaitingHallDisplayPage.jsx'));

function AuthBootstrap() {
  const dispatch = useDispatch();
  const location = useLocation();
  const isPatientKiosk = location.pathname === '/patient';
  const isDisplay = location.pathname === '/display';
  const isPublicScreen = isPatientKiosk || isDisplay;
  const status = useSelector((state) => state.auth.status);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => { if (!isPublicScreen) dispatch(loadCurrentUser()); }, [dispatch, isPublicScreen]);

  if (isPatientKiosk) return <Suspense fallback={<div className="auth-loading"><span className="loading-spinner" /> Loading check-in…</div>}><PatientWelcomePage /></Suspense>;
  if (isDisplay) return <Suspense fallback={<div className="auth-loading"><span className="loading-spinner" /> Loading OPD Waiting Display…</div>}><WaitingHallDisplayPage /></Suspense>;

  if (status === 'checking') return <div className="auth-loading"><span className="loading-spinner" /> Checking secure session…</div>;

  return <Suspense fallback={<div className="auth-loading"><span className="loading-spinner" /> Loading workspace…</div>}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
      <Route path="/team" element={user?.role === 'administrator' ? <StaffUsersPage /> : <Navigate to="/" replace />} />
      <Route path="/account" element={user ? <AccountPage /> : <Navigate to="/login" replace />} />
      <Route path="/patients" element={user ? <PatientsPage /> : <Navigate to="/login" replace />} />
      <Route path="/patients/:patientId" element={user ? <PatientRecordPage /> : <Navigate to="/login" replace />} />
      <Route path="/patient" element={<PatientWelcomePage />} />
      <Route path="/display" element={<WaitingHallDisplayPage />} />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  </Suspense>;
}

export default function App() {
  return <AuthBootstrap />;
}
