import { Link } from 'react-router-dom';
import { IconBrandInstagram, IconBrandGithub, IconBrandLinkedin, IconArrowUpRight, IconMapPin, IconCode } from '@tabler/icons-react';
import Brand from '../../shared/ui/Brand';
import { BRAND_NAME } from '../../shared/brand';
import { SITE_INSTAGRAM, DEVELOPER } from '../../shared/siteContacts';
import './footer.css';

export default function Footer() {
  const instagramHandle = SITE_INSTAGRAM ? `@${new URL(SITE_INSTAGRAM).pathname.split('/').filter(Boolean)[0]}` : '';
  const socialContent = <><span className="site-footer-social-icon"><IconBrandInstagram size={25} stroke={1.6} aria-hidden="true" /></span><span><strong>Seguinos en Instagram</strong><span>{instagramHandle || 'Juegos Fueguinos AMB'}</span></span>{SITE_INSTAGRAM && <IconArrowUpRight className="site-footer-social-arrow" size={19} aria-hidden="true" />}</>;
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <Link to="/" className="site-footer-brand-link" aria-label={`${BRAND_NAME}, inicio`}><Brand /></Link>
          <p>Juegos y recursos educativos para descubrir nuestra biodiversidad y aprender jugando.</p>
          <span className="site-footer-location"><IconMapPin size={15} aria-hidden="true" />Desde Ushuaia, Tierra del Fuego, Argentina.</span>
        </div>
        <nav className="site-footer-nav" aria-label="Navegación del pie de página"><h2>Explorá</h2><Link to="/">Juegos y recursos</Link><Link to="/about">La historia del proyecto</Link><Link to="/auth">Mi cuenta</Link></nav>
        <div className="site-footer-community"><h2>Sigamos descubriendo</h2><p>Conocé las novedades y el mundo que inspira nuestros juegos.</p>
          {SITE_INSTAGRAM ? <a className="site-footer-social" href={SITE_INSTAGRAM} target="_blank" rel="noopener noreferrer" aria-label={`Instagram de ${BRAND_NAME} (abre en otra pestaña)`}>{socialContent}</a> : <div className="site-footer-social">{socialContent}</div>}
        </div>
      </div>
      <div className="site-footer-bottom"><p>© {new Date().getFullYear()} {BRAND_NAME}<span>Conocer, jugar y cuidar.</span></p>
        {DEVELOPER.name && <div className="site-footer-credit"><IconCode size={17} aria-hidden="true" /><span>Desarrollado por <strong>{DEVELOPER.name}</strong></span>
          <nav className="site-footer-developer-links" aria-label={`Perfiles de ${DEVELOPER.name}`}>
            <a href={DEVELOPER.github} target="_blank" rel="noopener noreferrer" aria-label={`GitHub de ${DEVELOPER.name} (abre en otra pestaña)`}><IconBrandGithub size={17} aria-hidden="true" />GitHub</a>
            <a href={DEVELOPER.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`LinkedIn de ${DEVELOPER.name} (abre en otra pestaña)`}><IconBrandLinkedin size={17} aria-hidden="true" />LinkedIn</a>
          </nav>
        </div>}
      </div>
    </div>
  </footer>;
}
