import ProductCard from '../components/ProductCard';
import CatalogFilters from '../components/CatalogFilters';
import useCatalog from '../hooks/useCatalog';
import ProductCarousel from '../components/ProductCarousel';
import HomeHero from '../components/HomeHero';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import '../catalog.css';

export default function Products() {
  const { products, loading, error, selectedTags, search, sort, toggleTag, setSearch, setSort, categories,
    filtered, newest, collections, pagination, setPage, discountedOnly, setDiscountedOnly } = useCatalog();
  return <div className="page storefront-home">
    <HomeHero product={products.find(product => product.thumbnail)} />
    {loading ? <div className="loading" role="status">Cargando productos…</div> : error ? <p role="alert" className="auth-message error">{error}</p> : <>
      <ProductCarousel title="Nuevos" description="Lo que llegó en las últimas dos semanas." products={newest}
        emptyMessage="No hay novedades de las últimas dos semanas." />
      <ProductCarousel title="Colecciones" description="Las últimas incorporaciones a nuestras colecciones." products={collections}
        emptyMessage="Todavía no hay productos con el tag Colecciones." />
      <section id="todos" className="home-section catalog" aria-labelledby="all-title">
        <div className="home-section-heading"><h2 id="all-title">Todos</h2></div>
        <CatalogFilters categories={categories} selectedTags={selectedTags} search={search} sort={sort}
          discountedOnly={discountedOnly} onDiscountedOnly={setDiscountedOnly}
          onCategory={toggleTag} onSearch={setSearch} onSort={setSort} />
        <p className="catalog-count" role="status">{filtered.length} productos{selectedTags.length ? ` con ${selectedTags.join(' + ')}` : ''}</p>
        {filtered.length ? <><div className="product-grid">
          {pagination.items.map(product => <ProductCard key={product.id} product={product} />)}</div>
          {pagination.pages > 1 && <nav className="catalog-pagination" aria-label="Paginación de productos">
            <button type="button" className="btn-secondary" disabled={pagination.page === 1} onClick={() => setPage(pagination.page - 1)} aria-label="Página anterior"><IconChevronLeft size={18} aria-hidden="true" /></button>
            <span aria-live="polite">Página {pagination.page} de {pagination.pages}</span>
            <button type="button" className="btn-secondary" disabled={pagination.page === pagination.pages} onClick={() => setPage(pagination.page + 1)} aria-label="Página siguiente"><IconChevronRight size={18} aria-hidden="true" /></button>
          </nav>}</> : <div className="empty-state"><h3>{products.length ? 'No encontramos productos con esos filtros.' : 'Todavía no hay productos disponibles.'}</h3></div>}
      </section>
    </>}
  </div>;
}
