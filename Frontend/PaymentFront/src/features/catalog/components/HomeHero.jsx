import { Link } from 'react-router-dom';
import { IconArrowDown, IconArrowUpRight, IconMapPin } from '@tabler/icons-react';
import { BRAND_LOGO, BRAND_NAME } from '../../../shared/brand.js';

export default function HomeHero() {
  return <section className="home-hero" aria-labelledby="home-title">
    <div className="home-hero-copy">
      <span className="home-hero-eyebrow">{BRAND_NAME}</span>
      <h1 id="home-title">Un pedacito de<br />Tierra del Fuego<br />para <em>aprender jugando.</em></h1>
      <p>Juegos y recursos educativos que invitan a descubrir nuestra biodiversidad. Para infancias curiosas, familias y docentes con ganas de explorar.</p>
      <div className="home-hero-actions">
        <a className="btn-primary" href="#todos">Explorar juegos y recursos<IconArrowDown size={18} aria-hidden="true" /></a>
        <Link className="home-hero-about" to="/about">Conocé mi historia <IconArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
      <span className="home-hero-origin"><IconMapPin size={16} aria-hidden="true" /> Creados en Ushuaia, inspirados en nuestra naturaleza.</span>
    </div>
    <div className="home-hero-art">
      <img src={BRAND_LOGO} alt="Logo de Juegos Fueguinos AMB: un pingüino abrigado con una pieza de rompecabezas" width="849" height="1140" fetchPriority="high" />
      <span>Conocer es el primer paso para cuidar.</span>
    </div>
  </section>;
}
