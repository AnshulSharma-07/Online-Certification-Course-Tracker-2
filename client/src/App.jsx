import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Protected from './components/Protected';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Submit from './pages/Submit';
import Certificates from './pages/Certificates';
import Review from './pages/Review';
import Credits from './pages/Credits';
import Profile from './pages/Profile';
import { Spinner } from './components/ui';

// Admin pages pull in the charting library; load them only when needed.
const lazyNamed = (name) => lazy(() => import('./pages/Admin').then((m) => ({ default: m[name] })));
const Users = lazyNamed('Users');
const Policy = lazyNamed('Policy');
const Reports = lazyNamed('Reports');
const Audit = lazyNamed('Audit');

const STUDENT = ['STUDENT'];
const REVIEWERS = ['FACULTY', 'ADMIN', 'SUPER_ADMIN'];
const ADMINS = ['ADMIN', 'SUPER_ADMIN'];

function RoutesView() {
  return (
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route element={<Protected roles={STUDENT} />}>
            <Route path="submit" element={<Submit />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="credits" element={<Credits />} />
          </Route>
          <Route element={<Protected roles={REVIEWERS} />}>
            <Route path="review" element={<Review />} />
          </Route>
          <Route element={<Protected roles={ADMINS} />}>
            <Route path="users" element={<Users />} />
            <Route path="policy" element={<Policy />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<Audit />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <RoutesView />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
