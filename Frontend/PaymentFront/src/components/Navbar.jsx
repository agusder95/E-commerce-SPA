import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";

export default function Navbar() {
  const { isAuthenticated, email, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          PaymentGateway
        </NavLink>
        <div className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
            Productos
          </NavLink>
          <NavLink to="/cart" className={({ isActive }) => isActive ? "active" : ""}>
            Carrito{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/my-purchases" className={({ isActive }) => isActive ? "active" : ""}>
              Mis Compras
            </NavLink>
          )}
          {isAuthenticated ? (
            <>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{email}</span>
              <button className="btn-logout" onClick={handleLogout}>Salir</button>
            </>
          ) : (
            <NavLink to="/auth" className={({ isActive }) => isActive ? "active" : ""}>
              Iniciar Sesión
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  );
}
