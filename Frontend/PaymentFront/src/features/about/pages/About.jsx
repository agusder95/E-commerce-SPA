import { Link } from 'react-router-dom';
import { IconArrowDown, IconArrowUpRight, IconMapPin } from '@tabler/icons-react';
import naturePhoto from '../assets/About 1.png';
import portraitPhoto from '../assets/About 2.png';
import { BRAND_LOGO as projectImage } from '../../../shared/brand.js';
import '../about.css';

export default function About() {
  return <article className="page about-story">
    <header className="about-intro" aria-labelledby="about-title">
      <div className="about-intro-copy">
        <span className="about-eyebrow">Sobre mí · Andrea Brandoni</span>
        <h1 id="about-title">Una vida enseñando.<br />Una nueva manera<br />de <em>seguir aprendiendo.</em></h1>
        <p>Soy Andrea, docente de Nivel Inicial jubilada, fotógrafa de naturaleza por pasión y creadora de <strong>Juegos Fueguinos AMB.</strong></p>
        <p>Desde Ushuaia, transformo lo que descubro en la naturaleza en juegos y recursos para aprender juntos.</p>
        <a className="about-story-link" href="#mi-historia">Te cuento mi historia <IconArrowDown size={18} aria-hidden="true" /></a>
      </div>
      <figure className="about-portrait">
        <img src={portraitPhoto} alt="Andrea Brandoni sonriendo con su cámara de fotos" width="976" height="937" fetchPriority="high" />
        <figcaption><IconMapPin size={16} aria-hidden="true" /> Ushuaia, Tierra del Fuego <span>Mi lugar en el mundo.</span></figcaption>
      </figure>
    </header>

    <section id="mi-historia" className="about-chapter about-roots" aria-labelledby="about-roots-title">
      <div className="about-chapter-heading">
        <span className="about-eyebrow">01 / Mis raíces</span>
        <h2 id="about-roots-title">La maestra jardinera<br />que sigue en mí.</h2>
      </div>
      <div className="about-prose">
        <p>Tierra del Fuego es mi lugar en el mundo. Aquí nací, crecí, estudié, formé mi familia y construí gran parte de mi historia personal y profesional.</p>
        <p>Me recibí de Profesora de Nivel Inicial y ejercí durante casi tres décadas. Recorrí distintos jardines de infantes de Ushuaia, compartiendo el camino con niñas, niños, familias, docentes y comunidades educativas.</p>
        <p>Cada jardín dejó algo en mí. Cada sala, cada equipo y, especialmente, cada infancia enriquecieron a esa maestra jardinera que todavía hoy sigue siendo parte de quien soy.</p>
        <p className="about-emphasis">Jubilarme significó cerrar una etapa laboral, pero no dejar de ser docente.</p>
      </div>
    </section>

    <section className="about-nature" aria-labelledby="about-nature-title">
      <figure className="about-nature-photo">
        <div className="about-nature-frame"><img src={naturePhoto} alt="Un ave de plumaje moteado y cuello rojizo entre las piedras y ramas del entorno fueguino" width="1026" height="1024" loading="lazy" decoding="async" /></div>
        <figcaption>Detenerse. Observar. Descubrir lo que siempre estuvo cerca.</figcaption>
      </figure>
      <div className="about-prose">
        <span className="about-eyebrow">02 / Una nueva mirada</span>
        <h2 id="about-nature-title">La naturaleza,<br />mi aula abierta.</h2>
        <p>Hace algunos años comencé a acercarme a la fotografía de naturaleza. Caminar, observar y registrar la biodiversidad de mi provincia me permitió redescubrir el lugar donde viví toda mi vida.</p>
        <p>Las aves, las flores, los hongos, los insectos, nuestros bosques y costas se transformaron en una fuente permanente de curiosidad e inspiración.</p>
        <p>Mi vínculo con ABE — Asociación Bahía Encerrada y con la Reserva Natural Urbana Bahía Encerrada ocupa un lugar muy especial en este recorrido. Allí encontré un espacio para observar, aprender y comprender la importancia de acercar nuestra biodiversidad a las personas.</p>
        <p className="about-emphasis">Después de tantos años de enseñar, descubrí el enorme valor de volver a sentirme alumna.</p>
      </div>
    </section>

    <section className="about-project" aria-labelledby="about-project-title">
      <div className="about-project-copy about-prose">
        <span className="about-eyebrow">03 / El encuentro de mis dos mundos</span>
        <h2 id="about-project-title">Así nació<br />Juegos Fueguinos AMB.</h2>
        <p>La docente y la fotógrafa. La experiencia con las infancias y el descubrimiento de la naturaleza. El juego y la biodiversidad.</p>
        <p>De ese encuentro nació este proyecto: fotografías, dibujos, investigaciones y experiencias que se transforman en juegos y recursos educativos inspirados en Tierra del Fuego.</p>
        <p>Abecedarios, memotest, rompecabezas, cartas, cuentos, títeres y propuestas para colorear invitan a las infancias, las familias y los docentes a conocer las especies del lugar donde vivimos.</p>
        <p>Muchos de estos recursos nacen primero en el territorio: caminando, fotografiando, preguntando y aprendiendo de quienes saben.</p>
        <span className="about-project-motto">Jugar es una manera diferente de aprender.</span>
      </div>
      <figure className="about-project-art">
        <img src={projectImage} alt="Mascota de Juegos Fueguinos AMB: un pingüino con gorro y bufanda que sostiene una pieza de rompecabezas con el nombre del proyecto" width="848" height="1140" loading="lazy" decoding="async" />
      </figure>
    </section>

    <section className="about-invitation" aria-labelledby="about-invitation-title">
      <span className="about-eyebrow">Conocer para cuidar</span>
      <h2 id="about-invitation-title">“Lo que no se conoce,<br /><em>no se cuida.</em>”</h2>
      <p>Creo profundamente que cuando conocemos aquello que nos rodea, comenzamos también a valorarlo, respetarlo y cuidarlo.</p>
      <p>Cada “¿qué es eso?”, “¿cómo se llama?” o “¿vive acá?” puede ser el comienzo de algo maravilloso: el deseo de conocer.</p>
      <p>Esta es mi invitación a descubrir juntos un pedacito de Tierra del Fuego, con ojos que observan y corazones que sienten.</p>
      <Link to="/" className="btn-primary">Descubrí los juegos y recursos <IconArrowUpRight size={18} aria-hidden="true" /></Link>
      <span className="about-signature">Andrea Brandoni</span>
      <span className="about-signature-note">Aprendiz permanente de la naturaleza.</span>
    </section>
  </article>;
}
