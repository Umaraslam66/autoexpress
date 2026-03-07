import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAppState } from './context/AppState';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { PricingFilesPage } from './pages/PricingFilesPage';
import { PricingQueuePage } from './pages/PricingQueuePage';
import { VehicleDetailPage } from './pages/VehicleDetailPage';

function ProtectedRoutes() {
  const { activeUser } = useAppState();
  const location = useLocation();

  if (!activeUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/queue" element={<PricingQueuePage />} />
        <Route path="/vehicle/:vehicleId" element={<VehicleDetailPage />} />
        <Route path="/pricing-files" element={<PricingFilesPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

