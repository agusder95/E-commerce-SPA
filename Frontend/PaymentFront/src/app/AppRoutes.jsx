import { lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import { CUSTOMER_ROLES, ADMIN_ROLES } from '../features/auth/model/access.js';
import StoreLayout from './StoreLayout';

const Products = lazy(() => import('../features/catalog/pages/Products'));
const ProductDetail = lazy(() => import('../features/catalog/pages/ProductDetail'));
const About = lazy(() => import('../features/about/pages/About'));
const Auth = lazy(() => import('../features/auth/pages/Auth'));
const Cart = lazy(() => import('../features/cart/pages/Cart'));
const CheckoutResult = lazy(() => import('../features/orders/pages/CheckoutResult'));
const MyPurchases = lazy(() => import('../features/orders/pages/MyPurchases'));
const Admin = lazy(() => import('../features/admin/AdminLayout'));

export default function AppRoutes() {
  return <Routes><Route element={<StoreLayout />}>
      <Route index element={<Products />} />
      <Route path="home" element={<Products />} />
      <Route path="products/:id" element={<ProductDetail />} />
      <Route path="about" element={<About />} />
      <Route path="auth" element={<Auth />} />
      <Route element={<ProtectedRoute allowedRoles={CUSTOMER_ROLES} />}>
        <Route path="cart" element={<Cart />} />
        <Route path="checkout/result" element={<CheckoutResult />} />
        <Route path="my-purchases" element={<MyPurchases />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
        <Route path="admin/*" element={<Admin />} />
      </Route>
      <Route path="*" element={<div className="page empty-state"><h1>Página no encontrada</h1>
        <Link className="btn-secondary" to="/">Volver a productos</Link></div>} />
    </Route></Routes>;
}
