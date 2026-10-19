import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './layout/Navbar';
import Footer from './layout/Footer';

export default function StoreLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <><a className="skip-link" href="#main">Ir al contenido</a><Navbar />
    <main id="main"><Suspense fallback={<div className="loading" role="status">Cargando página…</div>}>
      <Outlet />
    </Suspense></main><Footer /></>;
}
