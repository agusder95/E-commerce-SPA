import ProductCard from "../components/ProductCard";
import { useEffect, useRef } from "react";
import CatalogFilters from "../components/CatalogFilters";
import useCatalog from "../hooks/useCatalog";
import ProductCarousel from "../components/ProductCarousel";
import HomeHero from "../components/HomeHero";
import { PAGE_SIZE } from "../model/catalog";
import {
    IconChevronLeft,
    IconChevronRight,
    IconSparkles,
    IconFolders,
    IconLayoutGrid,
    IconSearch,
    IconLoader2,
} from "@tabler/icons-react";
import "../catalog.css";
import "../home-catalog.css";

export default function Products() {
    const {
        products,
        loading,
        error,
        selectedTags,
        search,
        sort,
        toggleTag,
        setSearch,
        setSort,
        categories,
        filtered,
        newest,
        collections,
        pagination,
        setPage,
        discountedOnly,
        setDiscountedOnly,
    } = useCatalog();
    const catalogSection = useRef(null);
    const scrollToCatalog = useRef(false);
    function changePage(page) {
        if (page === pagination.page) return;
        scrollToCatalog.current = true;
        setPage(page);
    }
    useEffect(() => {
        if (!scrollToCatalog.current) return;
        scrollToCatalog.current = false;
        const section = catalogSection.current;
        section?.querySelector("h2")?.focus({ preventScroll: true });
        section?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }, [pagination.page]);
    return (
        <div className="page storefront-home">
            <HomeHero />
            {loading ? (
                <div className="home-catalog-loading" role="status">
                    <IconLoader2 size={25} aria-hidden="true" />
                    Cargando productos…
                </div>
            ) : error ? (
                <p role="alert" className="auth-message error">
                    {error}
                </p>
            ) : (
                <>
                    <ProductCarousel
                        icon={<IconSparkles size={23} stroke={1.6} />}
                        title="Nuevos"
                        description="Lo que llegó en las últimas dos semanas."
                        products={newest}
                        emptyMessage="No hay novedades de las últimas dos semanas."
                    />
                    <ProductCarousel
                        icon={<IconFolders size={23} stroke={1.6} />}
                        title="Colecciones"
                        description="Las últimas incorporaciones a nuestras colecciones."
                        products={collections}
                        emptyMessage="Todavía no hay productos con el tag Colecciones."
                    />
                    <section
                        id="todos"
                        ref={catalogSection}
                        className="home-section catalog"
                        aria-labelledby="all-title"
                    >
                        <div className="home-section-heading">
                            <div className="home-catalog-section-title">
                                <div>
                                    <h2 id="all-title" tabIndex={-1}>
                                        <span
                                            className="home-catalog-section-icon"
                                            aria-hidden="true"
                                        >
                                            <IconLayoutGrid
                                                size={23}
                                                stroke={1.6}
                                            />
                                        </span>
                                        Todos los juegos y recursos
                                    </h2>
                                    <p>
                                        Encontrá una nueva forma de aprender
                                        jugando.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <CatalogFilters
                            categories={categories}
                            selectedTags={selectedTags}
                            search={search}
                            sort={sort}
                            discountedOnly={discountedOnly}
                            onDiscountedOnly={setDiscountedOnly}
                            onCategory={toggleTag}
                            onSearch={setSearch}
                            onSort={setSort}
                        />
                        <div className="catalog-results-heading">
                            <p className="catalog-count" role="status">
                                <strong>{filtered.length}</strong>{" "}
                                {filtered.length === 1
                                    ? "producto"
                                    : "productos"}
                                {selectedTags.length
                                    ? ` con ${selectedTags.join(" + ")}`
                                    : ""}
                            </p>
                            <span>
                                Mostrando{" "}
                                {filtered.length
                                    ? (pagination.page - 1) * PAGE_SIZE + 1
                                    : 0}
                                –
                                {Math.min(
                                    pagination.page * PAGE_SIZE,
                                    filtered.length,
                                )}{" "}
                                de {filtered.length}
                            </span>
                        </div>
                        {filtered.length ? (
                            <>
                                <div className="product-grid">
                                    {pagination.items.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                        />
                                    ))}
                                </div>
                                {pagination.pages > 1 && (
                                    <nav
                                        className="catalog-pagination"
                                        aria-label="Paginación de productos"
                                    >
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            disabled={pagination.page === 1}
                                            onClick={() =>
                                                changePage(pagination.page - 1)
                                            }
                                            aria-label="Página anterior"
                                        >
                                            <IconChevronLeft
                                                size={18}
                                                aria-hidden="true"
                                            />
                                        </button>
                                        <span aria-live="polite">
                                            Página {pagination.page} de{" "}
                                            {pagination.pages}
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            disabled={
                                                pagination.page ===
                                                pagination.pages
                                            }
                                            onClick={() =>
                                                changePage(pagination.page + 1)
                                            }
                                            aria-label="Página siguiente"
                                        >
                                            <IconChevronRight
                                                size={18}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </nav>
                                )}
                            </>
                        ) : (
                            <div className="home-catalog-empty">
                                <IconSearch
                                    size={30}
                                    stroke={1.5}
                                    aria-hidden="true"
                                />
                                <h3>
                                    {products.length
                                        ? "No encontramos productos con esos filtros."
                                        : "Todavía no hay productos disponibles."}
                                </h3>
                                <p>
                                    {products.length
                                        ? "Probá con otro nombre o cambiá las categorías seleccionadas."
                                        : "Volvé pronto para descubrir nuestros juegos y recursos."}
                                </p>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
