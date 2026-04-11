import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import NewBill from './pages/NewBill';
import PendingBills from './pages/PendingBills';
import ApprovedBills from './pages/ApprovedBills';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import ApprovalPage from './pages/ApprovalPage';
import EditBill from './pages/EditBill';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/approval/:token" element={<ApprovalPage />} />
      <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
      <Route path="/new-bill" element={<ProtectedRoute><Layout><NewBill /></Layout></ProtectedRoute>} />
      <Route path="/pending-bills" element={<ProtectedRoute><Layout><PendingBills /></Layout></ProtectedRoute>} />
      <Route path="/edit-bill/:id" element={<ProtectedRoute><Layout><EditBill /></Layout></ProtectedRoute>} />
      <Route path="/approved-bills" element={<ProtectedRoute><Layout><ApprovedBills /></Layout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Layout><Customers /></Layout></ProtectedRoute>} />
      <Route path="/products" element={<AdminRoute><Layout><Products /></Layout></AdminRoute>} />
      <Route path="/settings" element={<AdminRoute><Layout><Settings /></Layout></AdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
