import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ProductGallery from "../components/ProductGallery.jsx";
import { useCart } from "../../cart/context/useCart.js";
import AddedToCartModal from "../../cart/components/AddedToCartModal.jsx";
import { useAuth } from "../../auth/context/useAuth.js";
import useProductDetail from "../hooks/useProductDetail";
import RichTextContent from "../../../shared/rich-text/RichTextContent";
import { money } from "../../../shared/utils/format.js";
import { hasRouteAccess, CUSTOMER_ROLES } from "../../auth/model/access";
import "../catalog.css";

export default function ProductDetail() {
    const { id } = useParams();
    return <ProductDetailContent key={id} id={id} />;
}

function ProductDetailContent({ id }) {
    const { product, detail, variants, selectVariant, error, loading } =
        useProductDetail(id);
    const [showAddedModal, setShowAddedModal] = useState(false);
    const closeAddedModal = useCallback(() => setShowAddedModal(false), []);
    const { cart, addToCart, getAvailableStock } = useCart();
    const auth = useAuth();
    const navigate = useNavigate();
    if (error)
        return (
            <div className="page">
                <p role="alert">{error}</p>
                <Link to="/">Volver a productos</Link>
            </div>
        );
    if (loading || !product)
        return (
            <div className="loading" role="status">
                Cargando producto…
            </div>
        );
    const stock = getAvailableStock(product);
    const unavailable = product.type === "PHYSICAL" && stock <= 0;
    const added = cart.some((item) => item.id === product.id);
    const digitalInCart = product.type === "DIGITAL" && added;
    return (
        <div className="page">
            <Link to="/" className="back-link">
                Volver a productos
            </Link>
            <section className="product-detail">
                <ProductGallery product={detail} />
                <div className="detail-copy">
                    {/* <span className="product-category">
                        {detail.category} ·{" "}
                        {product.type === "PHYSICAL" ? "Físico" : "Digital"}
                    </span> */}
                    <h1>{detail.name}</h1>
                    <div
                        className="product-format-picker"
                        role="group"
                        aria-label="Elegir formato"
                    >
                        
                        <div>
                            {variants.map((variant) => (
                                <button
                                    type="button"
                                    className={`product-format ${variant.id === product.id ? "is-selected" : ""}`}
                                    key={variant.id}
                                    onClick={() => selectVariant(variant.id)}
                                    aria-pressed={variant.id === product.id}
                                >
                                    <strong>
                                        {variant.type === "PHYSICAL"
                                            ? "Físico"
                                            : "Digital"}
                                    </strong>
                                    <span>{money(variant.price)}</span>
                                    {variant.discounted && (
                                        <small>Con descuento</small>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="detail-price">
                        {product.discounted && (
                            <>
                                <del aria-label="Precio original">
                                    {money(product.unitPrice)}
                                </del>
                                <span className="product-discount">
                                    Con descuento
                                </span>
                            </>
                        )}
                        <div>
                            {money(product.price)} <span>ARS</span>
                        </div>
                    </div>
                    <p aria-live="polite">
                        {product.type === "PHYSICAL"
                            ? `Stock disponible: ${stock}.`
                            : "Descarga disponible una vez aprobado el pago."}
                    </p>
                    <button
                        className="btn-primary"
                        disabled={unavailable || digitalInCart}
                        onClick={() => {
                            if (!auth.isAuthenticated) {
                                navigate("/auth", {
                                    state: { from: `/products/${id}` },
                                });
                                return;
                            }
                            if (!hasRouteAccess(auth, CUSTOMER_ROLES)) {
                                navigate("/");
                                return;
                            }
                            addToCart({
                                ...product,
                                name: detail.name,
                                thumbnail: detail.thumbnail,
                            });
                            setShowAddedModal(true);
                        }}
                    >
                        {unavailable
                            ? "Sin stock"
                            : digitalInCart
                              ? "Ya está en el carrito"
                              : added
                                ? "Agregar otra unidad"
                                : "Agregar al carrito"}
                    </button>
                    {(added || digitalInCart) && (
                        <Link className="btn-secondary" to="/cart">
                            Ver carrito
                        </Link>
                    )}
                    {detail.tags.length > 0 && (
                        <ul
                            className="detail-tags"
                            aria-label="Tags del producto"
                        >
                            {detail.tags.map((tag) => (
                                <li key={tag}>{tag}</li>
                            ))}
                        </ul>
                    )}
                    
                    <RichTextContent value={detail.description} />
                </div>
            </section>
            {showAddedModal && (
                <AddedToCartModal
                    productName={product.name}
                    onClose={closeAddedModal}
                    onGoToCart={() => navigate("/cart")}
                />
            )}
        </div>
    );
}
