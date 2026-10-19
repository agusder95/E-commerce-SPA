import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { IconShoppingBag, IconUser, IconMenu2, IconX, IconLogout, IconSparkles } from '@tabler/icons-react';
import { useAuth } from '../../features/auth/context/useAuth.js';
import { useCart } from '../../features/cart/context/useCart.js';
import { hasRouteAccess, CUSTOMER_ROLES, ADMIN_ROLES } from '../../features/auth/model/access.js';
import { userNameFromEmail } from '../../features/auth/model/userName.js';
export default function Navbar() {
  const { isAuthenticated, role, email, logout } = useAuth();
  const userName = userNameFromEmail(email);
  const canShop = hasRouteAccess({ isAuthenticated, role }, CUSTOMER_ROLES);
  const canAdminister = hasRouteAccess({ isAuthenticated, role }, ADMIN_ROLES);
  const { cartCount } = useCart();
  const [open, setOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const close = () => setOpen(false);
  function confirmLogout() {
    logout();
    setShowLogoutModal(false);
    close();
    navigate('/');
  }

  return <>
    <header className="navbar"><div className="navbar-inner">
      <NavLink to="/" className="navbar-brand" onClick={close}><IconSparkles size={27} stroke={1.5} /><span>forma<span className="brand-dot">.</span></span></NavLink>
      <nav className={`navbar-links ${open ? 'is-open' : ''}`} aria-label="Navegación principal">
        {isAuthenticated && userName && <span className="navbar-username navbar-username-mobile" title={userName}>{userName}</span>}
        <NavLink to="/" end onClick={close}>Productos</NavLink><NavLink to="/about" onClick={close}>Sobre mí</NavLink>
        {canShop && <NavLink to="/my-purchases" onClick={close}>Mis compras</NavLink>}
        {canAdminister && <NavLink to="/admin" onClick={close}>Administrar</NavLink>}
      </nav><div className="navbar-actions">{isAuthenticated ? <>
        {userName && <span className="navbar-username navbar-username-desktop" title={userName}>{userName}</span>}
        {canShop && <NavLink to="/cart" className="icon-button" aria-label={`Carrito, ${cartCount} productos`} onClick={close}><IconShoppingBag size={21} />{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}</NavLink>}
        <button className="icon-button" aria-label="Cerrar sesión" onClick={() => setShowLogoutModal(true)}><IconLogout size={20} /></button>
      </> : <NavLink to="/auth" className="login-link" onClick={close}><IconUser size={18} /><span>Ingresar</span></NavLink>}
      <button className="icon-button menu-toggle" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <IconX /> : <IconMenu2 />}</button></div>
    </div></header>
    {showLogoutModal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLogoutModal(false); }}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title"><h2 id="logout-title">¿Cerrar sesión?</h2><p>Tu sesión se cerrará en este dispositivo.</p><div className="confirm-modal-actions"><button className="btn-secondary" type="button" onClick={() => setShowLogoutModal(false)}>Cancelar</button><button className="btn-primary" type="button" onClick={confirmLogout}>Cerrar sesión</button></div></section></div>}
  </>;
}
