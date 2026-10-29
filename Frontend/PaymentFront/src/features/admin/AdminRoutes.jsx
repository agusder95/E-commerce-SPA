import { Route, Routes } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import AdminPurchases from './pages/AdminPurchases';
import AdminProducts from './products/pages/AdminProducts';
import AdminOffers from './pages/AdminOffers';

export default function AdminRoutes() {
  return <Routes>
    <Route index element={<AdminDashboard />} />
    <Route path="purchases" element={<AdminPurchases />} />
    <Route path="products" element={<AdminProducts />} />
    <Route path="offers" element={<AdminOffers />} />
    <Route path="*" element={<AdminDashboard />} />
  </Routes>;
}
