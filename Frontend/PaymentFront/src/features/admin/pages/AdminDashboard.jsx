import useAdminDashboard from '../hooks/useAdminDashboard';
import StatisticsOverview from '../components/StatisticsOverview';
import ProductStatistics from '../components/ProductStatistics';
import { IconLayoutDashboard } from '@tabler/icons-react';
import '../statistics.css';
import '../dashboard.css';
export default function AdminDashboard() {
  const overview = useAdminDashboard();
  return <div className="admin-dashboard">
    <header className="dashboard-heading"><span className="dashboard-heading-icon" aria-hidden="true"><IconLayoutDashboard size={25} /></span><div><h2>Dashboard</h2><p>Consultá el movimiento de tu tienda y la evolución de tus productos.</p></div></header>
    <StatisticsOverview manager={overview} />
    <ProductStatistics />
  </div>;
}
