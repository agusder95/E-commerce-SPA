import { Link } from 'react-router-dom';
import { IconSparkles } from '@tabler/icons-react';
export default function Footer() {
  return <footer className="footer"><div className="footer-inner"><div><Link to="/" className="navbar-brand"><IconSparkles size={22} stroke={1.5} />forma.</Link><p>Productos digitales y físicos. Ideas que toman forma.</p></div><div className="footer-links"><Link to="/">Productos</Link><Link to="/about">Sobre mí</Link><Link to="/auth">Mi cuenta</Link></div><span className="footer-note">Hecho para seguir creando.</span></div></footer>;
}
