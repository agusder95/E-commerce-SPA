import { useEffect, useId, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import ProductCard from "./ProductCard";

export default function ProductCarousel({
    title,
    description,
    products,
    emptyMessage,
    icon,
}) {
    const track = useRef(null);
    const id = useId();
    const [view, setView] = useState({
        first: 1,
        last: 1,
        previous: false,
        next: false,
        progress: 1,
    });
    useEffect(() => {
        const element = track.current;
        if (!element) return;
        function measure() {
            const bounds = element.getBoundingClientRect();
            const visible = [...element.children].flatMap((child, index) => {
                const rect = child.getBoundingClientRect();
                const overlap =
                    Math.min(rect.right, bounds.right) -
                    Math.max(rect.left, bounds.left);
                return overlap >= Math.min(rect.width, bounds.width) / 2
                    ? [index + 1]
                    : [];
            });
            const next = {
                first: visible[0] || 1,
                last: visible.at(-1) || 1,
                previous: element.scrollLeft > 2,
                next:
                    element.scrollLeft + element.clientWidth <
                    element.scrollWidth - 2,
                progress: Math.min(
                    1,
                    (element.scrollLeft + element.clientWidth) /
                        element.scrollWidth,
                ),
            };
            setView((previous) =>
                Object.keys(next).every((key) => previous[key] === next[key])
                    ? previous
                    : next,
            );
        }
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        element.addEventListener("scroll", measure, { passive: true });
        return () => {
            observer.disconnect();
            element.removeEventListener("scroll", measure);
        };
    }, [products]);
    function scroll(direction) {
        const element = track.current;
        const card = element.firstElementChild;
        if (!card) return;
        const step =
            card.getBoundingClientRect().width +
            parseFloat(getComputedStyle(element).columnGap || "0");
        const count = Math.max(1, Math.floor(element.clientWidth / step));
        element.scrollBy({
            left: direction * step * count,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
        });
    }
    return (
        <section className="home-section home-carousel" aria-labelledby={id}>
            <div className="home-section-heading">
                <div className="home-catalog-section-title">
                    <div>
                        <h2 id={id}>
                            {icon && (
                                <span
                                    className="home-catalog-section-icon"
                                    aria-hidden="true"
                                >
                                    {icon}
                                </span>
                            )}
                            {title}
                        </h2>
                        <p>{description}</p>
                    </div>
                </div>
            </div>
            {products.length ? (
                <div className="home-carousel-frame">
                    <div
                        className="product-carousel"
                        id={`${id}-track`}
                        ref={track}
                        role="region"
                        aria-label={`Productos de ${title}`}
                        tabIndex={0}
                    >
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                    <div className="home-carousel-footer">
                        <span
                            className="home-carousel-position"
                            aria-live="polite"
                        >
                            {view.first === view.last
                                ? view.first
                                : `${view.first}–${view.last}`}{" "}
                            <span>de {products.length}</span>
                        </span>
                        <div
                            className="home-carousel-progress"
                            aria-hidden="true"
                        >
                            <span
                                style={{ width: `${view.progress * 100}%` }}
                            />
                        </div>
                        <div className="carousel-controls">
                            <button
                                type="button"
                                className="btn-secondary"
                                aria-label={`Anteriores en ${title}`}
                                aria-controls={`${id}-track`}
                                disabled={!view.previous}
                                onClick={() => scroll(-1)}
                            >
                                <IconChevronLeft size={19} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                aria-label={`Siguientes en ${title}`}
                                aria-controls={`${id}-track`}
                                disabled={!view.next}
                                onClick={() => scroll(1)}
                            >
                                <IconChevronRight
                                    size={19}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="section-empty">{emptyMessage}</p>
            )}
        </section>
    );
}
