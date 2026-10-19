import useAdminDashboard from '../hooks/useAdminDashboard';
import StatisticsOverview from '../components/StatisticsOverview';
import ProductStatistics from '../components/ProductStatistics';
import '../statistics.css';
export default function AdminDashboard() {
  const overview = useAdminDashboard();
  return <div className="admin-dashboard">
    <StatisticsOverview manager={overview} />
    <ProductStatistics />
  </div>;
}
