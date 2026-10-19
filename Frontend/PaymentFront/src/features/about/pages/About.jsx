import { Link } from 'react-router-dom';
import { IconSparkles, IconArrowUpRight } from '@tabler/icons-react';
export default function About() {
  return <section className="page about-page"><div className="about-art" aria-hidden="true"><IconSparkles stroke={0.7} /><span>Una idea<br />toma forma.</span></div><div className="about-copy"><span className="product-category">Sobre mí</span><h1>Un espacio para<br />seguir creando.</h1><p>Forma reúne productos digitales y físicos para acompañar tus proyectos.</p><Link to="/" className="btn-primary">Explorar productos <IconArrowUpRight size={18} /></Link></div></section>;
}
