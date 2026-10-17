import AdminNavigation from './components/AdminNavigation';
import AdminRoutes from './AdminRoutes';

export default function AdminLayout() {
  return <div className="page admin-page">
    <h1 className="page-title">Administrar</h1>
    <p className="page-description">Un lugar para gestionar tu tienda.</p>
    <div className="admin-layout"><AdminNavigation /><div className="admin-content"><AdminRoutes /></div></div>
  </div>;
}
