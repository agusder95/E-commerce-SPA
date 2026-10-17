import { NavLink } from 'react-router-dom';
import { IconLayoutDashboard, IconShoppingBag, IconPackage, IconDiscount2 } from '@tabler/icons-react';

const links = [
  { path: '/admin', text: 'Dashboard', icon: IconLayoutDashboard },
  { path: '/admin/purchases', text: 'Compras', icon: IconShoppingBag },
  { path: '/admin/products', text: 'Productos', icon: IconPackage },
  { path: '/admin/offers', text: 'Ofertas', icon: IconDiscount2 },
];
export default function AdminNavigation() {
  return <nav className="admin-nav" aria-label="Administración">
    {links.map(({ path, text, icon: Icon }) => <NavLink key={path} to={path} end><Icon size={19} />{text}</NavLink>)}
  </nav>;
}
